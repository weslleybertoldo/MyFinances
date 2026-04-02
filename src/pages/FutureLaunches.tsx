import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarClock, TrendingUp, TrendingDown, Check, AlertTriangle, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useFutureLaunches, useCreateFutureLaunch, useUpdateFutureLaunch, useUpdateFutureLaunchGroup, useDeleteFutureLaunch, useDeleteFutureLaunchGroup } from "@/hooks/useFutureLaunches";
import { useTotalBalance } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import DashboardPendingModal from "@/components/DashboardPendingModal";
import DashboardFutureModal from "@/components/DashboardFutureModal";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export default function FutureLaunches() {
  const { data: allLaunches = [], isLoading } = useFutureLaunches();
  const { data: categories = [] } = useCategories();
  const currentBalance = useTotalBalance();
  const createLaunch = useCreateFutureLaunch();
  const updateLaunch = useUpdateFutureLaunch();
  const deleteLaunch = useDeleteFutureLaunch();
  const deleteGroup = useDeleteFutureLaunchGroup();
  const updateGroup = useUpdateFutureLaunchGroup();

  const [selectedMonth, setSelectedMonth] = useState(() => getMonthStr(new Date()));
  const currentMonthStr = getMonthStr(new Date());

  const [showAdd, setShowAdd] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showFuture, setShowFuture] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<{ id: string; groupId: string } | null>(null);
  const [confirmUpdateGroup, setConfirmUpdateGroup] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", dueDate: "", categoryId: "", type: "expense" as "income" | "expense", recurring: false });

  const [newLaunch, setNewLaunch] = useState({
    description: "",
    amount: "",
    dueDate: "",
    categoryId: "",
    type: "expense" as "income" | "expense",
    recurring: false,
    installments: "",
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
  // Receitas Previstas = receitas já pagas - despesas já pagas (saldo real do mês)
  const incomePaidItems = monthLaunches.filter((l) => l.type === "income" && l.paid);
  const expensePaidItems = monthLaunches.filter((l) => l.type === "expense" && l.paid);
  const monthIncomePaid = incomePaidItems.reduce((s, l) => s + Math.abs(l.amount), 0);
  const monthExpensePaid = expensePaidItems.reduce((s, l) => s + Math.abs(l.amount), 0);
  const monthIncome = Math.max(0, monthIncomePaid - monthExpensePaid);
  // Despesas Previstas = despesas ainda não pagas
  const monthExpense = monthLaunches.filter((l) => l.type === "expense" && !l.paid).reduce((s, l) => s + Math.abs(l.amount), 0);


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
    updateLaunch.mutate({ id, paid: !currentPaid });
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
      recurring: installments ? false : newLaunch.recurring,
      installments,
    });
    setNewLaunch({ description: "", amount: "", dueDate: "", categoryId: "", type: "expense", recurring: false, installments: "" });
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

  const doSaveEdit = (updateAllParcels: boolean) => {
    if (!editingId) return;
    const launch = allLaunches.find((l) => l.id === editingId);

    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount === 0) return;

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
      Promise.all(dateUpdates);

      // Atualiza a data desta parcela individualmente
      updateLaunch.mutate({ id: editingId, due_date: editForm.dueDate });
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
      });
    }

    setEditingId(null);
    setConfirmUpdateGroup(false);
  };

  const removeLaunch = (l: typeof forecast[0]) => {
    if (l.groupId) {
      setConfirmDeleteGroup({ id: l.id, groupId: l.groupId });
    } else {
      deleteLaunch.mutate(l.id);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos Futuros</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com navegação de mês */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos Futuros</h1>
          <p className="text-muted-foreground">Previsão de gastos e receitas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{getMonthLabel(selectedMonth)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="ml-2"><Plus className="h-4 w-4 mr-2" />Novo Lançamento</Button>
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
                <Button className="w-full" onClick={handleAdd} disabled={createLaunch.isPending}>
                  {createLaunch.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs text-muted-foreground">Receitas Previstas</p>
            </div>
            <p className="text-lg font-bold text-success">{formatCurrency(monthIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Despesas Previstas</p>
            </div>
            <p className="text-lg font-bold text-destructive">{formatCurrency(monthExpense)}</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800"
          onClick={() => setShowPending(true)}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <p className="text-lg font-bold text-amber-500">{formatCurrency(pendingTotal)}</p>
            <p className="text-[10px] text-muted-foreground">{pendingLaunches.length} em atraso</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowFuture(true)}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Futuras</p>
            </div>
            <p className="text-lg font-bold text-blue-500">{formatCurrency(futureTotal)}</p>
            <p className="text-[10px] text-muted-foreground">Próximos meses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Saldo Projetado</p>
            </div>
            <p className={`text-lg font-bold ${projectedBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(projectedBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

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
                    <div className="grid grid-cols-3 gap-2">
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDueDate(l.dueDate)}</span>
                          <Badge variant="secondary" className="text-[10px]">{l.category}</Badge>
                          {l.recurring && <Badge variant="outline" className="text-[10px]">Recorrente</Badge>}
                          {l.totalParcels && (
                            <Badge variant="outline" className="text-[10px]">{l.parcelNumber}/{l.totalParcels}</Badge>
                          )}
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

      {/* Dialog de confirmação para deletar grupo */}
      <Dialog open={!!confirmDeleteGroup} onOpenChange={() => setConfirmDeleteGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir todas as parcelas?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se você excluir, todas as parcelas deste lançamento serão removidas (incluindo parcelas de meses anteriores e futuros).
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDeleteGroup(null)}>Cancelar</Button>
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
    </div>
  );
}
