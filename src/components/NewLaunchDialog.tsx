import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useCategories } from "@/hooks/useCategories";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useCreateFutureLaunch } from "@/hooks/useFutureLaunches";

export type LaunchStatus = "pending" | "paid";

/** Valores iniciais do form (ex.: vindos de uma transacao do extrato). */
export interface NewLaunchPrefill {
  description?: string;
  amount?: string;
  dueDate?: string;
  categoryId?: string;
  type?: "income" | "expense";
  status?: LaunchStatus;
}

interface NewLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: NewLaunchPrefill;
  /** Chamado depois que o lancamento foi gravado (o dialog fecha sozinho). */
  onCreated?: () => void;
}

interface FormState {
  description: string;
  amount: string;
  dueDate: string;
  categoryId: string;
  type: "income" | "expense";
  recurring: boolean;
  installments: string;
  cardId: string;
  status: LaunchStatus;
}

function buildInitial(prefill?: NewLaunchPrefill): FormState {
  return {
    description: prefill?.description ?? "",
    amount: prefill?.amount ?? "",
    dueDate: prefill?.dueDate ?? "",
    categoryId: prefill?.categoryId ?? "",
    type: prefill?.type ?? "expense",
    recurring: false,
    installments: "",
    cardId: "",
    status: prefill?.status ?? "pending",
  };
}

/**
 * Form "Novo Lancamento Futuro" — o mesmo da aba Lancamentos e do botao "+" de
 * Transacoes. Componente unico pra os dois caminhos nao divergirem.
 */
export default function NewLaunchDialog({ open, onOpenChange, prefill, onCreated }: NewLaunchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lançamento Futuro</DialogTitle>
        </DialogHeader>
        {/* O Radix desmonta o conteudo ao fechar (depois da animacao), entao o form
            nasce do zero a cada abertura com o prefill daquele momento — sem reset
            manual e sem o conteudo sumir no meio da animacao de saida. */}
        <NewLaunchForm
          prefill={prefill}
          onDone={() => {
            onCreated?.();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewLaunchForm({ prefill, onDone }: { prefill?: NewLaunchPrefill; onDone: () => void }) {
  const { data: categories = [] } = useCategories();
  const { data: creditCards = [] } = useCreditCards();
  const createLaunch = useCreateFutureLaunch();
  const [form, setForm] = useState<FormState>(() => buildInitial(prefill));
  const patch = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }));

  const installmentsCount = parseInt(form.installments) || 0;
  const hasInstallments = installmentsCount > 1;
  const usesCard = form.type === "expense" && !!form.cardId && form.cardId !== "none";
  const canSubmit = !!form.description && !!form.amount && !!form.dueDate;

  const statusHint = (() => {
    if (form.status === "pending") return "Fica como previsto até você marcar como pago.";
    const base =
      form.type === "income"
        ? "Já recebido: entra nas Receitas Previstas."
        : usesCard
          ? "Já pago: vai para a fatura do cartão."
          : "Já pago: entra em Despesas pagas e desconta das Receitas Previstas.";
    const scope = hasInstallments ? " Só a 1ª parcela nasce paga." : form.recurring ? " Só este mês nasce pago." : "";
    return base + scope;
  })();

  const handleAdd = () => {
    if (!canSubmit) return;
    createLaunch.mutate(
      {
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        due_date: form.dueDate,
        category_id: form.categoryId || undefined,
        card_id: usesCard ? form.cardId : undefined,
        recurring: hasInstallments ? false : form.recurring,
        installments: hasInstallments ? installmentsCount : undefined,
        paid: form.status === "paid",
      },
      { onSuccess: onDone }
    );
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Descrição" value={form.description} onChange={(e) => patch({ description: e.target.value })} />
      <Input type="number" placeholder="Valor" value={form.amount} onChange={(e) => patch({ amount: e.target.value })} />
      <Input type="date" value={form.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} />
      <Select value={form.categoryId} onValueChange={(v) => patch({ categoryId: v })}>
        <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={form.type} onValueChange={(v: "income" | "expense") => patch({ type: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="expense">Despesa</SelectItem>
          <SelectItem value="income">Receita</SelectItem>
        </SelectContent>
      </Select>
      {!form.recurring && (
        <div>
          <Input
            type="number"
            placeholder="Número de parcelas (ex: 10)"
            min={2}
            max={60}
            value={form.installments}
            onChange={(e) => patch({ installments: e.target.value })}
          />
          {hasInstallments && form.amount && (
            <p className="text-xs text-muted-foreground mt-1">{installmentsCount}x de {formatCurrency(parseFloat(form.amount))}</p>
          )}
        </div>
      )}
      {!form.installments && (
        <div className="flex items-center gap-2">
          <Checkbox checked={form.recurring} onCheckedChange={(v) => patch({ recurring: !!v })} />
          <span className="text-sm">Recorrente (mensal)</span>
        </div>
      )}
      {form.type === "expense" && creditCards.length > 0 && (
        <Select value={form.cardId} onValueChange={(v) => patch({ cardId: v })}>
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
      <div>
        <Select value={form.status} onValueChange={(v: LaunchStatus) => patch({ status: v })}>
          <SelectTrigger aria-label="Status do lançamento">
            {form.status === "paid"
              ? <Check className="h-4 w-4 mr-2 text-success" />
              : <Clock className="h-4 w-4 mr-2 text-muted-foreground" />}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">{statusHint}</p>
      </div>
      {createLaunch.isError && (
        <p className="text-xs text-destructive">Não foi possível adicionar: {createLaunch.error?.message}</p>
      )}
      <Button className="w-full" onClick={handleAdd} disabled={createLaunch.isPending || !canSubmit}>
        {createLaunch.isPending ? "Adicionando..." : "Adicionar"}
      </Button>
    </div>
  );
}
