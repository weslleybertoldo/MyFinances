import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Filter, Tag } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { useTransactions, useUpdateTransactionCategory } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: categories = [] } = useCategories();
  const { data: transactions = [], isLoading } = useTransactions({
    categoryId: filterCategory !== "all" ? filterCategory : undefined,
    search: search || undefined,
  });
  const updateCategory = useUpdateTransactionCategory();

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleCategoryChange = (txId: string, categoryId: string, description: string) => {
    updateCategory.mutate({ transactionId: txId, categoryId, description });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Transações</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transações</h1>
        <p className="text-muted-foreground">Gerencie e categorize suas transações</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Filtrado</p>
            <p className="text-xl font-bold">{transactions.length} transações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Receitas</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Despesas</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lista de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.categoryColor }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent transition-colors">
                            <Tag className="h-3 w-3" />
                            {t.category}
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Alterar Categoria</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground mb-4">
                            Transação: <strong>{t.description}</strong>
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {categories.map((c) => (
                              <Button
                                key={c.id}
                                variant={t.categoryId === c.id ? "default" : "outline"}
                                size="sm"
                                className="justify-start"
                                onClick={() => handleCategoryChange(t.id, c.id, t.description)}
                              >
                                <div className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: c.color }} />
                                {c.name}
                              </Button>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
                <span className={`font-semibold text-sm flex-shrink-0 ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : ""}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
