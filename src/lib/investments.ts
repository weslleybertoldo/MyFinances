// Calculos puros da aba Investimentos.
//
// Isomorfico: o app (hooks/paginas) e a function `api/quotes` importam daqui.
// Nada de React/Supabase — so tipos e aritmetica, pra ser testavel com fixture.
//
// Definicoes (explicitas, porque cada corretora/site usa uma):
//   - preco medio      = custo total das compras / quantidade (venda sai a preco medio, nao muda o PM)
//   - valor investido  = quantidade atual x preco medio (custo da posicao que ainda esta na carteira)
//   - ganho de capital = valor atual - valor investido
//   - proventos        = soma dos lancamentos tipo dividend (automaticos + manuais, nao ignorados)
//   - lucro total      = ganho de capital + proventos
//   - rentabilidade    = lucro total / valor investido
//   - % ideal do ativo = meta da classe x (nota do ativo / soma das notas da classe)

export type AssetClass = "acao" | "fii" | "etf" | "tesouro";
export type TxKind = "buy" | "sell" | "dividend";

export const ASSET_CLASSES: AssetClass[] = ["acao", "fii", "etf", "tesouro"];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  acao: "Ações",
  fii: "FIIs",
  etf: "ETFs",
  tesouro: "Tesouro Direto",
};

export const DEFAULT_CLASS_TARGET = 25;

export interface Asset {
  id: string;
  ticker: string;
  name: string | null;
  assetClass: AssetClass;
  /** Nota 0-10 usada no rebalanceamento (% ideal). */
  score: number;
  tesouroTipo: string | null;
  /** ISO yyyy-mm-dd */
  tesouroVencimento: string | null;
}

export interface InvestmentTx {
  id: string;
  assetId: string;
  kind: TxKind;
  /** ISO yyyy-mm-dd */
  date: string;
  quantity: number;
  unitPrice: number;
  /** Compra/venda: valor total da operacao (com taxas). Provento: valor recebido. */
  total: number;
  notes: string | null;
  source: "manual" | "auto";
  externalKey: string | null;
  ignored: boolean;
}

export interface QuotePoint {
  /** ISO yyyy-mm-dd (barra mensal: qualquer dia do mes) */
  date: string;
  close: number;
}

export interface QuoteDividend {
  /** Data ex (primeiro dia SEM direito). Quem tinha o papel no dia anterior recebe. */
  date: string;
  /** Valor por cota/acao. */
  amount: number;
}

export interface Quote {
  ticker: string;
  name: string | null;
  price: number | null;
  priceAt: string | null;
  /** Variacao do dia em % (ex.: 0.495 = +0,495%). */
  changePct: number | null;
  source: string | null;
  history: QuotePoint[];
  dividends: QuoteDividend[];
  error: string | null;
  updatedAt: string | null;
}

export type QuoteMap = Record<string, Quote | undefined>;
export type ClassTargets = Record<AssetClass, number>;

// ---------------------------------------------------------------- tickers do Tesouro

const TD_PREFIX = "TD:";

export function isTesouroTicker(ticker: string): boolean {
  return ticker.startsWith(TD_PREFIX);
}

/** Ticker sintetico do titulo: `TD:<tipo>:<vencimento ISO>` (ex.: TD:Tesouro Selic:2029-03-01). */
export function tesouroTicker(tipo: string, vencimentoIso: string): string {
  return `${TD_PREFIX}${tipo.trim()}:${vencimentoIso}`;
}

export function parseTesouroTicker(ticker: string): { tipo: string; vencimento: string } | null {
  if (!isTesouroTicker(ticker)) return null;
  const rest = ticker.slice(TD_PREFIX.length);
  const idx = rest.lastIndexOf(":");
  if (idx < 0) return null;
  return { tipo: rest.slice(0, idx), vencimento: rest.slice(idx + 1) };
}

/** Nome curto pra tela: "BBSE3" ou "Tesouro Selic 2029". */
export function assetDisplayName(asset: Pick<Asset, "ticker" | "tesouroTipo" | "tesouroVencimento">): string {
  if (isTesouroTicker(asset.ticker)) {
    const parsed = parseTesouroTicker(asset.ticker);
    const tipo = asset.tesouroTipo ?? parsed?.tipo ?? "Tesouro";
    const venc = asset.tesouroVencimento ?? parsed?.vencimento ?? "";
    return venc ? `${tipo} ${venc.slice(0, 4)}` : tipo;
  }
  return asset.ticker;
}

// ---------------------------------------------------------------- datas

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, lastDay));
  return dt.toISOString().slice(0, 10);
}

/** "2026-09-14" -> "2026-09" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Ultimo dia do mes da chave ("2026-09" -> "2026-09-30"). */
export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key}-${String(last).padStart(2, "0")}`;
}

/** "2026-09" -> "09/26" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${m}/${y.slice(2)}`;
}

/** Chaves dos ultimos `n` meses terminando no mes de `today` (ordem cronologica). */
export function lastMonthKeys(n: number, today: string): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(monthKey(addMonths(`${monthKey(today)}-01`, -i)));
  return keys;
}

// ---------------------------------------------------------------- posicao

export interface Position {
  quantity: number;
  avgPrice: number;
  /** quantidade x preco medio */
  invested: number;
  /** resultado realizado em vendas (preco de venda - preco medio) */
  realized: number;
}

const EPS = 1e-9;

function byDate(a: InvestmentTx, b: InvestmentTx): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  // mesma data: compra antes de venda, pra venda nunca ficar negativa por ordem de digitacao
  if (a.kind !== b.kind) return a.kind === "buy" ? -1 : 1;
  return 0;
}

/**
 * Posicao (quantidade e preco medio) considerando compras/vendas ate `until` (inclusive).
 * Venda sai a preco medio: nao altera o PM, gera resultado realizado.
 */
export function positionAt(txs: InvestmentTx[], until?: string): Position {
  const ops = txs
    .filter((t) => !t.ignored && (t.kind === "buy" || t.kind === "sell") && (!until || t.date <= until))
    .sort(byDate);

  let qty = 0;
  let cost = 0;
  let realized = 0;
  for (const t of ops) {
    if (t.kind === "buy") {
      qty += t.quantity;
      cost += t.total;
    } else {
      const avg = qty > EPS ? cost / qty : 0;
      const sold = Math.min(t.quantity, qty);
      realized += t.total - sold * avg;
      qty -= sold;
      cost -= sold * avg;
    }
    if (qty <= EPS) {
      qty = 0;
      cost = 0;
    }
  }
  const avgPrice = qty > EPS ? cost / qty : 0;
  return { quantity: qty, avgPrice, invested: qty * avgPrice, realized };
}

// ---------------------------------------------------------------- cotacao

/** Fechamento do mes `key` no historico (ultimo ponto daquele mes) ou null. */
export function closeForMonth(quote: Quote | undefined, key: string): number | null {
  if (!quote) return null;
  let found: number | null = null;
  for (const p of quote.history) {
    if (monthKey(p.date) === key && Number.isFinite(p.close)) found = p.close;
  }
  return found;
}

/** Preco atual do ativo: cotacao > ultimo fechamento conhecido > null. */
export function currentPrice(quote: Quote | undefined): number | null {
  if (!quote) return null;
  if (quote.price != null && Number.isFinite(quote.price)) return quote.price;
  for (let i = quote.history.length - 1; i >= 0; i--) {
    const c = quote.history[i].close;
    if (Number.isFinite(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------- resumo por ativo

export interface AssetSummary {
  asset: Asset;
  quantity: number;
  avgPrice: number;
  invested: number;
  /** null = sem cotacao (valor atual assume o investido) */
  price: number | null;
  currentValue: number;
  capitalGain: number;
  /** ganho de capital / investido, em % */
  capitalGainPct: number | null;
  dividends: number;
  dividends12m: number;
  totalReturn: number;
  totalReturnPct: number | null;
  /** variacao do dia (%) vinda da cotacao */
  dayChangePct: number | null;
  /** % do patrimonio total */
  sharePct: number;
  /** % ideal = meta da classe x nota / soma das notas da classe */
  idealPct: number;
}

function pct(part: number, base: number): number | null {
  return base > EPS ? (part / base) * 100 : null;
}

export function normalizeTargets(partial: Partial<ClassTargets> | undefined): ClassTargets {
  const out = {} as ClassTargets;
  for (const c of ASSET_CLASSES) {
    const v = partial?.[c];
    out[c] = v != null && Number.isFinite(v) ? v : DEFAULT_CLASS_TARGET;
  }
  return out;
}

/**
 * Resumo de cada ativo da carteira. Ativos zerados (venderam tudo) saem da lista,
 * a menos que `keepEmpty` (usado na tela de lancamentos).
 */
export function summarizeAssets(
  assets: Asset[],
  txs: InvestmentTx[],
  quotes: QuoteMap,
  targets: ClassTargets,
  today: string,
  keepEmpty = false
): AssetSummary[] {
  const since12m = addMonths(today, -12);
  const base = assets.map((asset) => {
    const own = txs.filter((t) => t.assetId === asset.id && !t.ignored);
    const pos = positionAt(own);
    const quote = quotes[asset.ticker];
    const price = currentPrice(quote);
    const currentValue = price != null ? pos.quantity * price : pos.invested;
    const capitalGain = currentValue - pos.invested;
    const divs = own.filter((t) => t.kind === "dividend");
    const dividends = divs.reduce((s, t) => s + t.total, 0);
    const dividends12m = divs.filter((t) => t.date > since12m).reduce((s, t) => s + t.total, 0);
    const totalReturn = capitalGain + dividends;
    return {
      asset,
      quantity: pos.quantity,
      avgPrice: pos.avgPrice,
      invested: pos.invested,
      price,
      currentValue,
      capitalGain,
      capitalGainPct: pct(capitalGain, pos.invested),
      dividends,
      dividends12m,
      totalReturn,
      totalReturnPct: pct(totalReturn, pos.invested),
      dayChangePct: quote?.changePct ?? null,
      sharePct: 0,
      idealPct: 0,
      hasTx: own.length > 0,
    };
  });

  const active = base.filter((s) => s.quantity > EPS || (keepEmpty && s.hasTx));
  const total = active.reduce((s, a) => s + (a.quantity > EPS ? a.currentValue : 0), 0);
  const scoreByClass: Record<string, number> = {};
  for (const s of active) {
    if (s.quantity > EPS) scoreByClass[s.asset.assetClass] = (scoreByClass[s.asset.assetClass] ?? 0) + s.asset.score;
  }

  return active.map(({ hasTx: _hasTx, ...s }) => {
    const classScore = scoreByClass[s.asset.assetClass] ?? 0;
    return {
      ...s,
      sharePct: total > EPS && s.quantity > EPS ? (s.currentValue / total) * 100 : 0,
      idealPct: classScore > 0 && s.quantity > EPS ? (targets[s.asset.assetClass] * s.asset.score) / classScore : 0,
    };
  });
}

// ---------------------------------------------------------------- resumo por classe

export interface ClassSummary {
  assetClass: AssetClass;
  label: string;
  count: number;
  value: number;
  invested: number;
  /** ganho de capital / investido (%) */
  variationPct: number | null;
  /** (ganho de capital + proventos) / investido (%) */
  returnPct: number | null;
  sharePct: number;
  targetPct: number;
}

export function summarizeClasses(summaries: AssetSummary[], targets: ClassTargets): ClassSummary[] {
  const total = summaries.reduce((s, a) => s + a.currentValue, 0);
  return ASSET_CLASSES.map((c) => {
    const items = summaries.filter((s) => s.asset.assetClass === c && s.quantity > EPS);
    const value = items.reduce((s, a) => s + a.currentValue, 0);
    const invested = items.reduce((s, a) => s + a.invested, 0);
    const gain = items.reduce((s, a) => s + a.capitalGain, 0);
    const ret = items.reduce((s, a) => s + a.totalReturn, 0);
    return {
      assetClass: c,
      label: ASSET_CLASS_LABEL[c],
      count: items.length,
      value,
      invested,
      variationPct: pct(gain, invested),
      returnPct: pct(ret, invested),
      sharePct: total > EPS ? (value / total) * 100 : 0,
      targetPct: targets[c],
    };
  });
}

// ---------------------------------------------------------------- evolucao mensal

export interface EvolutionPoint {
  month: string;
  label: string;
  /** custo das posicoes abertas no fim do mes */
  invested: number;
  /** valor de mercado no fim do mes (mes atual = cotacao de agora) */
  marketValue: number;
  capitalGain: number;
}

/**
 * Evolucao mensal da carteira (ultimos `months` meses, so a partir do 1o lancamento).
 * Fechamento do mes vem do historico da cotacao; mes corrente usa o preco atual;
 * sem cotacao pro mes, usa o ultimo preco conhecido anterior (ou o preco medio).
 */
export function evolution(
  assets: Asset[],
  txs: InvestmentTx[],
  quotes: QuoteMap,
  months: number,
  today: string,
  classFilter: AssetClass | "all" = "all"
): EvolutionPoint[] {
  const scoped = classFilter === "all" ? assets : assets.filter((a) => a.assetClass === classFilter);
  const scopedIds = new Set(scoped.map((a) => a.id));
  const ops = txs.filter((t) => scopedIds.has(t.assetId) && !t.ignored && t.kind !== "dividend");
  if (ops.length === 0) return [];
  const firstMonth = monthKey(ops.reduce((min, t) => (t.date < min ? t.date : min), ops[0].date));
  const currentMonth = monthKey(today);

  const keys = lastMonthKeys(months, today).filter((k) => k >= firstMonth);
  return keys.map((key) => {
    const until = key === currentMonth ? today : monthEnd(key);
    let invested = 0;
    let marketValue = 0;
    for (const asset of scoped) {
      const pos = positionAt(ops.filter((t) => t.assetId === asset.id), until);
      if (pos.quantity <= EPS) continue;
      invested += pos.invested;
      const quote = quotes[asset.ticker];
      let close: number | null = key === currentMonth ? currentPrice(quote) : closeForMonth(quote, key);
      if (close == null && quote) {
        // ultimo fechamento ANTES do mes (historico com buraco)
        for (const p of quote.history) {
          if (monthKey(p.date) < key && Number.isFinite(p.close)) close = p.close;
        }
      }
      marketValue += pos.quantity * (close ?? pos.avgPrice);
    }
    return { month: key, label: monthLabel(key), invested, marketValue, capitalGain: marketValue - invested };
  });
}

// ---------------------------------------------------------------- totais

export interface PortfolioTotals {
  total: number;
  invested: number;
  capitalGain: number;
  capitalGainPct: number | null;
  dividends: number;
  dividends12m: number;
  totalReturn: number;
  totalReturnPct: number | null;
  /** rentabilidade dos ultimos 12 meses (Dietz simplificado: fluxos de caixa sem ponderar no tempo) */
  return12mPct: number | null;
}

export function portfolioTotals(
  summaries: AssetSummary[],
  assets: Asset[],
  txs: InvestmentTx[],
  quotes: QuoteMap,
  today: string
): PortfolioTotals {
  const open = summaries.filter((s) => s.quantity > EPS);
  const total = open.reduce((s, a) => s + a.currentValue, 0);
  const invested = open.reduce((s, a) => s + a.invested, 0);
  const capitalGain = total - invested;
  const dividends = summaries.reduce((s, a) => s + a.dividends, 0);
  const dividends12m = summaries.reduce((s, a) => s + a.dividends12m, 0);
  const totalReturn = capitalGain + dividends;

  // 12M: V0 = valor de mercado no fim do mes de 12 meses atras; fluxos = aportes - resgates depois disso
  const startKey = monthKey(addMonths(today, -12));
  const ev = evolution(assets, txs, quotes, 13, today);
  const startPoint = ev.find((p) => p.month === startKey);
  const v0 = startPoint?.marketValue ?? 0;
  const since = monthEnd(startKey);
  const flows = txs
    .filter((t) => !t.ignored && t.date > since && t.kind !== "dividend")
    .reduce((s, t) => s + (t.kind === "buy" ? t.total : -t.total), 0);
  const denom = v0 + flows;
  const return12mPct = denom > EPS ? ((total - v0 - flows + dividends12m) / denom) * 100 : null;

  return {
    total,
    invested,
    capitalGain,
    capitalGainPct: pct(capitalGain, invested),
    dividends,
    dividends12m,
    totalReturn,
    totalReturnPct: pct(totalReturn, invested),
    return12mPct,
  };
}

// ---------------------------------------------------------------- proventos automaticos

export interface AutoDividendRow {
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
  externalKey: string;
}

/**
 * Proventos que o usuario tinha direito, a partir do historico de dividendos da cotacao:
 * pra cada data ex, quantidade em carteira no dia anterior x valor por cota.
 * `externalKey` = ticker|data-ex (dedupe: upsert ignora o que ja existe, preservando edicao manual).
 */
export function autoDividendRows(ticker: string, txs: InvestmentTx[], dividends: QuoteDividend[]): AutoDividendRow[] {
  const rows: AutoDividendRow[] = [];
  for (const d of dividends) {
    if (!d.date || !Number.isFinite(d.amount) || d.amount <= 0) continue;
    const pos = positionAt(txs, addDays(d.date, -1));
    if (pos.quantity <= EPS) continue;
    const total = Math.round(pos.quantity * d.amount * 100) / 100;
    if (total <= 0) continue;
    rows.push({
      date: d.date,
      quantity: pos.quantity,
      unitPrice: d.amount,
      total,
      externalKey: `${ticker}|${d.date}`,
    });
  }
  return rows;
}

// ---------------------------------------------------------------- formatacao

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatQuantity(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: 8 });
}
