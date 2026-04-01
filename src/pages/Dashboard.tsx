import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownIcon, ArrowUpIcon, WalletIcon, TrendingUpIcon } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import UpdateChecker from "@/components/UpdateChecker";

export default function Dashboard() {
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: transactions = [], isLoading: loadingTx } = useTransactions({ month: currentMonth });

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const monthIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  const recentTransactions = transactions.slice(0, 5);

  const categoryTotals = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const maxCategoryValue = sortedCategories[0]?.[1] || 1;

  const isLoading = loadingAccounts || loadingTx;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="pt-6"><div className="h-12 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UpdateChecker />
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">{accounts.length} contas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas (Mês)</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(monthIncome)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas (Mês)</CardTitle>
            <ArrowDownIcon className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(monthExpense)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balanço</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthIncome - monthExpense >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(monthIncome - monthExpense)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contas Bancárias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>}
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: account.color }} />
                  <div>
                    <p className="font-medium text-sm">{account.bank}</p>
                    <p className="text-xs text-muted-foreground">{account.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(account.balance)}</p>
                  <Badge variant={account.connected ? "default" : "secondary"} className="text-[10px]">
                    {account.connected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedCategories.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas neste mês</p>}
            {sortedCategories.map(([cat, total]) => {
              const catData = transactions.find((t) => t.category === cat);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className="text-muted-foreground">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(total / maxCategoryValue) * 100}%`,
                        backgroundColor: catData?.categoryColor || "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentTransactions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma transação neste mês</p>}
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full" style={{ backgroundColor: t.categoryColor }} />
                  <div>
                    <p className="font-medium text-sm">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · {formatDate(t.date)}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : ""}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
