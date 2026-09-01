import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarClock, TrendingUp, TrendingDown, Check, AlertTriangle, Pencil, ChevronLeft, ChevronRight, CreditCard, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useFutureLaunches, useCreateFutureLaunch, useUpdateFutureLaunch, useUpdateFutureLaunchGroup, useDeleteFutureLaunch, useDeleteFutureLaunchGroup, useClearCardFromGroup } from "@/hooks/useFutureLaunches";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards, useInvoicePayments, useToggleInvoicePayment } from "@/hooks/useCreditCards";
import DashboardPendingModal from "@/components/DashboardPendingModal";
import DashboardFutureModal from "@/components/DashboardFutureModal";
import MonthExpensesModal from "@/components/MonthExpensesModal";
import { PageLoader } from "@/components/PageLoader";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export default function FutureLaunches() {
  const { data: allLaunches = [], isPending } = useFutureLaunches();
  const { data: categories = [] } = useCategories();
  // Aba independente por decisao do Weslley (01/09/2026): Lancamentos/Cartoes/Projetos
  // sao o mundo MANUAL e nao consomem o saldo importado do extrato — esse alimenta so
  // Dashboard e Transacoes. Sem isso, a sobra das receitas recebidas contava DUAS vezes
  // no Saldo Projetado (uma nas Receitas Previstas, outra dentro do saldo da conta).
  const currentBalance = 0;
  const createLaunch = useCreateFutureLaunch();
  const { data: creditCards = [] } = useCreditCards();
  const { data: invoicePayments = [] } = useInvoicePayments();
  const toggleInvoicePayment = useToggleInvoicePayment();
  const updateLaunch = useUpdateFutureLaunch();
  const deleteLaunch = useDeleteFutureLaunch();
  const deleteGroup = useDeleteFutureLaunchGroup();
  const updateGroup = useUpdateFutureLaunchGroup();
  const clearCardFromGroup = useClearCardFromGroup();

  const [selectedMonth, setSelectedMonth] = useState(() => getMonthStr(new Date()));
  const currentMonthStr = getMonthStr(new Date());

  const [showAdd, setShowAdd] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showFuture, setShowFuture] = useState(false);
  const [showMonthExpenses, setShowMonthExpenses] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{ id: string; groupId: string; recurring: boolean } | null>(null);
  const [confirmDeleteSingle, setConfirmDeleteSingle] = useState<string | null>(null);
  const [confirmUpdateGroup, setConfirmUpdateGroup] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", dueDate: "", categoryId: "", type: "expense" as "income" | "expense", recurring: false });
  const [payDialog, setPayDialog] = useState<{ id: string; groupId: string | null } | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const [newLaunch, setNewLaunch] = useState({
    description: "",
    amount: "",
    dueDate: "",
    categoryId: "",
    type: "expense" as "income" | "expense",
    recurring: false,
    installments: "",
    cardId: "",
  });

  // Filter by selected month
  const monthLaunches = allLaunches.filter((l) => l.dueDate.substring(0, 7) === selectedMonth);

  // Temporal groups — pendente = mês ANTERIOR ao atual e não pago; futuro = mês POSTERIOR ao atual
  const pendingLaunches = allLaunches.filter((l) => {
    const launchMonth = l.dueDate.substring(0, 7);
    return launchMonth < currentMonthStr && !l.paid && l.type === "expense";
  });
  const futureLaunches = allLaunches.filter((l) => {
    const launchMonth = l.dueDate.substring(0, 7);
    return launchMonth > currentMonthStr && !l.recurring;
  });

  const pendingTotal = pendingLaunches.reduce((s, l) => s + Math.abs(l.amount), 0);
  const futureTotal = futureLaunches.filter((l) => l.type === "expense" && !l.paid).reduce((s, l) => s + Math.abs(l.amount), 0);

  // Month totals
  // Receitas Previstas = receitas já pagas - despesas pagas com SALDO (sem cartão) - faturas de cartão pagas neste mês
  const incomePaidItems = monthLaunches.filter((l) => l.type === "income" && l.paid);
  const expensePaidWithBalance = monthLaunches.filter((l) => l.type === "expense" && l.paid && !l.cardId);
  const monthIncomePaid = incomePaidItems.reduce((s, l) => s + Math.abs(l.amount), 0);
  const monthExpensePaidBalance = expensePaidWithBalance.reduce((s, l) => s + Math.abs(l.amount), 0);
  // Soma das faturas de cartão pagas que vencem neste mês
  const paidInvoicesThisMonth = invoicePayments
    .filter((p) => p.month === selectedMonth)
    .reduce((s, p) => s + p.amount, 0);
  const monthIncome = Math.max(0, monthIncomePaid - monthExpensePaidBalance - paidInvoicesThisMonth);
  // Despesas Previstas = despesas ainda não pagas
  const monthExpense = monthLaunches.filter((l) => l.type === "expense" && !l.paid).reduce((s, l) => s + Math.abs(l.amount), 0);
  // Card "Despesas": pagas (realizadas) em destaque; previstas e total previsto embaixo.
  const monthExpensePaidAll = monthLaunches.filter((l) => l.type === "expense" && l.paid).reduce((s, l) => s + Math.abs(l.amount), 0);
  const monthExpenseTotal = monthExpensePaidAll + monthExpense;

  // Calcula o mês de VENCIMENTO da fatura para uma despesa
  // Ex: closingDay=29, dueDay=5 → compra dia 2/abr (antes do fechamento 29/abr) → fatura vence 5/mai → mês "2026-05"
  // Ex: compra dia 30/abr (depois do fechamento 29/abr) → fatura vence 5/jun → mês "2026-06"
  const getInvoiceMonth = (expenseDate: string, closingDay: number) => {
    const [y, m, d] = expenseDate.split("-").map(Number);
    if (d <= closingDay) {
      // Fecha este mês → vence no próximo
      const dt = new Date(y, m, 1); // m já é 1-based, new Date(y, m, 1) = próximo mês
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    } else {
      // Fecha no próximo mês → vence 2 meses depois
      const dt = new Date(y, m + 1, 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    }
  };

  // Próximo mês a partir do selecionado
  const getNextMonth = (monthStr: string) => {
    const [y, m] = monthStr.split("-").map(Number);
    const dt = new Date(y, m, 1); // m é 1-based, então new Date(y, m, 1) = próximo mês
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };
  const nextMonthStr = getNextMonth(selectedMonth);

  // Faturas por cartão — fatura principal (vence no mês selecionado)
  const cardInvoices = creditCards.map((card) => {
    const cardLaunches = allLaunches.filter((l) => {
      if (l.cardId !== card.id || l.type !== "expense") return false;
      return getInvoiceMonth(l.dueDate, card.closingDay) === selectedMonth;
    });
    const total = cardLaunches.reduce((s, l) => s + Math.abs(l.amount), 0);
    const allPaid = cardLaunches.length > 0 && cardLaunches.every((l) => l.paid);
    const hasPending = cardLaunches.some((l) => !l.paid);
    return { card, launches: cardLaunches, total, allPaid, hasPending };
  }).filter((inv) => inv.total > 0 || inv.launches.length > 0);

  // Preview da PRÓXIMA fatura (vence no mês seguinte ao selecionado) — só visualização
  const cardInvoicePreviews = creditCards.map((card) => {
    const cardLaunches = allLaunches.filter((l) => {
      if (l.cardId !== card.id || l.type !== "expense") return false;
      return getInvoiceMonth(l.dueDate, card.closingDay) === nextMonthStr;
    });
    const total = cardLaunches.reduce((s, l) => s + Math.abs(l.amount), 0);
    return { card, launches: cardLaunches, total };
  }).filter((inv) => inv.total > 0);


  // Forecast for selected month
  const sortedMonth = [...monthLaunches].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  let runningBalance = currentBalance;
  const forecast = sortedMonth.map((l) => {
    runningBalance += l.paid ? 0 : l.amount;
    return { ...l, projectedBalance: runningBalance };
  });

  const projectedBalance = currentBalance + monthIncome - monthExpense;

  const prevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    setSelectedMonth(getMonthStr(new Date(y, m - 2, 1)));
  };

  const nextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    setSelectedMonth(getMonthStr(new Date(y, m, 1)));
  };

  const togglePaid = (id: string, currentPaid: boolean) => {
    if (currentPaid) {
      const launch = allLaunches.find((l) => l.id === id);
      if (!launch) return;
      // Desmarcar — limpa paid e card_id
      updateLaunch.mutate({ id, paid: false, card_id: null });
      // Se tinha card_id e grupo, limpa card_id das parcelas futuras não pagas do grupo
      if (launch?.cardId && launch?.groupId) {
        clearCardFromGroup.mutate({ groupId: launch.groupId });
      }
      return;
    }
    // Marcar como pago
    const launch = allLaunches.find((l) => l.id === id);
    if (!launch) return;
    // Receita → marca direto
    if (launch.type === "income") {
      updateLaunch.mutate({ id, paid: true });
      return;
    }
    // Despesa → abre dialog Saldo/Cartão (só se tem cartões cadastrados)
    if (creditCards.length > 0) {
      setSelectedCardId("");
      setPayDialog({ id, groupId: launch.groupId });
    } else {
      // Sem cartões → paga com saldo direto
      updateLaunch.mutate({ id, paid: true });
    }
  };

  const handlePayWithBalance = () => {
    if (!payDialog) return;
    updateLaunch.mutate({ id: payDialog.id, paid: true, card_id: null });
    setPayDialog(null);
  };

  const handlePayWithCard = () => {
    if (!payDialog || !selectedCardId) return;
    // Marca APENAS esta despesa como paga com o cartão (não propaga para grupo)
    updateLaunch.mutate({ id: payDialog.id, paid: true, card_id: selectedCardId });
    setPayDialog(null);
  };

  const isInvoicePaid = (cardId: string, month: string) => {
    return invoicePayments.some((p) => p.cardId === cardId && p.month === month);
  };

  const handleToggleInvoice = (cardId: string, month: string, total: number) => {
    toggleInvoicePayment.mutate({
      cardId,
      month,
      amount: total,
      currentlyPaid: isInvoicePaid(cardId, month),
    });
  };

  const handleAdd = () => {
    if (!newLaunch.description || !newLaunch.amount || !newLaunch.dueDate) return;
    const installments = parseInt(newLaunch.installments) || undefined;
    createLaunch.mutate({
      description: newLaunch.description,
      amount: parseFloat(newLaunch.amount),
      type: newLaunch.type,
      due_date: newLaunch.dueDate,
      category_id: newLaunch.categoryId || undefined,
      card_id: (newLaunch.cardId && newLaunch.cardId !== "none") ? newLaunch.cardId : undefined,
      recurring: installments ? false : newLaunch.recurring,
      installments,
    });
    setNewLaunch({ description: "", amount: "", dueDate: "", categoryId: "", type: "expense", recurring: false, installments: "", cardId: "" });
    setShowAdd(false);
  };

  const startEdit = (l: typeof forecast[0]) => {
    setEditingId(l.id);
    setEditForm({
      description: l.description,
      amount: String(Math.abs(l.amount)),
      dueDate: l.dueDate,
      categoryId: l.categoryId ?? "",
      type: l.type,
      recurring: l.recurring,
    });
  };

  const saveEdit = () => {
    if (!editingId || !editForm.description || !editForm.amount) return;

    const launch = allLaunches.find((l) => l.id === editingId);

    // Se tem grupo, sempre pede confirmação
    if (launch?.groupId) {
      setConfirmUpdateGroup(true);
      return;
    }

    // Sem grupo — salva direto
    doSaveEdit(false);
  };

  const doSaveEdit = async (updateAllParcels: boolean) => {
    if (!editingId) return;
    const launch = allLaunches.find((l) => l.id === editingId);

    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount <= 0) return;

    if (updateAllParcels && launch?.groupId) {
      // Atualiza nome, categoria, tipo e valor de TODAS as parcelas do grupo
      updateGroup.mutate({
        groupId: launch.groupId,
        description: editForm.description,
        category_id: editForm.categoryId || null,
        type: editForm.type,
        amount,
      });

      // Atualiza o dia de vencimento de todas as parcelas via batch SQL
      const newDay = parseInt(editForm.dueDate.split("-")[2]);
      const siblings = allLaunches.filter((l) => l.groupId === launch.groupId && l.id !== editingId);
      const dateUpdates = siblings.map((s) => {
        const [sy, sm] = s.dueDate.split("-");
        const lastDay = new Date(parseInt(sy), parseInt(sm), 0).getDate();
        const day = String(Math.min(newDay, lastDay)).padStart(2, "0");
        return supabase.from("future_launches").update({ due_date: `${sy}-${sm}-${day}` }).eq("id", s.id);
      });
      try {
        await Promise.all(dateUpdates);
      } catch (e) {
        console.error("[FutureLaunches] Erro ao atualizar datas das parcelas:", e);
      }

      // Atualiza a data desta parcela individualmente
      updateLaunch.mutate({ id: editingId, due_date: editForm.dueDate }, {
        onSuccess: () => { setConfirmUpdateGroup(false); setEditingId(null); },
        onError: () => { setConfirmUpdateGroup(false); },
      });
    } else {
      // Atualiza só esta parcela
      updateLaunch.mutate({
        id: editingId,
        description: editForm.description,
        amount,
        due_date: editForm.dueDate,
        category_id: editForm.categoryId || null,
        type: editForm.type,
        recurring: editForm.recurring,
      }, {
        onSuccess: () => { setConfirmUpdateGroup(false); setEditingId(null); },
        onError: () => { setConfirmUpdateGroup(false); },
      });
    }
  };

  const removeLaunch = (l: typeof forecast[0]) => {
    if (l.groupId) {
      setConfirmDeleteGroup({ id: l.id, groupId: l.groupId, recurring: l.recurring });
    } else {
      setConfirmDeleteSingle(l.id);
    }
  };

  const handleConfirmDeleteGroup = () => {
    if (!confirmDeleteGroup) return;
    deleteGroup.mutate(confirmDeleteGroup.groupId);
    setConfirmDeleteGroup(null);
  };

  const formatDueDate = (d: string) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Maceio" })
      .format(new Date(d + (d.includes("T") ? "" : "T12:00:00")));

  if (isPending) {
    return <PageLoader title="Lançamentos" />;
  }

  return (
    <div className="space-y-6">
      {/* Header com navegação de mês */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Lançamentos</h1>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Lançamento Futuro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Descrição" value={newLaunch.description} onChange={(e) => setNewLaunch({ ...newLaunch, description: e.target.value })} />
                <Input type="number" placeholder="Valor" value={newLaunch.amount} onChange={(e) => setNewLaunch({ ...newLaunch, amount: e.target.value })} />
                <Input type="date" value={newLaunch.dueDate} onChange={(e) => setNewLaunch({ ...newLaunch, dueDate: e.target.value })} />
                <Select value={newLaunch.categoryId} onValueChange={(v) => setNewLaunch({ ...newLaunch, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newLaunch.type} onValueChange={(v: "income" | "expense") => setNewLaunch({ ...newLaunch, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
                {!newLaunch.recurring && (
                  <div>
                    <Input type="number" placeholder="Número de parcelas (ex: 10)" min={2} max={60} value={newLaunch.installments} onChange={(e) => setNewLaunch({ ...newLaunch, installments: e.target.value })} />
                    {newLaunch.installments && parseInt(newLaunch.installments) > 1 && newLaunch.amount && (
                      <p className="text-xs text-muted-foreground mt-1">{newLaunch.installments}x de {formatCurrency(parseFloat(newLaunch.amount))}</p>
                    )}
                  </div>
                )}
                {!newLaunch.installments && (
                  <div className="flex items-center gap-2">
                    <Checkbox checked={newLaunch.recurring} onCheckedChange={(v) => setNewLaunch({ ...newLaunch, recurring: !!v })} />
                    <span className="text-sm">Recorrente (mensal)</span>
                  </div>
                )}
                {newLaunch.type === "expense" && creditCards.length > 0 && (
                  <Select value={newLaunch.cardId} onValueChange={(v) => setNewLaunch({ ...newLaunch, cardId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem cartão (saldo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cartão (saldo)</SelectItem>
                      {creditCards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button className="w-full" onClick={handleAdd} disabled={createLaunch.isPending}>
                  {createLaunch.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">{getMonthLabel(selectedMonth)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-3 px-3">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-success flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Receitas Previstas</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-success">{formatCurrency(monthIncome)}</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowMonthExpenses(true)}
        >
          <CardContent className="pt-3 px-3">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-destructive flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Despesas</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-destructive">{formatCurrency(monthExpensePaidAll)}</p>
            <p className="text-[10px] text-muted-foreground">previstas: {formatCurrency(monthExpense)}</p>
            <p className="text-[10px] text-muted-foreground">total previsto: {formatCurrency(monthExpenseTotal)}</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800"
          onClick={() => setShowPending(true)}
        >
          <CardContent className="pt-3 px-3">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">Pendentes</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-amber-500">{formatCurrency(pendingTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{pendingLaunches.length} em atraso</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowFuture(true)}
        >
          <CardContent className="pt-3 px-3">
            <div className="flex items-center gap-1 mb-1">
              <CalendarClock className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">Futuras</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-blue-500">{formatCurrency(futureTotal)}</p>
            <p className="text-[10px] text-muted-foreground">Próximos meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 px-3">
            <div className="flex items-center gap-1 mb-1">
              <CalendarClock className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Saldo Projetado</p>
            </div>
            <p className={`text-base sm:text-lg font-bold ${projectedBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(projectedBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de fatura dos cartões */}
      {cardInvoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Faturas dos Cartões</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cardInvoices.map(({ card, launches: cardLaunches, total }) => {
              const paid = isInvoicePaid(card.id, selectedMonth);
              // Limite = limite - todas as despesas em faturas NÃO pagas
              const totalUsed = allLaunches
                .filter((l) => {
                  if (l.cardId !== card.id || l.type !== "expense") return false;
                  const invMonth = getInvoiceMonth(l.dueDate, card.closingDay);
                  return !isInvoicePaid(card.id, invMonth);
                })
                .reduce((s, l) => s + Math.abs(l.amount), 0);
              const availableLimit = card.limit > 0 ? card.limit - totalUsed : 0;
              return (
                <Card
                  key={card.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${paid ? "opacity-60" : ""}`}
                  style={{ borderLeftColor: card.color, borderLeftWidth: 4 }}
                  onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleInvoice(card.id, selectedMonth, total); }}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paid ? "bg-success border-success" : "border-muted-foreground/30 hover:border-success/50"}`}
                        >
                          {paid && <Check className="h-3.5 w-3.5 text-success-foreground" />}
                        </button>
                        <CreditCard className="h-4 w-4" style={{ color: card.color }} />
                        <span className={`font-medium text-sm ${paid ? "line-through" : ""}`}>{card.name}</span>
                      </div>
                      <Badge variant={paid ? "default" : "secondary"} className="text-[10px]">
                        {paid ? "Paga" : "Aberta"}
                      </Badge>
                    </div>
                    <p className={`text-lg font-bold ${paid ? "line-through" : ""}`}>{formatCurrency(total)}</p>
                    <p className="text-[10px] text-muted-foreground">Vence dia {card.dueDay}</p>
                    {card.limit > 0 && (
                      <div className="mt-2 pt-2 border-t border-dashed">
                        <p className="text-xs text-muted-foreground">Disponível</p>
                        <p className={`text-sm font-semibold ${availableLimit >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(availableLimit)}
                        </p>
                      </div>
                    )}

                    {expandedCard === card.id && (
                      <div className="mt-3 pt-3 border-t space-y-1">
                        {cardLaunches.map((cl) => (
                          <div key={cl.id} className="flex justify-between text-xs">
                            <span>
                              {cl.description}
                              {cl.totalParcels && <span className="text-muted-foreground ml-1">{cl.parcelNumber}/{cl.totalParcels}</span>}
                            </span>
                            <span className="text-destructive">{formatCurrency(Math.abs(cl.amount))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview da próxima fatura (pequeno, só visualização) */}
      {cardInvoicePreviews.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-muted-foreground">Próxima fatura ({getMonthLabel(nextMonthStr)})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {cardInvoicePreviews.map(({ card, total, launches: previewLaunches }) => (
              <div
                key={card.id}
                className="flex items-center gap-2 p-2 rounded-md border border-dashed opacity-70"
                style={{ borderColor: card.color }}
              >
                <CreditCard className="h-3 w-3 flex-shrink-0" style={{ color: card.color }} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{card.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(total)} · {previewLaunches.length} {previewLaunches.length === 1 ? "item" : "itens"}</p>
                  <p className="text-[9px] text-muted-foreground">Vence {card.dueDay}/{nextMonthStr.split("-")[1]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de lançamentos do mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lançamentos — {getMonthLabel(selectedMonth)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <p className="font-medium text-sm">Saldo Atual</p>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
              <span className="font-bold text-sm">{formatCurrency(currentBalance)}</span>
            </div>

            {forecast.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum lançamento neste mês</p>
            )}

            {forecast.map((l) => (
              <div key={l.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${l.paid ? "opacity-50 bg-muted/30" : "hover:bg-muted/50"}`}>
                {editingId === l.id ? (
                  /* Formulário de edição inline */
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descrição" />
                      <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} placeholder="Valor" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
                      <Select value={editForm.categoryId} onValueChange={(v) => setEditForm({ ...editForm, categoryId: v })}>
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
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  /* Visualização normal */
                  <>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => togglePaid(l.id, l.paid)}
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${l.paid ? "bg-success border-success" : "border-muted-foreground/30"}`}
                      >
                        {l.paid && <Check className="h-3 w-3 text-success-foreground" />}
                      </button>
                      <div className="min-w-0">
                        <p className={`font-medium text-sm ${l.paid ? "line-through" : ""}`}>{l.description}</p>
                        <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                          <span>{formatDueDate(l.dueDate)}</span>
                          <Badge variant="secondary" className="text-[10px]">{l.category}</Badge>
                          {l.recurring && <Badge variant="outline" className="text-[10px]">Recorrente</Badge>}
                          {l.totalParcels && (
                            <Badge variant="outline" className="text-[10px]">{l.parcelNumber}/{l.totalParcels}</Badge>
                          )}
                          {l.cardId && (() => {
                            const card = creditCards.find((c) => c.id === l.cardId);
                            return card ? (
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: card.color, color: card.color }}>
                                <CreditCard className="h-2.5 w-2.5 mr-0.5" />{card.name}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`font-semibold text-sm ${l.type === "income" ? "text-success" : "text-destructive"}`}>
                        {l.type === "income" ? "+" : ""}{formatCurrency(l.amount)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">Saldo: {formatCurrency(l.projectedBalance)}</p>
                    </div>
                    <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(l)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLaunch(l)}>
                        ×
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <DashboardPendingModal open={showPending} onOpenChange={setShowPending} launches={pendingLaunches} />
      <DashboardFutureModal open={showFuture} onOpenChange={setShowFuture} launches={futureLaunches} />
      <MonthExpensesModal
        open={showMonthExpenses}
        onOpenChange={setShowMonthExpenses}
        monthLabel={getMonthLabel(selectedMonth)}
        pending={monthLaunches.filter((l) => l.type === "expense" && !l.paid)}
        paid={monthLaunches.filter((l) => l.type === "expense" && l.paid)}
      />

      {/* Dialog de confirmação para deletar lançamento avulso */}
      <Dialog open={!!confirmDeleteSingle} onOpenChange={() => setConfirmDeleteSingle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir lançamento?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja realmente apagar este lançamento?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDeleteSingle(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteLaunch.mutate(confirmDeleteSingle!); setConfirmDeleteSingle(null); }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog de confirmação para deletar grupo (parcelas/recorrente) */}
      <Dialog open={!!confirmDeleteGroup} onOpenChange={() => setConfirmDeleteGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirmDeleteGroup?.recurring ? "Excluir este mês ou a recorrência?" : "Excluir parcela ou tudo?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDeleteGroup?.recurring
              ? "Você pode excluir somente este mês (não volta na renovação automática) ou encerrar a recorrência inteira (meses anteriores e futuros)."
              : "Você pode excluir somente esta parcela (só este mês) ou todas as parcelas deste lançamento (incluindo meses anteriores e futuros)."}
          </p>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDeleteGroup(null)}>Cancelar</Button>
            {confirmDeleteGroup && (
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirmDeleteGroup) deleteLaunch.mutate(confirmDeleteGroup.id);
                  setConfirmDeleteGroup(null);
                }}
              >
                Excluir só esta
              </Button>
            )}
            <Button variant="destructive" onClick={handleConfirmDeleteGroup}>Excluir Todas</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog de confirmação para atualizar nome do grupo */}
      <Dialog open={confirmUpdateGroup} onOpenChange={(open) => { if (!open) setConfirmUpdateGroup(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar todas as parcelas?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja atualizar o nome, categoria e tipo de todas as parcelas deste lançamento?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { doSaveEdit(false); }} disabled={updateLaunch.isPending || updateGroup.isPending}>Só esta</Button>
            <Button onClick={() => { doSaveEdit(true); }} disabled={updateLaunch.isPending || updateGroup.isPending}>Atualizar todas</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog Saldo ou Cartão */}
      <Dialog open={!!payDialog} onOpenChange={(open) => { if (!open) { setPayDialog(null); setSelectedCardId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como foi pago?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={handlePayWithBalance}>
              <Wallet className="h-5 w-5 text-success" />
              <div className="text-left">
                <p className="font-medium text-sm">Saldo</p>
                <p className="text-[10px] text-muted-foreground">Desconta das Receitas Previstas</p>
              </div>
            </Button>
            <div className="space-y-2">
              <Button
                variant="outline"
                className={`w-full justify-start gap-3 h-12 ${selectedCardId ? "border-primary" : ""}`}
                onClick={() => { if (creditCards.length === 1) { setSelectedCardId(creditCards[0].id); } }}
                disabled={creditCards.length === 0}
              >
                <CreditCard className="h-5 w-5 text-purple-500" />
                <div className="text-left">
                  <p className="font-medium text-sm">Cartão de Crédito</p>
                  <p className="text-[10px] text-muted-foreground">Vai para a fatura do cartão</p>
                </div>
              </Button>
              {creditCards.length > 0 && (
                <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                  <SelectContent>
                    {creditCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedCardId && (
                <Button className="w-full" onClick={handlePayWithCard}>
                  Confirmar Pagamento no Cartão
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
