import { useMemo } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/mock-data";
import { assetDisplayName, formatPct, type AssetSummary, type ClassTargets } from "@/lib/investments";
import { CLASS_COLORS, shadeFor } from "./shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summaries: AssetSummary[];
  targets: ClassTargets;
}

export function ChartsDialog({ open, onOpenChange, summaries }: Props) {
  const byAsset = useMemo(() => {
    const sorted = [...summaries].filter((s) => s.currentValue > 0).sort((a, b) => b.currentValue - a.currentValue);
    const perClass: Record<string, number> = {};
    return sorted.map((s) => {
      const idx = perClass[s.asset.assetClass] ?? 0;
      perClass[s.asset.assetClass] = idx + 1;
      const total = sorted.filter((x) => x.asset.assetClass === s.asset.assetClass).length;
      return {
        name: assetDisplayName(s.asset),
        value: s.currentValue,
        pct: s.sharePct,
        ideal: s.idealPct,
        color: shadeFor(CLASS_COLORS[s.asset.assetClass], idx, total),
      };
    });
  }, [summaries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gráficos da carteira</DialogTitle>
        </DialogHeader>
        {byAsset.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ativo com saldo.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">Distribuição por ativo</p>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="h-52 w-full md:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byAsset} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none">
                        {byAsset.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full md:w-1/2 space-y-1.5">
                  {byAsset.map((d) => (
                    <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 min-w-0"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.color }} /><span className="truncate">{d.name}</span></span>
                      <span className="font-semibold shrink-0">{formatPct(d.pct)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">% atual × % ideal</p>
              <p className="text-[11px] text-muted-foreground mb-2">Ideal = meta da classe repartida pelas notas dos ativos. Barra acima do ideal = ativo sobre-alocado.</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byAsset} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={byAsset.length > 6 ? -30 : 0} height={byAsset.length > 6 ? 50 : 30} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} width={36} />
                    <Tooltip formatter={(value: number, name: string) => [formatPct(value), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="pct" name="% atual" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="ideal" name="% ideal" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} maxBarSize={28} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
