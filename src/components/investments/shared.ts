import type { AssetClass, TxKind } from "@/lib/investments";

/** Cores fixas por classe (pizza, legendas, cards). */
export const CLASS_COLORS: Record<AssetClass, string> = {
  acao: "#3B82F6",
  fii: "#22C55E",
  etf: "#A855F7",
  tesouro: "#F59E0B",
};

export const KIND_LABEL: Record<TxKind, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Provento",
};

/** Classe utilitaria de cor pra um percentual (verde/vermelho/neutro). */
export function pctColor(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.005) return "text-muted-foreground";
  return value > 0 ? "text-success" : "text-destructive";
}

export function signed(value: number | null | undefined, formatted: string): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return formatted;
  return `+${formatted}`;
}

/** Cores pra fatias por ativo (varia a partir da cor da classe). */
export function shadeFor(base: string, index: number, total: number): string {
  if (total <= 1) return base;
  const amount = Math.round((index / Math.max(1, total - 1)) * 70 - 35); // -35..+35
  const n = parseInt(base.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
