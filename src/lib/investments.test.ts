import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  assetDisplayName,
  autoDividendRows,
  evolution,
  lastMonthKeys,
  monthEnd,
  normalizeTargets,
  parseTesouroTicker,
  portfolioTotals,
  positionAt,
  summarizeAssets,
  summarizeClasses,
  tesouroTicker,
  type Asset,
  type InvestmentTx,
  type QuoteMap,
} from "./investments";

// Fixture = carteira real do print do Investidor10 (01/09/2026):
//   BBSE3 2 x 39,03 (atual 40,47) · TAEE11 2 x 35,21 (39,80) · ABEV3 3 x 14,26 (15,24)
//   + 2 FIIs somando ~R$ 90 investidos e R$ 87,80 atuais.
const TODAY = "2026-09-01";

const assets: Asset[] = [
  { id: "a1", ticker: "BBSE3", name: "BB Seguridade", assetClass: "acao", score: 10, tesouroTipo: null, tesouroVencimento: null },
  { id: "a2", ticker: "TAEE11", name: "Taesa", assetClass: "acao", score: 10, tesouroTipo: null, tesouroVencimento: null },
  { id: "a3", ticker: "ABEV3", name: "Ambev", assetClass: "acao", score: 10, tesouroTipo: null, tesouroVencimento: null },
  { id: "f1", ticker: "MXRF11", name: "Maxi Renda", assetClass: "fii", score: 10, tesouroTipo: null, tesouroVencimento: null },
  { id: "f2", ticker: "XPLG11", name: "XP Log", assetClass: "fii", score: 5, tesouroTipo: null, tesouroVencimento: null },
];

function buy(id: string, assetId: string, date: string, quantity: number, unitPrice: number): InvestmentTx {
  return { id, assetId, kind: "buy", date, quantity, unitPrice, total: +(quantity * unitPrice).toFixed(2), notes: null, source: "manual", externalKey: null, ignored: false };
}

const txs: InvestmentTx[] = [
  buy("t1", "a1", "2026-08-05", 2, 39.03),
  buy("t2", "a2", "2026-08-05", 2, 35.21),
  buy("t3", "a3", "2026-08-05", 3, 14.26),
  buy("t4", "f1", "2026-08-05", 5, 10.0),
  buy("t5", "f2", "2026-08-05", 4, 10.01),
  // provento automatico do MXRF11 (ex 2026-08-29)
  { id: "d1", assetId: "f1", kind: "dividend", date: "2026-08-29", quantity: 5, unitPrice: 0.1, total: 0.5, notes: null, source: "auto", externalKey: "MXRF11|2026-08-29", ignored: false },
];

const quotes: QuoteMap = {
  BBSE3: { ticker: "BBSE3", name: null, price: 40.47, priceAt: null, changePct: 0.17, source: "b3", history: [{ date: "2026-08-01", close: 40.4 }], dividends: [], error: null, updatedAt: null },
  TAEE11: { ticker: "TAEE11", name: null, price: 39.8, priceAt: null, changePct: 1.79, source: "b3", history: [{ date: "2026-08-01", close: 39.1 }], dividends: [], error: null, updatedAt: null },
  ABEV3: { ticker: "ABEV3", name: null, price: 15.24, priceAt: null, changePct: 1.4, source: "b3", history: [{ date: "2026-08-01", close: 15.03 }], dividends: [], error: null, updatedAt: null },
  MXRF11: { ticker: "MXRF11", name: null, price: 9.21, priceAt: null, changePct: 0.33, source: "b3", history: [{ date: "2026-08-01", close: 9.28 }], dividends: [{ date: "2026-08-29", amount: 0.1 }], error: null, updatedAt: null },
  XPLG11: { ticker: "XPLG11", name: null, price: 10.44, priceAt: null, changePct: 0, source: "b3", history: [], dividends: [], error: null, updatedAt: null },
};

const targets = normalizeTargets({});

describe("positionAt", () => {
  it("preco medio ponderado nas compras; venda sai a PM e gera realizado", () => {
    const ops: InvestmentTx[] = [
      buy("1", "x", "2026-01-10", 10, 10),
      buy("2", "x", "2026-02-10", 10, 20),
      { ...buy("3", "x", "2026-03-10", 5, 30), kind: "sell" },
    ];
    const pos = positionAt(ops);
    expect(pos.quantity).toBe(15);
    expect(pos.avgPrice).toBeCloseTo(15, 6);
    expect(pos.invested).toBeCloseTo(225, 6);
    expect(pos.realized).toBeCloseTo(75, 6); // (30-15)*5
  });

  it("respeita a data limite e ignora lancamentos ignorados/proventos", () => {
    const ops: InvestmentTx[] = [
      buy("1", "x", "2026-01-10", 10, 10),
      { ...buy("2", "x", "2026-02-10", 10, 20), ignored: true },
      { ...buy("3", "x", "2026-02-15", 1, 1), kind: "dividend" },
      buy("4", "x", "2026-03-01", 5, 12),
    ];
    expect(positionAt(ops, "2026-02-28").quantity).toBe(10);
    expect(positionAt(ops).quantity).toBe(15);
  });

  it("zerar a posicao zera o custo (nao sobra residuo de float)", () => {
    const ops: InvestmentTx[] = [buy("1", "x", "2026-01-10", 3, 10.1), { ...buy("2", "x", "2026-01-11", 3, 11), kind: "sell" }];
    const pos = positionAt(ops);
    expect(pos.quantity).toBe(0);
    expect(pos.invested).toBe(0);
    expect(pos.avgPrice).toBe(0);
  });
});

describe("summarizeAssets — numeros do Investidor10", () => {
  const s = summarizeAssets(assets, txs, quotes, targets, TODAY);
  const byTicker = Object.fromEntries(s.map((x) => [x.asset.ticker, x]));

  it("valor investido e saldo por ativo", () => {
    expect(byTicker.BBSE3.invested).toBeCloseTo(78.06, 2);
    expect(byTicker.BBSE3.currentValue).toBeCloseTo(80.94, 2);
    expect(byTicker.TAEE11.currentValue).toBeCloseTo(79.6, 2);
    expect(byTicker.ABEV3.currentValue).toBeCloseTo(45.72, 2);
  });

  it("variacao = preco atual vs preco medio", () => {
    expect(byTicker.BBSE3.capitalGainPct).toBeCloseTo(((40.47 - 39.03) / 39.03) * 100, 6);
  });

  it("% ideal = meta da classe x nota / soma das notas (3 acoes nota 10 -> 8,33%)", () => {
    expect(byTicker.BBSE3.idealPct).toBeCloseTo(8.3333, 3);
    // FIIs: notas 10 e 5 -> 16,67% e 8,33%
    expect(byTicker.MXRF11.idealPct).toBeCloseTo(16.6667, 3);
    expect(byTicker.XPLG11.idealPct).toBeCloseTo(8.3333, 3);
  });

  it("% na carteira soma 100", () => {
    const sum = s.reduce((acc, x) => acc + x.sharePct, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it("proventos entram na rentabilidade, nao no ganho de capital", () => {
    const m = byTicker.MXRF11;
    expect(m.dividends).toBeCloseTo(0.5, 6);
    expect(m.capitalGain).toBeCloseTo(5 * 9.21 - 50, 6);
    expect(m.totalReturn).toBeCloseTo(5 * 9.21 - 50 + 0.5, 6);
  });

  it("ativo sem cotacao assume valor investido e price null", () => {
    const s2 = summarizeAssets(assets, txs, {}, targets, TODAY);
    const b = s2.find((x) => x.asset.ticker === "BBSE3")!;
    expect(b.price).toBeNull();
    expect(b.currentValue).toBeCloseTo(78.06, 2);
    expect(b.capitalGain).toBeCloseTo(0, 6);
  });

  it("ativo vendido por completo sai da carteira (a menos que keepEmpty)", () => {
    const sold = [...txs, { ...buy("s", "a3", "2026-08-20", 3, 15), kind: "sell" as const }];
    expect(summarizeAssets(assets, sold, quotes, targets, TODAY).map((x) => x.asset.ticker)).not.toContain("ABEV3");
    expect(summarizeAssets(assets, sold, quotes, targets, TODAY, true).map((x) => x.asset.ticker)).toContain("ABEV3");
  });
});

describe("summarizeClasses", () => {
  it("agrupa por classe com contagem, valor, variacao e % vs meta", () => {
    const s = summarizeAssets(assets, txs, quotes, targets, TODAY);
    const c = summarizeClasses(s, targets);
    const acoes = c.find((x) => x.assetClass === "acao")!;
    expect(acoes.count).toBe(3);
    expect(acoes.value).toBeCloseTo(80.94 + 79.6 + 45.72, 2);
    expect(acoes.invested).toBeCloseTo(78.06 + 70.42 + 42.78, 2);
    expect(acoes.targetPct).toBe(25);
    const etf = c.find((x) => x.assetClass === "etf")!;
    expect(etf.count).toBe(0);
    expect(etf.variationPct).toBeNull();
    expect(c.reduce((a, x) => a + x.sharePct, 0)).toBeCloseTo(100, 6);
  });
});

describe("portfolioTotals", () => {
  it("patrimonio, investido, ganho de capital, proventos e lucro total", () => {
    const s = summarizeAssets(assets, txs, quotes, targets, TODAY);
    const t = portfolioTotals(s, assets, txs, quotes, TODAY);
    const invested = 78.06 + 70.42 + 42.78 + 50 + 40.04;
    const total = 80.94 + 79.6 + 45.72 + 46.05 + 41.76;
    expect(t.invested).toBeCloseTo(invested, 2);
    expect(t.total).toBeCloseTo(total, 2);
    expect(t.capitalGain).toBeCloseTo(total - invested, 2);
    expect(t.dividends).toBeCloseTo(0.5, 6);
    expect(t.totalReturn).toBeCloseTo(total - invested + 0.5, 2);
    expect(t.totalReturnPct).toBeCloseTo(((total - invested + 0.5) / invested) * 100, 4);
  });

  it("12M: carteira nova (V0 = 0) -> retorno = (total - aportes + proventos) / aportes", () => {
    const s = summarizeAssets(assets, txs, quotes, targets, TODAY);
    const t = portfolioTotals(s, assets, txs, quotes, TODAY);
    const flows = 78.06 + 70.42 + 42.78 + 50 + 40.04;
    expect(t.return12mPct).toBeCloseTo(((t.total - flows + 0.5) / flows) * 100, 4);
  });
});

describe("evolution", () => {
  it("comeca no mes do 1o lancamento; mes atual usa preco atual, anterior usa fechamento", () => {
    const ev = evolution(assets, txs, quotes, 12, TODAY);
    expect(ev.map((p) => p.label)).toEqual(["08/26", "09/26"]);
    const ago = ev[0];
    expect(ago.invested).toBeCloseTo(281.3, 2);
    // fechamento de agosto: 40.4*2 + 39.1*2 + 15.03*3 + 9.28*5 + XPLG11 sem historico -> preco atual? nao: cai no PM
    expect(ago.marketValue).toBeCloseTo(40.4 * 2 + 39.1 * 2 + 15.03 * 3 + 9.28 * 5 + 10.01 * 4, 2);
    const now = ev[1];
    expect(now.marketValue).toBeCloseTo(80.94 + 79.6 + 45.72 + 46.05 + 41.76, 2);
    expect(now.capitalGain).toBeCloseTo(now.marketValue - now.invested, 6);
  });

  it("filtra por classe", () => {
    const ev = evolution(assets, txs, quotes, 12, TODAY, "fii");
    expect(ev[1].invested).toBeCloseTo(90.04, 2);
  });

  it("sem lancamentos -> vazio", () => {
    expect(evolution(assets, [], quotes, 12, TODAY)).toEqual([]);
  });
});

describe("autoDividendRows", () => {
  it("usa a quantidade em carteira no dia ANTERIOR a data ex", () => {
    const ops = [buy("1", "f1", "2026-08-05", 5, 10), buy("2", "f1", "2026-08-29", 5, 10)];
    const rows = autoDividendRows("MXRF11", ops, [
      { date: "2026-08-29", amount: 0.1 }, // comprou 5 no dia ex -> so os 5 antigos recebem
      { date: "2026-09-30", amount: 0.1 }, // 10 cotas
      { date: "2026-07-31", amount: 0.1 }, // antes de ter posicao -> nada
    ]);
    expect(rows).toEqual([
      { date: "2026-08-29", quantity: 5, unitPrice: 0.1, total: 0.5, externalKey: "MXRF11|2026-08-29" },
      { date: "2026-09-30", quantity: 10, unitPrice: 0.1, total: 1, externalKey: "MXRF11|2026-09-30" },
    ]);
  });

  it("arredonda em centavos e ignora valores invalidos", () => {
    const ops = [buy("1", "a1", "2026-01-01", 3, 10)];
    const rows = autoDividendRows("BBSE3", ops, [
      { date: "2026-02-13", amount: 2.606807 },
      { date: "2026-03-01", amount: 0 },
      { date: "", amount: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(7.82);
  });
});

describe("datas e tesouro", () => {
  it("helpers de data", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-08-31", -6)).toBe("2026-02-28");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(lastMonthKeys(3, "2026-09-15")).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("ticker sintetico do Tesouro ida e volta + nome curto", () => {
    const t = tesouroTicker("Tesouro Selic", "2029-03-01");
    expect(t).toBe("TD:Tesouro Selic:2029-03-01");
    expect(parseTesouroTicker(t)).toEqual({ tipo: "Tesouro Selic", vencimento: "2029-03-01" });
    expect(assetDisplayName({ ticker: t, tesouroTipo: null, tesouroVencimento: null })).toBe("Tesouro Selic 2029");
    expect(assetDisplayName({ ticker: "BBSE3", tesouroTipo: null, tesouroVencimento: null })).toBe("BBSE3");
    expect(parseTesouroTicker("BBSE3")).toBeNull();
  });

  it("normalizeTargets preenche 25% no que faltar", () => {
    expect(normalizeTargets({ acao: 40 })).toEqual({ acao: 40, fii: 25, etf: 25, tesouro: 25 });
  });
});
