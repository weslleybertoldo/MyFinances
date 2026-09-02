import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { assetDisplayName, formatQuantity, type Asset, type InvestmentTx } from "@/lib/investments";
import { useDeleteTransaction, useUpdateTransaction } from "@/hooks/useInvestments";
import { KIND_LABEL } from "./shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  txs: InvestmentTx[];
  assets: Asset[];
  onAdd: () => void;
}

function num(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? NaN : n;
}

export function TransactionsDialog({ open, onOpenChange, txs, assets, onAdd }: Props) {
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ date: "", quantity: "", unitPrice: "", total: "" });
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const list = useMemo(
    () => txs.filter((t) => !t.ignored && (assetFilter === "all" || t.assetId === assetFilter)),
    [txs, assetFilter]
  );

  const startEdit = (t: InvestmentTx) => {
    setEditingId(t.id);
    setEdit({
      date: t.date,
      quantity: String(t.quantity).replace(".", ","),
      unitPrice: t.unitPrice.toFixed(2).replace(".", ","),
      total: t.total.toFixed(2).replace(".", ","),
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const q = num(edit.quantity);
    const p = num(edit.unitPrice);
    const t = num(edit.total);
    if (!edit.date || isNaN(t) || t < 0) return toast.error("Confira a data e o total");
    updateTx.mutate(
      { id: editingId, date: edit.date, quantity: isNaN(q) ? 0 : q, unitPrice: isNaN(p) ? 0 : p, total: t },
      {
        onSuccess: () => toast.success("Lançamento atualizado"),
        onError: (e) => toast.error(`Não salvou: ${(e as Error).message}`),
      }
    );
    setEditingId(null);
  };

  const remove = (t: InvestmentTx) => {
    deleteTx.mutate(t, {
      onSuccess: () => toast.success(t.source === "auto" ? "Provento ignorado (não volta na sincronização)" : "Lançamento excluído"),
      onError: (e) => toast.error(`Não excluiu: ${(e as Error).message}`),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamentos ({list.length})</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select value={assetFilter} onValueChange={setAssetFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ativos</SelectItem>
              {assets.map((a) => <SelectItem key={a.id} value={a.id}>{assetDisplayName(a)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento.</p>
        ) : (
          <div className="space-y-2">
            {list.map((t) => {
              const asset = assetById.get(t.assetId);
              const isEditing = editingId === t.id;
              return (
                <div key={t.id} className="rounded border p-2 group">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} className="h-8 text-xs" />
                        <Input value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} placeholder="Qtd" className="h-8 text-xs" inputMode="decimal" />
                        <Input value={edit.unitPrice} onChange={(e) => setEdit({ ...edit, unitPrice: e.target.value })} placeholder="Preço unit." className="h-8 text-xs" inputMode="decimal" />
                        <Input value={edit.total} onChange={(e) => setEdit({ ...edit, total: e.target.value })} placeholder="Total" className="h-8 text-xs" inputMode="decimal" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                        <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={updateTx.isPending}>Salvar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{asset ? assetDisplayName(asset) : "—"}</span>
                          <Badge variant={t.kind === "sell" ? "destructive" : t.kind === "dividend" ? "secondary" : "default"} className="text-[10px] px-1.5 py-0">
                            {KIND_LABEL[t.kind]}
                          </Badge>
                          {t.source === "auto" && <Badge variant="outline" className="text-[10px] px-1.5 py-0">automático</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(t.date)}
                          {t.kind !== "dividend" && ` · ${formatQuantity(t.quantity)} × ${formatCurrency(t.unitPrice)}`}
                          {t.kind === "dividend" && t.quantity > 0 && ` · ${formatQuantity(t.quantity)} × ${formatCurrency(t.unitPrice)}`}
                          {t.notes && ` · ${t.notes}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-sm font-semibold ${t.kind === "sell" ? "text-destructive" : t.kind === "dividend" ? "text-success" : ""}`}>
                          {t.kind === "buy" ? "-" : "+"}{formatCurrency(t.total)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(t)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(t)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
