import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Pencil, X, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { useUpdateFutureLaunch } from "@/hooks/useFutureLaunches";
import { useCategories } from "@/hooks/useCategories";
import type { FutureLaunch } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launches: FutureLaunch[];
}

export default function DashboardPendingModal({ open, onOpenChange, launches }: Props) {
  const updateLaunch = useUpdateFutureLaunch();
  const { data: categories = [] } = useCategories();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", due_date: "", category_id: "", type: "expense" as "income" | "expense" });
  // Meses fechados por padrao — clica no mes pra expandir (mesmo padrao do modal Futuras).
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (month: string) =>
    setExpandedMonths((cur) => {
      const next = new Set(cur);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  const handleOpenChange = (v: boolean) => {
    if (!v) { setEditingId(null); setExpandedMonths(new Set()); }
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

  const markPaid = (id: string) => {
    updateLaunch.mutate({ id, paid: true });
  };

  const formatMonth = (dateStr: string) =>
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" })
      .format(new Date(dateStr + "T12:00:00"));

  // Agrupa por mes, igual ao modal de Futuras.
  const grouped = new Map<string, FutureLaunch[]>();
  for (const l of launches) {
    const monthKey = l.dueDate.substring(0, 7);
    if (!grouped.has(monthKey)) grouped.set(monthKey, []);
    grouped.get(monthKey)!.push(l);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Despesas Pendentes</DialogTitle>
        </DialogHeader>

        {launches.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground">Nenhuma despesa pendente</p>
        ) : (
          <div className="space-y-3">
            {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => (
              <div key={month}>
                <button
                  className="w-full flex items-center justify-between rounded-lg border bg-zinc-300/80 hover:bg-zinc-300 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-foreground px-3 py-2 transition-colors"
                  onClick={() => toggleMonth(month)}
                  aria-expanded={expandedMonths.has(month)}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold capitalize">
                    {expandedMonths.has(month) ? (
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    ) : (
                      <ChevronRight className="h-4 w-4 opacity-70" />
                    )}
                    {formatMonth(month + "-15")}
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
                      <p className="font-medium text-sm">{l.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(l.dueDate)}</span>
                        <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: l.categoryColor + "20", color: l.categoryColor }}>
                          {l.category}
                        </Badge>
                        {l.totalParcels && (
                          <Badge variant="outline" className="text-[10px]">{l.parcelNumber}/{l.totalParcels}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-destructive">{formatCurrency(l.amount)}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(l)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => markPaid(l.id)}>
                        <Check className="h-3 w-3" />
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
  );
}
