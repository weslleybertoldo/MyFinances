import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useUpdateFutureLaunch, useDeleteFutureLaunch, useDeleteFutureLaunchGroup } from "@/hooks/useFutureLaunches";
import { useCategories } from "@/hooks/useCategories";
import type { FutureLaunch } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launches: FutureLaunch[];
}

export default function DashboardFutureModal({ open, onOpenChange, launches }: Props) {
  const updateLaunch = useUpdateFutureLaunch();
  const deleteLaunch = useDeleteFutureLaunch();
  const deleteGroup = useDeleteFutureLaunchGroup();
  const { data: categories = [] } = useCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", due_date: "", category_id: "", type: "expense" as "income" | "expense" });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; groupId: string | null; recurring: boolean } | null>(null);
  // Meses fechados por padrao — clica no mes pra expandir.
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (month: string) =>
    setExpandedMonths((cur) => {
      const next = new Set(cur);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  const handleOpenChange = (v: boolean) => {
    if (!v) { setEditingId(null); setConfirmDelete(null); setExpandedMonths(new Set()); }
    onOpenChange(v);
  };

  const startEdit = (l: FutureLaunch) => {
    setEditingId(l.id);
    setEditForm({
      description: l.description,
      amount: String(Math.abs(l.amount)),
      due_date: l.dueDate,
      category_id: l.categoryId ?? "",
      type: l.type,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateLaunch.mutate({
      id: editingId,
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      due_date: editForm.due_date,
      category_id: editForm.category_id || undefined,
      type: editForm.type,
    });
    setEditingId(null);
  };

  const handleDelete = (l: FutureLaunch) => {
    if (l.groupId || l.recurring) {
      setConfirmDelete({ id: l.id, groupId: l.groupId, recurring: l.recurring });
    } else {
      deleteLaunch.mutate(l.id);
    }
  };

  const confirmDeleteAction = () => {
    if (!confirmDelete) return;
    if (confirmDelete.groupId) {
      deleteGroup.mutate(confirmDelete.groupId);
    } else {
      deleteLaunch.mutate(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  // Group launches by month
  const grouped = new Map<string, FutureLaunch[]>();
  for (const l of launches) {
    const monthKey = l.dueDate.substring(0, 7);
    if (!grouped.has(monthKey)) grouped.set(monthKey, []);
    grouped.get(monthKey)!.push(l);
  }

  const formatMonthHeader = (ym: string) =>
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" })
      .format(new Date(ym + "-15T12:00:00"));

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançamentos Futuros</DialogTitle>
          </DialogHeader>

          {launches.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Nenhuma despesa futura</p>
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => (
                <div key={month}>
                  <button
                    className="w-full flex items-center justify-between rounded-lg border bg-zinc-300/80 hover:bg-zinc-300 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-foreground px-3 py-2 transition-colors"
                    onClick={() => toggleMonth(month)}
                    aria-expanded={expandedMonths.has(month)}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold capitalize">
                      {expandedMonths.has(month) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {formatMonthHeader(month)}
                    </span>
                    <span className="text-sm font-semibold text-destructive">
                      {formatCurrency(items.reduce((s, l) => s + l.amount, 0))}
                    </span>
                  </button>
                  <div className={`space-y-2 mt-2 ${expandedMonths.has(month) ? "" : "hidden"}`}>
                    {items.map((l) => (
                      <div key={l.id} className="border rounded-lg p-3">
                        {editingId === l.id ? (
                          <div className="space-y-2">
                            <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descrição" />
                            <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} placeholder="Valor" />
                            <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
                            <Select value={editForm.category_id} onValueChange={(v) => setEditForm({ ...editForm, category_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={editForm.type} onValueChange={(v: "income" | "expense") => setEditForm({ ...editForm, type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">Despesa</SelectItem>
                                <SelectItem value="income">Receita</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit}>Salvar</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{l.description}</p>
                                {l.totalParcels && (
                                  <Badge variant="outline" className="text-[10px]">{l.parcelNumber}/{l.totalParcels}</Badge>
                                )}
                                {l.recurring && (
                                  <Badge variant="outline" className="text-[10px]">Recorrente</Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-[10px] mt-1" style={{ backgroundColor: l.categoryColor + "20", color: l.categoryColor }}>
                                {l.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold text-sm ${l.type === "income" ? "text-success" : "text-destructive"}`}>{formatCurrency(l.amount)}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(l)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(l)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de delete grupo (parcelas/recorrente) */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirmDelete?.recurring ? "Excluir este mês ou a recorrência?" : "Excluir parcela ou tudo?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDelete?.recurring
              ? "Você pode excluir somente este mês (não volta na renovação automática) ou encerrar a recorrência inteira (meses anteriores e futuros)."
              : "Você pode excluir somente esta parcela (só este mês) ou todas as parcelas deste lançamento (incluindo meses anteriores e futuros)."}
          </p>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            {confirmDelete?.groupId && (
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => {
                  deleteLaunch.mutate(confirmDelete.id);
                  setConfirmDelete(null);
                }}
              >
                Excluir só esta
              </Button>
            )}
            <Button variant="destructive" onClick={confirmDeleteAction}>Excluir Todas</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
