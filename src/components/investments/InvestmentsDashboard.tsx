import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/mock-data";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABEL,
  assetDisplayName,
  evolution,
  formatPct,
  type Asset,
  type AssetClass,
  type AssetSummary,
  type ClassSummary,
  type InvestmentTx,
  type PortfolioTotals,
  type QuoteMap,
} from "@/lib/investments";
import { CLASS_COLORS, pctColor, shadeFor, signed } from "./shared";

interface Props {
  totals: PortfolioTotals;
  classes: ClassSummary[];
  summaries: AssetSummary[];
  assets: Asset[];
  txs: InvestmentTx[];
  quotes: QuoteMap;
  today: string;
}

type ClassFilter = AssetClass | "all";

function StatCard({ title, value, sub, badge, badgeColor }: { title: string; value: string; sub?: React.ReactNode; badge?: string; badgeColor?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl md:text-2xl font-bold truncate">{value}</span>
          {badge && <span className={`text-xs font-semibold ${badgeColor ?? ""}`}>{badge}</span>}
        </div>
        {sub && <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

const compactCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v);

export function InvestmentsDashboard({ totals, classes, summaries, assets, txs, quotes, today }: Props) {
  const [months, setMonths] = useState<"6" | "12" | "24">("12");
  const [evoClass, setEvoClass] = useState<ClassFilter>("all");
  const [pieClass, setPieClass] = useState<ClassFilter>("all");

  const evo = useMemo(
    () => evolution(assets, txs, quotes, Number(months), today, evoClass),
    [assets, txs, quotes, months, today, evoClass]
  );

  const pieData = useMemo(() => {
    if (pieClass === "all") {
      return classes
        .filter((c) => c.value > 0)
        .map((c) => ({ name: c.label, value: c.value, pct: c.sharePct, color: CLASS_COLORS[c.assetClass] }));
    }
    const items = summaries.filter((s) => s.asset.assetClass === pieClass && s.currentValue > 0);
    const total = items.reduce((s, a) => s + a.currentValue, 0);
    return items
      .sort((a, b) => b.currentValue - a.currentValue)
      .map((s, i) => ({
        name: assetDisplayName(s.asset),
        value: s.currentValue,
        pct: total > 0 ? (s.currentValue / total) * 100 : 0,
        color: shadeFor(CLASS_COLORS[pieClass], i, items.length),
      }));
  }, [classes, summaries, pieClass]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Patrimônio total"
          value={formatCurrency(totals.total)}
          badge={totals.capitalGainPct != null ? signed(totals.capitalGainPct, formatPct(totals.capitalGainPct)) : undefined}
          badgeColor={pctColor(totals.capitalGainPct)}
        />
        <StatCard title="Valor investido" value={formatCurrency(totals.invested)} />
        <StatCard
          title="Lucro total"
          value={formatCurrency(totals.totalReturn)}
          badgeColor={pctColor(totals.totalReturn)}
          sub={
            <>
              <div className="flex justify-between gap-2"><span>Ganho de Capital</span><span className={pctColor(totals.capitalGain)}>{formatCurrency(totals.capitalGain)}</span></div>
              <div className="flex justify-between gap-2"><span>Dividendos Recebidos</span><span>{formatCurrency(totals.dividends)}</span></div>
            </>
          }
        />
        <StatCard
          title="Proventos Recebidos (12M)"
          value={formatCurrency(totals.dividends12m)}
          sub={
            <>
              <div className="flex justify-between gap-2"><span>Total</span><span>{formatCurrency(totals.dividends)}</span></div>
              <div className="flex justify-between gap-2"><span>Rentabilidade (12M)</span><span className={pctColor(totals.return12mPct)}>{formatPct(totals.return12mPct)}</span></div>
              <div className="flex justify-between gap-2"><span>Rentabilidade Total</span><span className={pctColor(totals.totalReturnPct)}>{formatPct(totals.totalReturnPct)}</span></div>
            </>
          }
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Evolução do Patrimônio</CardTitle>
            <div className="flex gap-2">
              <Select value={months} onValueChange={(v) => setMonths(v as typeof months)}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 Meses</SelectItem>
                  <SelectItem value="12">12 Meses</SelectItem>
                  <SelectItem value="24">24 Meses</SelectItem>
                </SelectContent>
              </Select>
              <Select value={evoClass} onValueChange={(v) => setEvoClass(v as ClassFilter)}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {ASSET_CLASSES.map((c) => <SelectItem key={c} value={c}>{ASSET_CLASS_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {evo.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem lançamentos no período.</p>
          ) : (
            <>
              <div className="h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} width={64} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="invested" name="Valor aplicado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line dataKey="marketValue" name="Patrimônio" stroke={CLASS_COLORS.fii} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Período</TableHead>
                      <TableHead className="text-xs text-right">Valor aplicado</TableHead>
                      <TableHead className="text-xs text-right">Patrimônio</TableHead>
                      <TableHead className="text-xs text-right">Ganho de Capital</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...evo].reverse().map((p) => (
                      <TableRow key={p.month}>
                        <TableCell className="text-xs py-2">{p.label}</TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.invested)}</TableCell>
                        <TableCell className="text-xs py-2 text-right">{formatCurrency(p.marketValue)}</TableCell>
                        <TableCell className={`text-xs py-2 text-right ${pctColor(p.capitalGain)}`}>{formatCurrency(p.capitalGain)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Ativos na Carteira</CardTitle>
            <Select value={pieClass} onValueChange={(v) => setPieClass(v as ClassFilter)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {ASSET_CLASSES.map((c) => <SelectItem key={c} value={c}>{ASSET_CLASS_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ativo nesta seleção.</p>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="h-52 w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                      {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full md:w-1/2 space-y-2">
                {pieData.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatCurrency(d.value)}</span>
                      <span className="font-semibold">{formatPct(d.pct)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
