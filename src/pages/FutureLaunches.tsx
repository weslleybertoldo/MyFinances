import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarClock, TrendingUp, TrendingDown, Check } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useFutureLaunches, useCreateFutureLaunch, useUpdateFutureLaunch, useDeleteFutureLaunch } from "@/hooks/useFutureLaunches";
import { useTotalBalance } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";

export default function FutureLaunches() {
  const { data: launches = [], isLoading } = useFutureLaunches();
  const { data: categories = [] } = useCategories();
  const currentBalance = useTotalBalance();
  const createLaunch = useCreateFutureLaunch();
  const updateLaunch = useUpdateFutureLaunch();
  const deleteLaunch = useDeleteFutureLaunch();

  const [showAdd, setShowAdd] = useState(false);
  const [newLaunch, setNewLaunch] = useState({
    description: "",
    amount: "",
    dueDate: "",
    categoryId: "",
    type: "expense" as "income" | "expense",
    recurring: false,
  });

  // Build forecast
  const sortedLaunches = [...launches].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  let runningBalance = currentBalance;
  const forecast = sortedLaunches.map((l) => {
    runningBalance += l.paid ? 0 : l.amount;
    return { ...l, projectedBalance: runningBalance };
  });

  const totalFutureIncome = launches.filter((l) => l.type === "income" && !l.paid).reduce((s, l) => s + l.amount, 0);
  const totalFutureExpense = launches.filter((l) => l.type === "expense" && !l.paid).reduce((s, l) => s + Math.abs(l.amount), 0);
  const projectedBalance = currentBalance + totalFutureIncome - totalFutureExpense;

  const togglePaid = (id: string, currentPaid: boolean) => {
    updateLaunch.mutate({ id, paid: !currentPaid });
  };

  const handleAdd = () => {
    if (!newLaunch.description || !newLaunch.amount || !newLaunch.dueDate) return;
    createLaunch.mutate({
      description: newLaunch.description,
      amount: parseFloat(newLaunch.amount),
      type: newLaunch.type,
      due_date: newLaunch.dueDate,
      category_id: newLaunch.categoryId || undefined,
      recurring: newLaunch.recurring,
    });
    setNewLaunch({ description: "", amount: "", dueDate: "", categoryId: "", type: "expense", recurring: false });
    setShowAdd(false);
  };

  const removeLaunch = (id: string) => {
    deleteLaunch.mutate(id);
  };

  const formatDueDate = (d: string) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(d));

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos Futuros</h1>
          <p className="text-muted-foreground">Previsão de gastos e receitas</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Lançamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Lançamento Futuro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Descrição"
                value={newLaunch.description}
                onChange={(e) => setNewLaunch({ ...newLaunch, description: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Valor"
                value={newLaunch.amount}
                onChange={(e) => setNewLaunch({ ...newLaunch, amount: e.target.value })}
              />
              <Input
                type="date"
                value={newLaunch.dueDate}
                onChange={(e) => setNewLaunch({ ...newLaunch, dueDate: e.target.value })}
              />
              <Select value={newLaunch.categoryId} onValueChange={(v) => setNewLaunch({ ...newLaunch, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newLaunch.type} onValueChange={(v: "income" | "expense") => setNewLaunch({ ...newLaunch, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newLaunch.recurring}
                  onCheckedChange={(v) => setNewLaunch({ ...newLaunch, recurring: !!v })}
                />
                <span className="text-sm">Recorrente (mensal)</span>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={createLaunch.isPending}>
                {createLaunch.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-sm text-muted-foreground">Receitas Previstas</p>
            </div>
            <p className="text-xl font-bold text-success">{formatCurrency(totalFutureIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-sm text-muted-foreground">Despesas Previstas</p>
            </div>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalFutureExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">Saldo Projetado</p>
            </div>
            <p className={`text-xl font-bold ${projectedBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(projectedBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Previsão de Saldo</CardTitle>
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
              <p className="text-center py-8 text-muted-foreground">Nenhum lançamento futuro</p>
            )}

            {forecast.map((l) => (
              <div
                key={l.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${
                  l.paid ? "opacity-50 bg-muted/30" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => togglePaid(l.id, l.paid)}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      l.paid ? "bg-success border-success" : "border-muted-foreground/30"
                    }`}
                  >
                    {l.paid && <Check className="h-3 w-3 text-success-foreground" />}
                  </button>
                  <div className="min-w-0">
                    <p className={`font-medium text-sm ${l.paid ? "line-through" : ""}`}>{l.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDueDate(l.dueDate)}</span>
                      <Badge variant="secondary" className="text-[10px]">{l.category}</Badge>
                      {l.recurring && <Badge variant="outline" className="text-[10px]">Recorrente</Badge>}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`font-semibold text-sm ${l.type === "income" ? "text-success" : "text-destructive"}`}>
                    {l.type === "income" ? "+" : ""}{formatCurrency(l.amount)}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Saldo: {formatCurrency(l.projectedBalance)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={() => removeLaunch(l.id)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
