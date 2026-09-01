import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Search, Filter, Tag, Pencil, StickyNote, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { useTransactions, useUpdateTransactionCategory, useUpdateTransactionDetails } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { PageLoader } from "@/components/PageLoader";
import { formatImportedAt, SOURCE_LABEL } from "@/hooks/useBankImports";
import type { Transaction } from "@/lib/types";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getMonthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthStr: string) {
  const [year, month] = monthStr.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthStr(new Date()));

  const prevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    setSelectedMonth(getMonthStr(new Date(y, m - 2, 1)));
  };
  const nextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    setSelectedMonth(getMonthStr(new Date(y, m, 1)));
  };
  const [detailsTx, setDetailsTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [], isPending } = useTransactions({
    month: selectedMonth,
    categoryId: filterCategory !== "all" ? filterCategory : undefined,
    search: search || undefined,
  });
  const updateCategory = useUpdateTransactionCategory();
  const updateDetails = useUpdateTransactionDetails();

  const accountLabel = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? `${acc.bank} — ${acc.name}` : "—";
  };

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  const handleCategoryChange = (txId: string, categoryId: string, description: string) => {
    // A regra automatica e extraida do nome ORIGINAL: e nele que o trigger
    // auto_categorize da proxima importacao vai dar match.
    updateCategory.mutate({ transactionId: txId, categoryId, description });
  };

  const openEdit = (t: Transaction) => {
    setEditName(t.customName ?? t.description);
    setEditNotes(t.notes ?? "");
    setEditTx(t);
  };

  const saveEdit = () => {
    if (!editTx) return;
    updateDetails.mutate(
      {
        transactionId: editTx.id,
        originalDescription: editTx.description,
        customName: editName,
        notes: editNotes,
      },
      { onSuccess: () => setEditTx(null) }
    );
  };

  if (isPending) {
    return <PageLoader title="Transações" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transações</h1>
          <p className="text-muted-foreground">Gerencie e categorize suas transações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{getMonthLabel(selectedMonth)}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                onClick={() => setDetailsTx(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setDetailsTx(t);
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.categoryColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-medium text-sm truncate">{t.displayName}</p>
                      {t.notes && <StickyNote className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                      <button
                        aria-label="Editar nome e observação"
                        className="p-1 rounded flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(t);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-accent transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tag className="h-3 w-3" />
                            {t.category}
                          </button>
                        </DialogTrigger>
                        <DialogContent onClick={(e) => e.stopPropagation()}>
                          <DialogHeader>
                            <DialogTitle>Alterar Categoria</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground mb-4">
                            Transação: <strong>{t.displayName}</strong>
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

      {/* Editar nome + observacao */}
      <Dialog open={!!editTx} onOpenChange={(open) => !open && setEditTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-nome">Nome</Label>
              <Input
                id="tx-nome"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={editTx?.description}
              />
              <p className="text-xs text-muted-foreground">
                Original: {editTx?.description} — deixe igual (ou vazio) para voltar ao original.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-obs">Observação</Label>
              <Textarea
                id="tx-obs"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Anote o que quiser sobre essa transação..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={updateDetails.isPending}>
              {updateDetails.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhes da transacao */}
      <Dialog open={!!detailsTx} onOpenChange={(open) => !open && setDetailsTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da transação</DialogTitle>
          </DialogHeader>
          {detailsTx && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Nome atual</p>
                <p className="font-medium">{detailsTx.displayName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nome original</p>
                <p className={detailsTx.customName ? "" : "text-muted-foreground"}>
                  {detailsTx.description}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Observação</p>
                <p className={`whitespace-pre-wrap ${detailsTx.notes ? "" : "text-muted-foreground"}`}>
                  {detailsTx.notes || "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className={`font-semibold ${detailsTx.type === "income" ? "text-success" : "text-destructive"}`}>
                    {detailsTx.type === "income" ? "+" : ""}{formatCurrency(detailsTx.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{formatDate(detailsTx.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: detailsTx.categoryColor }} />
                    {detailsTx.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conta</p>
                  <p>{accountLabel(detailsTx.accountId)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p>
                    {detailsTx.importSource
                      ? `Importada do extrato (${SOURCE_LABEL[detailsTx.importSource].toLowerCase()})`
                      : "Lançada manualmente"}
                  </p>
                </div>
                {detailsTx.importMemo && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Descrição no extrato</p>
                    <p className="text-xs break-words">{detailsTx.importMemo}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (detailsTx) openEdit(detailsTx);
                setDetailsTx(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Button>
            <Button onClick={() => setDetailsTx(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
