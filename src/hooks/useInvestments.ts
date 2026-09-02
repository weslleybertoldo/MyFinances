import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/lib/database.types";
import {
  normalizeTargets,
  type Asset,
  type AssetClass,
  type ClassTargets,
  type InvestmentTx,
  type Quote,
  type QuoteDividend,
  type QuoteMap,
  type QuotePoint,
  type TxKind,
} from "@/lib/investments";

// No APK nao existe backend no localhost do Capacitor — URL relativa devolvia o
// index.html. Nativo chama a prod direto (mesmo padrao da aba Bancos).
const API_BASE = Capacitor.isNativePlatform() ? "https://myfinances-app.vercel.app" : "";

type AssetRow = Database["public"]["Tables"]["investment_assets"]["Row"];
type TxRow = Database["public"]["Tables"]["investment_transactions"]["Row"];
type QuoteRow = Database["public"]["Tables"]["investment_quotes"]["Row"];

const KEYS = {
  assets: "investment_assets",
  txs: "investment_transactions",
  quotes: "investment_quotes",
  targets: "investment_class_targets",
  sync: "investment_quotes_sync",
} as const;

// ---------------------------------------------------------------- mappers

function rowToAsset(r: AssetRow): Asset {
  return {
    id: r.id,
    ticker: r.ticker,
    name: r.name,
    assetClass: r.asset_class as AssetClass,
    score: Number(r.score),
    tesouroTipo: r.tesouro_tipo,
    tesouroVencimento: r.tesouro_vencimento,
  };
}

function rowToTx(r: TxRow): InvestmentTx {
  return {
    id: r.id,
    assetId: r.asset_id,
    kind: r.kind as TxKind,
    date: r.date,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    total: Number(r.total),
    notes: r.notes,
    source: r.source as InvestmentTx["source"],
    externalKey: r.external_key,
    ignored: r.ignored,
  };
}

function rowToQuote(r: QuoteRow): Quote {
  return {
    ticker: r.ticker,
    name: r.name,
    price: r.price == null ? null : Number(r.price),
    priceAt: r.price_at,
    changePct: r.change_pct == null ? null : Number(r.change_pct),
    source: r.source,
    history: (Array.isArray(r.history) ? r.history : []) as unknown as QuotePoint[],
    dividends: (Array.isArray(r.dividends) ? r.dividends : []) as unknown as QuoteDividend[],
    error: r.error,
    updatedAt: r.updated_at,
  };
}

// ---------------------------------------------------------------- API (function api/quotes)

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("sessão expirada — entre de novo");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${session.access_token}` },
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string; ok?: boolean }) | null;
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  if (!body || body.ok === false) throw new Error(body?.error ?? "resposta inesperada do servidor");
  return body;
}

export interface SyncResult {
  refreshed: string[];
  errors: Array<{ ticker: string; error: string }>;
  dividendsCreated: number;
}

export interface SearchHit {
  ticker: string;
  name: string;
  assetClass: "acao" | "fii" | "etf";
}

export interface TesouroCatalogItem {
  tipo: string;
  vencimento: string;
  pu: number;
}

// ---------------------------------------------------------------- queries

export function useInvestmentAssets() {
  const { user } = useAuth();
  return useQuery<Asset[]>({
    queryKey: [KEYS.assets, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map(rowToAsset);
    },
  });
}

export function useInvestmentTransactions() {
  const { user } = useAuth();
  return useQuery<InvestmentTx[]>({
    queryKey: [KEYS.txs, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToTx);
    },
  });
}

export function useInvestmentQuotes(tickers: string[]) {
  const { user } = useAuth();
  const sorted = [...new Set(tickers)].sort();
  return useQuery<QuoteMap>({
    queryKey: [KEYS.quotes, user?.id, sorted.join(",")],
    enabled: !!user && sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("investment_quotes").select("*").in("ticker", sorted);
      if (error) throw error;
      const map: QuoteMap = {};
      for (const r of data ?? []) map[r.ticker] = rowToQuote(r);
      return map;
    },
  });
}

export function useClassTargets() {
  const { user } = useAuth();
  return useQuery<ClassTargets>({
    queryKey: [KEYS.targets, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_class_targets")
        .select("asset_class, target_pct")
        .eq("user_id", user!.id);
      if (error) throw error;
      const partial: Partial<ClassTargets> = {};
      for (const r of data ?? []) partial[r.asset_class as AssetClass] = Number(r.target_pct);
      return normalizeTargets(partial);
    },
  });
}

/**
 * Sincroniza o cache de cotacoes ao abrir a aba: a function decide o que esta velho
 * (>60 min; Tesouro >12 h) e cria os proventos automaticos que faltarem.
 * Roda 1x por sessao/30 min por conjunto de tickers; o botao "Atualizar" forca.
 */
export function useQuotesSync(tickers: string[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [...new Set(tickers)].sort().join(",");
  return useQuery<SyncResult>({
    queryKey: [KEYS.sync, user?.id, key],
    enabled: !!user && key.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const body = await apiFetch<SyncResult>("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (body.refreshed.length > 0) qc.invalidateQueries({ queryKey: [KEYS.quotes] });
      if (body.dividendsCreated > 0) qc.invalidateQueries({ queryKey: [KEYS.txs] });
      return body;
    },
  });
}

export function useRefreshQuotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiFetch<SyncResult>("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEYS.quotes] });
      qc.invalidateQueries({ queryKey: [KEYS.txs] });
      qc.invalidateQueries({ queryKey: [KEYS.sync] });
    },
  });
}

export function useSearchTickers(query: string) {
  const q = query.trim();
  return useQuery<SearchHit[]>({
    queryKey: ["investment_ticker_search", q.toUpperCase()],
    enabled: q.length >= 2,
    staleTime: 10 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      const body = await apiFetch<{ results: SearchHit[] }>(`/api/quotes?search=${encodeURIComponent(q)}`);
      return body.results;
    },
  });
}

export function useTesouroCatalog(enabled: boolean) {
  return useQuery<{ date: string | null; items: TesouroCatalogItem[] }>({
    queryKey: ["investment_tesouro_catalog"],
    enabled,
    staleTime: 60 * 60 * 1000,
    retry: 0,
    queryFn: async () => apiFetch<{ date: string | null; items: TesouroCatalogItem[] }>("/api/quotes?tesouro=1"),
  });
}

// ---------------------------------------------------------------- mutations

export interface AssetInput {
  ticker: string;
  name?: string | null;
  assetClass: AssetClass;
  score?: number;
  tesouroTipo?: string | null;
  tesouroVencimento?: string | null;
}

/** Cria o ativo se nao existir (chave user_id+ticker) e devolve o id. */
export function useUpsertAsset() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssetInput): Promise<string> => {
      const { data, error } = await supabase
        .from("investment_assets")
        .upsert(
          {
            user_id: user!.id,
            ticker: input.ticker.trim().toUpperCase().startsWith("TD:") ? input.ticker.trim() : input.ticker.trim().toUpperCase(),
            name: input.name ?? null,
            asset_class: input.assetClass,
            score: input.score ?? 10,
            tesouro_tipo: input.tesouroTipo ?? null,
            tesouro_vencimento: input.tesouroVencimento ?? null,
          },
          { onConflict: "user_id,ticker" }
        )
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEYS.assets] });
      qc.invalidateQueries({ queryKey: [KEYS.sync] });
    },
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; score?: number; name?: string | null; assetClass?: AssetClass }) => {
      const clean: Database["public"]["Tables"]["investment_assets"]["Update"] = {};
      if (updates.score !== undefined) clean.score = Math.max(0, Math.min(10, Math.round(updates.score)));
      if (updates.name !== undefined) clean.name = updates.name;
      if (updates.assetClass !== undefined) clean.asset_class = updates.assetClass;
      const { error } = await supabase.from("investment_assets").update(clean).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS.assets] }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investment_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEYS.assets] });
      qc.invalidateQueries({ queryKey: [KEYS.txs] });
    },
  });
}

export interface TxInput {
  assetId: string;
  kind: TxKind;
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
}

export function useAddTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TxInput) => {
      const { error } = await supabase.from("investment_transactions").insert({
        user_id: user!.id,
        asset_id: input.assetId,
        kind: input.kind,
        date: input.date,
        quantity: Math.abs(input.quantity),
        unit_price: Math.abs(input.unitPrice),
        total: Math.abs(input.total),
        notes: input.notes ?? null,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEYS.txs] });
      qc.invalidateQueries({ queryKey: [KEYS.sync] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<TxInput, "assetId">>) => {
      const clean: Database["public"]["Tables"]["investment_transactions"]["Update"] = {};
      if (updates.kind !== undefined) clean.kind = updates.kind;
      if (updates.date !== undefined) clean.date = updates.date;
      if (updates.quantity !== undefined) clean.quantity = Math.abs(updates.quantity);
      if (updates.unitPrice !== undefined) clean.unit_price = Math.abs(updates.unitPrice);
      if (updates.total !== undefined) clean.total = Math.abs(updates.total);
      if (updates.notes !== undefined) clean.notes = updates.notes;
      const { error } = await supabase.from("investment_transactions").update(clean).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS.txs] }),
  });
}

/** Manual: apaga. Automatico (provento): marca `ignored` pra sincronizacao nao recriar. */
export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Pick<InvestmentTx, "id" | "source">) => {
      const query =
        tx.source === "auto"
          ? supabase.from("investment_transactions").update({ ignored: true }).eq("id", tx.id)
          : supabase.from("investment_transactions").delete().eq("id", tx.id);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS.txs] }),
  });
}

export function useSetClassTarget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assetClass, targetPct }: { assetClass: AssetClass; targetPct: number }) => {
      const { error } = await supabase
        .from("investment_class_targets")
        .upsert({ user_id: user!.id, asset_class: assetClass, target_pct: Math.max(0, Math.min(100, targetPct)) }, { onConflict: "user_id,asset_class" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEYS.targets] }),
  });
}
