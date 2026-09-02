// Cotacoes da aba Investimentos.
//
// Por que existe: B3/Yahoo/Tesouro bloqueiam chamada direta do navegador (CORS) e o
// APK precisa de URL absoluta; alem disso queremos 1 busca por dia/hora, nao a cada F5.
// Fontes (todas sem chave; validadas em 02/09/2026 contra o Investidor10):
//   - preco atual ........ B3 oficial `cotacao.b3.com.br` (ultimo negocio, inclui after-market =
//                          exatamente o que o Investidor10 mostra); fallback Yahoo (fechamento oficial).
//   - historico mensal ... Yahoo `chart` 2y/1mo (bateu dia a dia com o Investidor10).
//   - dividendos ......... Yahoo `events=div` (bateu com o StatusInvest).
//   - Tesouro Direto ..... CSV oficial do Tesouro Transparente (PU venda por titulo, todo o historico).
//
// Rotas (web handler; auth por JWT do usuario + allowlist, ou CRON_SECRET):
//   OPTIONS            CORS
//   GET  ?search=q     busca de ticker (Yahoo search, so bolsa SAO)
//   GET  ?tesouro=1    catalogo de titulos disponiveis (tipo + vencimento + PU)
//   POST {force?}      atualiza o cache (investment_quotes) dos ativos do usuario que estiverem
//                      velhos (>60min; Tesouro >12h) e materializa proventos automaticos
//                      (investment_transactions source=auto, dedupe por external_key).

import { createHash, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types.js";
import {
  autoDividendRows,
  isTesouroTicker,
  parseTesouroTicker,
  type InvestmentTx,
  type QuoteDividend,
  type QuotePoint,
} from "../src/lib/investments.js";

export const config = { maxDuration: 60 };

const ALLOWED_EMAIL = "weslleybertoldo18@gmail.com";
// UA curto de proposito: o Yahoo devolve 429 pra UA de navegador completo sem cookie
// (testado 02/09/2026: "Mozilla/5.0" = 200, UA Chrome inteiro = 429 na mesma rede).
const UA = "Mozilla/5.0";
const TTL_MARKET_MS = 60 * 60 * 1000;
const TTL_TESOURO_MS = 12 * 60 * 60 * 1000;
const TESOURO_CSV =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv";
const TESOURO_CATALOG_TICKER = "TD:CATALOGO";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

type Db = SupabaseClient<Database, "public">;
type QuoteRow = Database["public"]["Tables"]["investment_quotes"]["Row"];
type QuoteInsert = Database["public"]["Tables"]["investment_quotes"]["Insert"];

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function secretMatches(candidate: string, secret: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON com timeout e ate 2 retentativas em 429/5xx (backoff 800ms, 1600ms). */
async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  let lastErr: Error = new Error("sem resposta");
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: controller.signal });
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) throw lastErr;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.name === "AbortError" || /^HTTP 4(?!29)/.test(lastErr.message)) throw lastErr;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await sleep(800 * (attempt + 1));
  }
  throw lastErr;
}

// ---------------------------------------------------------------- auth + db

interface AuthOk {
  db: Db;
  userId: string;
}

async function authenticate(request: Request): Promise<AuthOk | Response> {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json(500, { error: "Configuração incompleta no servidor" });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Token de autenticação necessário" });
  const token = authHeader.slice("Bearer ".length);

  const schema = (process.env.DB_SCHEMA || "public") as "public";
  const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as Db;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secretMatches(token, cronSecret)) {
    const { data, error } = await db.auth.admin.listUsers();
    const owner = data?.users?.find((u) => u.email?.toLowerCase() === ALLOWED_EMAIL);
    if (error || !owner) return json(500, { error: "Configuração incompleta no servidor" });
    return { db, userId: owner.id };
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return json(401, { error: "Token inválido ou expirado" });
  if (data.user.email?.toLowerCase() !== ALLOWED_EMAIL) return json(403, { error: "Acesso negado" });
  return { db, userId: data.user.id };
}

// ---------------------------------------------------------------- B3 (preco atual)

interface B3Response {
  TradgFlr?: { date?: string; scty?: { lstQtn?: Array<{ closPric: number; dtTm: string; prcFlcn: number }> } };
}

async function fetchB3(ticker: string): Promise<{ price: number; priceAt: string; changePct: number } | null> {
  const data = await fetchJson<B3Response>(`https://cotacao.b3.com.br/mds/api/v1/DailyFluctuationHistory/${encodeURIComponent(ticker)}`);
  const quotes = data.TradgFlr?.scty?.lstQtn ?? [];
  const last = quotes[quotes.length - 1];
  const date = data.TradgFlr?.date;
  if (!last || !date || !Number.isFinite(last.closPric) || last.closPric <= 0) return null;
  return { price: last.closPric, priceAt: `${date}T${last.dtTm || "18:00:00"}-03:00`, changePct: Number(last.prcFlcn) || 0 };
}

// ---------------------------------------------------------------- Yahoo (historico + dividendos + fallback)

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number; regularMarketTime?: number; longName?: string; shortName?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      events?: { dividends?: Record<string, { amount: number; date: number }> };
    }>;
    error?: { description?: string } | null;
  };
}

interface YahooData {
  name: string | null;
  price: number | null;
  priceAt: string | null;
  changePct: number | null;
  history: QuotePoint[];
  dividends: QuoteDividend[];
}

function isoDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

async function fetchYahoo(ticker: string): Promise<YahooData> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?range=2y&interval=1mo&events=div`;
  const data = await fetchJson<YahooChart>(url);
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(data.chart?.error?.description ?? "Yahoo sem resultado");
  const meta = result.meta ?? {};
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const history: QuotePoint[] = [];
  (result.timestamp ?? []).forEach((t, i) => {
    const c = closes[i];
    if (c != null && Number.isFinite(c)) history.push({ date: isoDay(t), close: Math.round(c * 10000) / 10000 });
  });
  const dividends: QuoteDividend[] = Object.values(result.events?.dividends ?? {})
    .filter((d) => Number.isFinite(d.amount) && d.amount > 0)
    .map((d) => ({ date: isoDay(d.date), amount: d.amount }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    name: meta.longName ?? meta.shortName ?? null,
    price: Number.isFinite(meta.regularMarketPrice) ? (meta.regularMarketPrice as number) : null,
    priceAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    changePct: Number.isFinite(meta.regularMarketChangePercent) ? (meta.regularMarketChangePercent as number) : null,
    history,
    dividends,
  };
}

interface YahooSearch {
  quotes?: Array<{ symbol: string; exchange?: string; quoteType?: string; longname?: string; shortname?: string }>;
}

export interface SearchHit {
  ticker: string;
  name: string;
  assetClass: "acao" | "fii" | "etf";
}

function guessClass(ticker: string, name: string, quoteType?: string): SearchHit["assetClass"] {
  const n = name.toUpperCase();
  if (quoteType === "ETF" || /ISHARES|\bETF\b|IT NOW|INDICE|INDEX|TREND /.test(n)) return "etf";
  if (/FII|FUNDO DE INVESTIMENTO IMOB|FDO INV IMOB|IMOBILIAR/.test(n)) return "fii";
  return "acao";
}

async function searchTickers(q: string): Promise<SearchHit[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0`;
  const data = await fetchJson<YahooSearch>(url);
  return (data.quotes ?? [])
    .filter((x) => x.exchange === "SAO" && /\.SA$/.test(x.symbol))
    .map((x) => {
      const ticker = x.symbol.replace(/\.SA$/, "");
      const name = x.longname ?? x.shortname ?? ticker;
      return { ticker, name, assetClass: guessClass(ticker, name, x.quoteType) };
    });
}

// ---------------------------------------------------------------- Tesouro Direto (CSV oficial)

interface TesouroRow {
  tipo: string;
  vencimento: string; // ISO
  base: string; // ISO
  puVenda: number;
  puBase: number;
}

export interface TesouroCatalogItem {
  tipo: string;
  vencimento: string;
  pu: number;
}

function brDateToIso(s: string): string {
  const [d, m, y] = s.trim().split("/");
  return `${y}-${m}-${d}`;
}

function brNumber(s: string): number {
  return Number(s.trim().replace(/\./g, "").replace(",", "."));
}

let tesouroCache: { at: number; rows: TesouroRow[] } | null = null;

/** Baixa e parseia o CSV inteiro (~14 MB, todo o historico). Cache em memoria enquanto a instancia viver. */
async function loadTesouro(): Promise<TesouroRow[]> {
  if (tesouroCache && Date.now() - tesouroCache.at < TTL_TESOURO_MS) return tesouroCache.rows;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const res = await fetch(TESOURO_CSV, { headers: { "User-Agent": UA }, signal: controller.signal });
    if (!res.ok) throw new Error(`Tesouro CSV HTTP ${res.status}`);
    const text = Buffer.from(await res.arrayBuffer()).toString("latin1");
    const lines = text.split(/\r?\n/);
    const rows: TesouroRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      if (cols.length < 8) continue;
      const puVenda = brNumber(cols[6]);
      const puBase = brNumber(cols[7]);
      if (!Number.isFinite(puBase)) continue;
      rows.push({ tipo: cols[0].trim(), vencimento: brDateToIso(cols[1]), base: brDateToIso(cols[2]), puVenda, puBase });
    }
    if (rows.length === 0) throw new Error("Tesouro CSV vazio");
    tesouroCache = { at: Date.now(), rows };
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

function tesouroPrice(r: TesouroRow): number {
  return r.puVenda > 0 ? r.puVenda : r.puBase;
}

function tesouroCatalog(rows: TesouroRow[]): { date: string; items: TesouroCatalogItem[] } {
  let latest = "";
  for (const r of rows) if (r.base > latest) latest = r.base;
  const items = rows
    .filter((r) => r.base === latest)
    .map((r) => ({ tipo: r.tipo, vencimento: r.vencimento, pu: tesouroPrice(r) }))
    .sort((a, b) => (a.tipo === b.tipo ? (a.vencimento < b.vencimento ? -1 : 1) : a.tipo < b.tipo ? -1 : 1));
  return { date: latest, items };
}

/** Preco atual + fechamento mensal (ultimo dia util de cada mes, 24 meses) de um titulo. */
function tesouroQuote(rows: TesouroRow[], tipo: string, vencimento: string): Omit<QuoteInsert, "ticker"> | null {
  const mine = rows.filter((r) => r.tipo === tipo && r.vencimento === vencimento).sort((a, b) => (a.base < b.base ? -1 : 1));
  if (mine.length === 0) return null;
  const last = mine[mine.length - 1];
  const byMonth = new Map<string, TesouroRow>();
  for (const r of mine) byMonth.set(r.base.slice(0, 7), r); // ordenado: fica o ultimo do mes
  const months = [...byMonth.keys()].sort().slice(-24);
  const history: QuotePoint[] = months.map((m) => {
    const r = byMonth.get(m)!;
    return { date: r.base, close: tesouroPrice(r) };
  });
  const prev = mine.length > 1 ? tesouroPrice(mine[mine.length - 2]) : null;
  const price = tesouroPrice(last);
  return {
    asset_class: "tesouro",
    name: `${tipo} ${vencimento.slice(0, 4)}`,
    price,
    price_at: `${last.base}T09:00:00-03:00`,
    change_pct: prev && prev > 0 ? ((price - prev) / prev) * 100 : null,
    source: "tesouro",
    history: history as unknown as QuoteInsert["history"],
    dividends: [] as unknown as QuoteInsert["dividends"],
    error: null,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- refresh de um ticker B3

async function marketQuote(ticker: string, assetClass: string): Promise<Omit<QuoteInsert, "ticker">> {
  const [b3, yahoo] = await Promise.allSettled([fetchB3(ticker), fetchYahoo(ticker)]);
  const y = yahoo.status === "fulfilled" ? yahoo.value : null;
  const b = b3.status === "fulfilled" ? b3.value : null;
  if (!y && !b) {
    const reason = [b3, yahoo].map((r) => (r.status === "rejected" ? String(r.reason?.message ?? r.reason) : "")).filter(Boolean).join(" | ");
    throw new Error(reason || "sem cotação");
  }
  const price = b?.price ?? y?.price ?? null;
  return {
    asset_class: assetClass,
    name: y?.name ?? null,
    price,
    price_at: b?.priceAt ?? y?.priceAt ?? null,
    change_pct: b?.changePct ?? y?.changePct ?? null,
    source: b ? (y ? "b3+yahoo" : "b3") : "yahoo",
    history: (y?.history ?? []) as unknown as QuoteInsert["history"],
    dividends: (y?.dividends ?? []) as unknown as QuoteInsert["dividends"],
    error: y ? null : "sem histórico (Yahoo indisponível)",
    updated_at: new Date().toISOString(),
  };
}

function isStale(row: QuoteRow | undefined, ttlMs: number, force: boolean): boolean {
  if (force || !row || !row.updated_at) return true;
  if (row.price == null) return true;
  return Date.now() - new Date(row.updated_at).getTime() > ttlMs;
}

// ---------------------------------------------------------------- handlers

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);

  try {
    const q = url.searchParams.get("search")?.trim();
    if (q) {
      if (q.length < 2) return json(200, { ok: true, results: [] });
      return json(200, { ok: true, results: await searchTickers(q) });
    }
    if (url.searchParams.get("tesouro")) {
      const { db } = auth;
      const { data: cached } = await db.from("investment_quotes").select("*").eq("ticker", TESOURO_CATALOG_TICKER).maybeSingle();
      if (cached && !isStale(cached, TTL_TESOURO_MS, false)) {
        return json(200, { ok: true, date: cached.price_at, items: cached.history, cached: true });
      }
      const rows = await loadTesouro();
      const catalog = tesouroCatalog(rows);
      await db.from("investment_quotes").upsert(
        {
          ticker: TESOURO_CATALOG_TICKER,
          asset_class: "tesouro",
          name: "Catálogo Tesouro Direto",
          price: catalog.items.length,
          price_at: catalog.date,
          source: "tesouro",
          history: catalog.items as unknown as QuoteInsert["history"],
          dividends: [] as unknown as QuoteInsert["dividends"],
          error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ticker" }
      );
      return json(200, { ok: true, date: catalog.date, items: catalog.items, cached: false });
    }
    return json(400, { error: "Informe ?search= ou ?tesouro=1" });
  } catch (e) {
    console.error("[quotes GET]", e);
    return json(502, { error: "Falha ao consultar a fonte de dados" });
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const { db, userId } = auth;

  let force = false;
  try {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    force = body?.force === true;
  } catch {
    force = false;
  }

  const { data: assets, error: assetsErr } = await db
    .from("investment_assets")
    .select("id, ticker, asset_class, tesouro_tipo, tesouro_vencimento")
    .eq("user_id", userId);
  if (assetsErr) return json(500, { error: "Falha ao ler os ativos" });
  const list = assets ?? [];
  if (list.length === 0) return json(200, { ok: true, quotes: [], refreshed: [], errors: [] });

  const tickers = [...new Set(list.map((a) => a.ticker))];
  const { data: cachedRows, error: cacheErr } = await db.from("investment_quotes").select("*").in("ticker", tickers);
  if (cacheErr) return json(500, { error: "Falha ao ler o cache de cotações" });
  const cached = new Map((cachedRows ?? []).map((r) => [r.ticker, r]));

  const refreshed: string[] = [];
  const errors: Array<{ ticker: string; error: string }> = [];
  const upserts: QuoteInsert[] = [];

  const tesouroAssets = list.filter((a) => isTesouroTicker(a.ticker) && isStale(cached.get(a.ticker), TTL_TESOURO_MS, force));
  if (tesouroAssets.length > 0) {
    try {
      const rows = await loadTesouro();
      for (const a of tesouroAssets) {
        const parsed = parseTesouroTicker(a.ticker);
        const tipo = a.tesouro_tipo ?? parsed?.tipo;
        const venc = a.tesouro_vencimento ?? parsed?.vencimento;
        const q = tipo && venc ? tesouroQuote(rows, tipo, venc) : null;
        if (!q) {
          errors.push({ ticker: a.ticker, error: "título não encontrado no Tesouro Transparente" });
          continue;
        }
        upserts.push({ ticker: a.ticker, ...q });
        refreshed.push(a.ticker);
      }
    } catch (e) {
      for (const a of tesouroAssets) errors.push({ ticker: a.ticker, error: `Tesouro: ${(e as Error).message}` });
    }
  }

  // Sequencial de proposito: rajada paralela no Yahoo vira 429.
  const marketAssets = list.filter((a) => !isTesouroTicker(a.ticker) && isStale(cached.get(a.ticker), TTL_MARKET_MS, force));
  const seen = new Set<string>();
  for (const a of marketAssets) {
    if (seen.has(a.ticker)) continue;
    seen.add(a.ticker);
    try {
      upserts.push({ ticker: a.ticker, ...(await marketQuote(a.ticker, a.asset_class)) });
      refreshed.push(a.ticker);
    } catch (e) {
      errors.push({ ticker: a.ticker, error: (e as Error).message });
    }
    if (seen.size < marketAssets.length) await sleep(250);
  }

  if (upserts.length > 0) {
    const { error: upErr } = await db.from("investment_quotes").upsert(upserts, { onConflict: "ticker" });
    if (upErr) {
      console.error("[quotes] upsert cache", upErr);
      return json(500, { error: "Falha ao gravar o cache de cotações" });
    }
  }

  // Proventos automaticos: pra cada ativo com dividendos no historico, cria os lancamentos
  // que faltam (dedupe por external_key; o que o usuario editou/ignorou fica como esta).
  const { data: allQuotes } = await db.from("investment_quotes").select("*").in("ticker", tickers);
  const quotesByTicker = new Map((allQuotes ?? []).map((r) => [r.ticker, r]));
  const { data: txRows } = await db
    .from("investment_transactions")
    .select("id, asset_id, kind, date, quantity, unit_price, total, ignored, source, external_key")
    .eq("user_id", userId);
  const txs: InvestmentTx[] = (txRows ?? []).map((t) => ({
    id: t.id,
    assetId: t.asset_id,
    kind: t.kind as InvestmentTx["kind"],
    date: t.date,
    quantity: Number(t.quantity),
    unitPrice: Number(t.unit_price),
    total: Number(t.total),
    notes: null,
    source: t.source as InvestmentTx["source"],
    externalKey: t.external_key,
    ignored: t.ignored,
  }));

  const existingKeys = new Set(txs.map((t) => t.externalKey).filter(Boolean));
  const dividendInserts: Database["public"]["Tables"]["investment_transactions"]["Insert"][] = [];
  for (const a of list) {
    const quote = quotesByTicker.get(a.ticker);
    const dividends = (quote?.dividends as unknown as QuoteDividend[] | null) ?? [];
    if (dividends.length === 0) continue;
    const own = txs.filter((t) => t.assetId === a.id);
    for (const row of autoDividendRows(a.ticker, own, dividends)) {
      if (existingKeys.has(row.externalKey)) continue;
      dividendInserts.push({
        user_id: userId,
        asset_id: a.id,
        kind: "dividend",
        date: row.date,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        total: row.total,
        source: "auto",
        external_key: row.externalKey,
        notes: "Provento calculado automaticamente (Yahoo × quantidade na data-com)",
      });
    }
  }
  let dividendsCreated = 0;
  if (dividendInserts.length > 0) {
    const { error: divErr } = await db
      .from("investment_transactions")
      .upsert(dividendInserts, { onConflict: "user_id,external_key", ignoreDuplicates: true });
    if (divErr) console.error("[quotes] proventos automaticos", divErr);
    else dividendsCreated = dividendInserts.length;
  }

  return json(200, {
    ok: true,
    quotes: allQuotes ?? [],
    refreshed,
    errors,
    dividendsCreated,
  });
}
