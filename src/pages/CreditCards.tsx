import { useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CreditCard, Pencil, Trash2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useCreditCards, useCreateCreditCard, useUpdateCreditCard, useDeleteCreditCard, useInvoicePayments } from "@/hooks/useCreditCards";
import { useFutureLaunches } from "@/hooks/useFutureLaunches";

const CARD_COLORS = ["#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444", "#6366F1", "#14B8A6"];

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export default function CreditCards() {
  const { data: cards = [], isPending } = useCreditCards();
  const { data: allLaunches = [] } = useFutureLaunches();
  const { data: invoicePayments = [] } = useInvoicePayments();
  const createCard = useCreateCreditCard();
  const updateCard = useUpdateCreditCard();
  const deleteCard = useDeleteCreditCard();

  const [showAdd, setShowAdd] = useState(false);
  const [newCard, setNewCard] = useState({ name: "", closingDay: "25", dueDay: "5", color: CARD_COLORS[0], limit: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", closingDay: "", dueDay: "", color: "", limit: "" });
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newCard.name) return;
    createCard.mutate({
      name: newCard.name,
      closing_day: parseInt(newCard.closingDay) || 25,
      due_day: parseInt(newCard.dueDay) || 5,
      color: newCard.color,
      card_limit: parseFloat(newCard.limit) || 0,
    });
    setNewCard({ name: "", closingDay: "25", dueDay: "5", color: CARD_COLORS[0], limit: "" });
    setShowAdd(false);
  };

  const startEdit = (card: typeof cards[0]) => {
    setEditingId(card.id);
    setEditForm({
      name: card.name,
      closingDay: String(card.closingDay),
      dueDay: String(card.dueDay),
      color: card.color,
      limit: card.limit > 0 ? String(card.limit) : "",
    });
  };

  const saveEdit = () => {
    if (!editingId || !editForm.name) return;
    updateCard.mutate({
      id: editingId,
      name: editForm.name,
      closing_day: parseInt(editForm.closingDay) || 25,
      due_day: parseInt(editForm.dueDay) || 5,
      color: editForm.color,
      card_limit: parseFloat(editForm.limit) || 0,
    });
    setEditingId(null);
  };

  // Calcula mês de vencimento da fatura
  const getInvoiceMonth = (expenseDate: string, closingDay: number) => {
    const [y, m, d] = expenseDate.split("-").map(Number);
    if (d <= closingDay) {
      const dt = new Date(y, m, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    } else {
      const dt = new Date(y, m + 1, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    }
  };

  // Agrupar lançamentos por cartão e mês de VENCIMENTO da fatura
  const getCardInvoices = (cardId: string, closingDay: number) => {
    const cardLaunches = allLaunches.filter((l) => l.cardId === cardId);
    const byMonth = new Map<string, typeof cardLaunches>();
    for (const l of cardLaunches) {
      const invoiceMonth = getInvoiceMonth(l.dueDate, closingDay);
      if (!byMonth.has(invoiceMonth)) byMonth.set(invoiceMonth, []);
      byMonth.get(invoiceMonth)!.push(l);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, launches]) => ({
        month,
        launches,
        total: launches.reduce((s, l) => s + Math.abs(l.amount), 0),
        allPaid: launches.every((l) => l.paid),
      }));
  };

  if (isPending) {
    return <PageLoader title="Cartões de Crédito" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cartões de Crédito</h1>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Cartão</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cartão de Crédito</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do cartão (ex: Nubank)" value={newCard.name} onChange={(e) => setNewCard({ ...newCard, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Dia de fechamento</label>
                  <Input type="number" min={1} max={31} value={newCard.closingDay} onChange={(e) => setNewCard({ ...newCard, closingDay: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dia de vencimento</label>
                  <Input type="number" min={1} max={31} value={newCard.dueDay} onChange={(e) => setNewCard({ ...newCard, dueDay: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Limite do cartão (R$)</label>
                <Input type="number" min={0} placeholder="Ex: 2000" value={newCard.limit} onChange={(e) => setNewCard({ ...newCard, limit: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newCard.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewCard({ ...newCard, color: c })}
                    />
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={createCard.isPending}>
                {createCard.isPending ? "Criando..." : "Criar Cartão"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {cards.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie um cartão para controlar suas faturas</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {cards.map((card) => {
          const invoices = getCardInvoices(card.id, card.closingDay);
          const isExpanded = expandedCardId === card.id;
          const currentMonthTotal = invoices.find((inv) => {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            return inv.month === currentMonth;
          })?.total ?? 0;
          // Total gasto = despesas em faturas NAO pagas via "Pagar fatura"
          // paid individual e so controle pessoal, nao afeta o limite
          const isInvPaid = (invMonth: string) => invoicePayments.some((p) => p.cardId === card.id && p.month === invMonth);
          const totalUsed = allLaunches
            .filter((l) => {
              if (l.cardId !== card.id || l.type !== "expense") return false;
              const invMonth = getInvoiceMonth(l.dueDate, card.closingDay);
              return !isInvPaid(invMonth);
            })
            .reduce((s, l) => s + Math.abs(l.amount), 0);
          const availableLimit = card.limit > 0 ? card.limit - totalUsed : 0;

          return (
            <Card key={card.id} style={{ borderLeftColor: card.color, borderLeftWidth: 4 }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {editingId === card.id ? (
                    <div className="flex-1 space-y-2">
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Fechamento</label>
                          <Input type="number" min={1} max={31} value={editForm.closingDay} onChange={(e) => setEditForm({ ...editForm, closingDay: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Vencimento</label>
                          <Input type="number" min={1} max={31} value={editForm.dueDay} onChange={(e) => setEditForm({ ...editForm, dueDay: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Limite (R$)</label>
                        <Input type="number" min={0} placeholder="Ex: 2000" value={editForm.limit} onChange={(e) => setEditForm({ ...editForm, limit: e.target.value })} />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {CARD_COLORS.map((c) => (
                          <button
                            key={c}
                            className={`w-6 h-6 rounded-full border-2 ${editForm.color === c ? "border-foreground" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditForm({ ...editForm, color: c })}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5" style={{ color: card.color }} />
                        <div>
                          <CardTitle className="text-base">{card.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">Fecha dia {card.closingDay} · Vence dia {card.dueDay}{card.limit > 0 ? ` · Limite ${formatCurrency(card.limit)}` : ""}</p>
                          {card.limit > 0 && (
                            <p className={`text-xs font-medium ${availableLimit >= 0 ? "text-success" : "text-destructive"}`}>
                              Disponível: {formatCurrency(availableLimit)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm mr-2">{formatCurrency(currentMonthTotal)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(card)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDeleteCardId(card.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedCardId(isExpanded ? null : card.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardHeader>

              {isExpanded && editingId !== card.id && (
                <CardContent className="pt-0">
                  {invoices.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma despesa neste cartão</p>
                  )}
                  <div className="space-y-4">
                    {invoices.map(({ month, launches, total, allPaid }) => (
                      <div key={month} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{getMonthLabel(month)}</span>
                            <Badge variant={allPaid ? "default" : "secondary"} className="text-[10px]">
                              {allPaid ? "Paga" : "Aberta"}
                            </Badge>
                          </div>
                          <span className="font-bold text-sm">{formatCurrency(total)}</span>
                        </div>
                        <div className="space-y-1">
                          {launches.map((l) => (
                            <div key={l.id} className="flex items-center justify-between text-xs py-1">
                              <div className="flex items-center gap-2">
                                <span className={l.paid ? "line-through opacity-50" : ""}>{l.description}</span>
                                {l.totalParcels && (
                                  <Badge variant="outline" className="text-[9px]">{l.parcelNumber}/{l.totalParcels}</Badge>
                                )}
                              </div>
                              <span className="text-destructive">{formatCurrency(Math.abs(l.amount))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dialog de confirmação para excluir cartão */}
      <Dialog open={!!confirmDeleteCardId} onOpenChange={() => setConfirmDeleteCardId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir cartão?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente excluir este cartão? As despesas vinculadas perderão a referência ao cartão.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDeleteCardId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteCard.mutate(confirmDeleteCardId!); setConfirmDeleteCardId(null); }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
