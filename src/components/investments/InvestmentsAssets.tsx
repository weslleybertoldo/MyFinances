import { useEffect, useMemo, useState } from "react";
import { BarChart3, Check, Columns3, ListOrdered, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/mock-data";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABEL,
  assetDisplayName,
  formatPct,
  formatQuantity,
  type Asset,
  type AssetClass,
  type AssetSummary,
  type ClassSummary,
  type ClassTargets,
  type InvestmentTx,
} from "@/lib/investments";
import { useDeleteAsset, useSetClassTarget, useUpdateAsset } from "@/hooks/useInvestments";
import { CLASS_COLORS, pctColor, signed } from "./shared";
import { TransactionsDialog } from "./TransactionsDialog";
import { ChartsDialog } from "./ChartsDialog";

interface Props {
  summaries: AssetSummary[];
  classes: ClassSummary[];
  targets: ClassTargets;
  assets: Asset[];
  txs: InvestmentTx[];
  onAddTransaction: (assetId?: string) => void;
}

type ColumnKey =
  | "quantity"
  | "avgPrice"
  | "price"
  | "variation"
  | "dayChange"
  | "return"
  | "dividends"
  | "value"
  | "score"
  | "share"
  | "ideal";

const ALL_COLUMNS: Array<{ key: ColumnKey; label: string; short: string }> = [
  { key: "quantity", label: "Quantidade", short: "Qtd" },
  { key: "avgPrice", label: "Preço médio", short: "P. médio" },
  { key: "price", label: "Preço atual", short: "P. atual" },
  { key: "variation", label: "Variação (atual vs médio)", short: "Variação" },
  { key: "dayChange", label: "Variação do dia", short: "Dia" },
  { key: "return", label: "Rentabilidade (com proventos)", short: "Rentab." },
  { key: "dividends", label: "Proventos recebidos", short: "Proventos" },
  { key: "value", label: "Saldo", short: "Saldo" },
  { key: "score", label: "Nota (0-10)", short: "Nota" },
  { key: "share", label: "% atual na carteira", short: "% Atual" },
  { key: "ideal", label: "% ideal", short: "% Ideal" },
];

const DEFAULT_COLUMNS: ColumnKey[] = ["quantity", "avgPrice", "price", "variation", "return", "value", "score", "share", "ideal"];
const COLUMNS_STORAGE = "myf.investimentos.colunas";

function loadColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as ColumnKey[];
    return parsed.filter((k) => ALL_COLUMNS.some((c) => c.key === k));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function ClassCard({ c, onSaveTarget }: { c: ClassSummary; onSaveTarget: (pct: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(c.targetPct));
  const save = () => {
    const n = parseFloat(value.replace(",", "."));
    if (!isNaN(n)) onSaveTarget(n);
    setEditing(false);
  };
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CLASS_COLORS[c.assetClass] }} />
          <CardTitle className="text-sm font-semibold truncate">{c.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Ativos</span><span className="font-medium">{c.count}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Valor total</span><span className="font-medium">{formatCurrency(c.value)}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Variação</span><span className={`font-medium ${pctColor(c.variationPct)}`}>{signed(c.variationPct, formatPct(c.variationPct))}</span></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Rentabilidade</span><span className={`font-medium ${pctColor(c.returnPct)}`}>{signed(c.returnPct, formatPct(c.returnPct))}</span></div>
        <div className="flex justify-between items-center gap-2 pt-1 border-t">
          <span className="text-muted-foreground">% na carteira</span>
          {editing ? (
            <span className="flex items-center gap-1">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                className="h-6 w-14 text-xs px-1 text-right"
                inputMode="decimal"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={save} aria-label="Salvar meta"><Check className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)} aria-label="Cancelar"><X className="h-3 w-3" /></Button>
            </span>
          ) : (
            <button
              className="flex items-center gap-1 font-semibold hover:underline"
              onClick={() => { setValue(String(c.targetPct)); setEditing(true); }}
              title="Editar meta da classe"
            >
              {formatPct(c.sharePct, 0)} <span className="text-muted-foreground font-normal">/ {formatPct(c.targetPct, 0)}</span>
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreCell({ summary, onSave }: { summary: AssetSummary; onSave: (score: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(summary.asset.score));
  const save = () => {
    const n = parseInt(value, 10);
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };
  if (editing) {
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="h-6 w-12 text-xs px-1 text-right ml-auto"
        inputMode="numeric"
        autoFocus
      />
    );
  }
  return (
    <button className="hover:underline tabular-nums" onClick={() => { setValue(String(summary.asset.score)); setEditing(true); }} title="Editar nota">
      {summary.asset.score}
    </button>
  );
}

export function InvestmentsAssets({ summaries, classes, targets, assets, txs, onAddTransaction }: Props) {
  const [classFilter, setClassFilter] = useState<AssetClass | "all">("all");
  const [columns, setColumns] = useState<ColumnKey[]>(loadColumns);
  const [showTxs, setShowTxs] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AssetSummary | null>(null);

  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const setTarget = useSetClassTarget();

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE, JSON.stringify(columns));
    } catch {
      /* storage indisponivel: fica so em memoria */
    }
  }, [columns]);

  const rows = useMemo(() => {
    const list = classFilter === "all" ? summaries : summaries.filter((s) => s.asset.assetClass === classFilter);
    return [...list].sort((a, b) => {
      const ca = ASSET_CLASSES.indexOf(a.asset.assetClass);
      const cb = ASSET_CLASSES.indexOf(b.asset.assetClass);
      if (ca !== cb) return ca - cb;
      return b.currentValue - a.currentValue;
    });
  }, [summaries, classFilter]);

  const show = (k: ColumnKey) => columns.includes(k);
  const toggleColumn = (k: ColumnKey) =>
    setColumns((cols) => (cols.includes(k) ? cols.filter((c) => c !== k) : ALL_COLUMNS.map((c) => c.key).filter((c) => c === k || cols.includes(c))));

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteAsset.mutate(confirmDelete.asset.id, {
      onSuccess: () => toast.success(`${assetDisplayName(confirmDelete.asset)} removido da carteira`),
      onError: (e) => toast.error(`Não foi possível remover: ${(e as Error).message}`),
    });
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {classes.map((c) => (
          <ClassCard
            key={c.assetClass}
            c={c}
            onSaveTarget={(pct) =>
              setTarget.mutate(
                { assetClass: c.assetClass, targetPct: pct },
                { onError: (e) => toast.error(`Meta não salva: ${(e as Error).message}`) }
              )
            }
          />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Meus Ativos ({summaries.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={classFilter} onValueChange={(v) => setClassFilter(v as AssetClass | "all")}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {ASSET_CLASSES.map((c) => <SelectItem key={c} value={c}>{ASSET_CLASS_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowTxs(true)}>
                <ListOrdered className="h-3.5 w-3.5 mr-1" />Lançamentos
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCharts(true)}>
                <BarChart3 className="h-3.5 w-3.5 mr-1" />Gráficos
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Columns3 className="h-3.5 w-3.5 mr-1" />Editar colunas
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-60 p-3">
                  <p className="text-xs font-medium mb-2">Colunas visíveis</p>
                  <div className="space-y-2">
                    {ALL_COLUMNS.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={show(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs mt-2 w-full" onClick={() => setColumns(DEFAULT_COLUMNS)}>
                    Restaurar padrão
                  </Button>
                </PopoverContent>
              </Popover>
              <Button size="sm" className="h-8 text-xs" onClick={() => onAddTransaction()}>
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Lançamento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ativo nesta seleção.</p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Ativo</TableHead>
                    {ALL_COLUMNS.filter((c) => show(c.key)).map((c) => (
                      <TableHead key={c.key} className="text-xs text-right whitespace-nowrap" title={c.label}>{c.short}</TableHead>
                    ))}
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.asset.id} className="group">
                      <TableCell className="py-2">
                        <button className="text-left" onClick={() => onAddTransaction(s.asset.id)} title="Adicionar lançamento neste ativo">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CLASS_COLORS[s.asset.assetClass] }} />
                            <span className="text-sm font-semibold whitespace-nowrap">{assetDisplayName(s.asset)}</span>
                          </div>
                          {s.asset.name && !s.asset.ticker.startsWith("TD:") && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{s.asset.name}</p>
                          )}
                        </button>
                      </TableCell>
                      {show("quantity") && <TableCell className="py-2 text-xs text-right tabular-nums">{formatQuantity(s.quantity)}</TableCell>}
                      {show("avgPrice") && <TableCell className="py-2 text-xs text-right tabular-nums whitespace-nowrap">{formatCurrency(s.avgPrice)}</TableCell>}
                      {show("price") && (
                        <TableCell className="py-2 text-xs text-right tabular-nums whitespace-nowrap">
                          {s.price != null ? formatCurrency(s.price) : <Badge variant="outline" className="text-[10px]">sem cotação</Badge>}
                        </TableCell>
                      )}
                      {show("variation") && <TableCell className={`py-2 text-xs text-right tabular-nums ${pctColor(s.capitalGainPct)}`}>{signed(s.capitalGainPct, formatPct(s.capitalGainPct))}</TableCell>}
                      {show("dayChange") && <TableCell className={`py-2 text-xs text-right tabular-nums ${pctColor(s.dayChangePct)}`}>{signed(s.dayChangePct, formatPct(s.dayChangePct))}</TableCell>}
                      {show("return") && <TableCell className={`py-2 text-xs text-right tabular-nums ${pctColor(s.totalReturnPct)}`}>{signed(s.totalReturnPct, formatPct(s.totalReturnPct))}</TableCell>}
                      {show("dividends") && <TableCell className="py-2 text-xs text-right tabular-nums whitespace-nowrap">{formatCurrency(s.dividends)}</TableCell>}
                      {show("value") && <TableCell className="py-2 text-xs text-right tabular-nums font-semibold whitespace-nowrap">{formatCurrency(s.currentValue)}</TableCell>}
                      {show("score") && (
                        <TableCell className="py-2 text-xs text-right">
                          <ScoreCell
                            summary={s}
                            onSave={(score) =>
                              updateAsset.mutate({ id: s.asset.id, score }, { onError: (e) => toast.error(`Nota não salva: ${(e as Error).message}`) })
                            }
                          />
                        </TableCell>
                      )}
                      {show("share") && <TableCell className="py-2 text-xs text-right tabular-nums">{formatPct(s.sharePct)}</TableCell>}
                      {show("ideal") && <TableCell className="py-2 text-xs text-right tabular-nums">{formatPct(s.idealPct)}</TableCell>}
                      <TableCell className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive opacity-60 group-hover:opacity-100"
                          onClick={() => setConfirmDelete(s)}
                          aria-label={`Remover ${assetDisplayName(s.asset)}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionsDialog open={showTxs} onOpenChange={setShowTxs} txs={txs} assets={assets} onAdd={() => { setShowTxs(false); onAddTransaction(); }} />
      <ChartsDialog open={showCharts} onOpenChange={setShowCharts} summaries={summaries} targets={targets} />

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover {confirmDelete ? assetDisplayName(confirmDelete.asset) : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Todos os lançamentos (compras, vendas e proventos) deste ativo serão apagados.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Remover</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
