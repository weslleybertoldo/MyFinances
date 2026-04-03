import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { mapCreditCard } from "@/lib/mappers";
import type { CreditCard } from "@/lib/types";

export function useCreditCards() {
  const { user } = useAuth();

  return useQuery<CreditCard[]>({
    queryKey: ["credit-cards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []).map(mapCreditCard);
    },
  });
}

export function useCreateCreditCard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (card: { name: string; closing_day: number; due_day: number; color: string; card_limit?: number }) => {
      const { error } = await supabase.from("credit_cards").insert({
        user_id: user!.id,
        name: card.name,
        closing_day: card.closing_day,
        due_day: card.due_day,
        color: card.color,
        card_limit: card.card_limit ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-cards"] }),
  });
}

export function useUpdateCreditCard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      closing_day?: number;
      due_day?: number;
      color?: string;
      card_limit?: number;
    }) => {
      const { error } = await supabase.from("credit_cards").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-cards"] }),
  });
}

// Pagamentos de fatura — { "cardId-month": amount }
export interface InvoicePayment {
  id: string;
  cardId: string;
  month: string;
  amount: number;
}

export function useInvoicePayments() {
  const { user } = useAuth();

  return useQuery<InvoicePayment[]>({
    queryKey: ["invoice-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_invoice_payments")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        cardId: r.card_id,
        month: r.month,
        amount: Number(r.amount),
      }));
    },
  });
}

export function useToggleInvoicePayment() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, month, amount, currentlyPaid }: {
      cardId: string;
      month: string;
      amount: number;
      currentlyPaid: boolean;
    }) => {
      if (currentlyPaid) {
        // Desmarcar — deletar o registro
        const { error } = await supabase
          .from("card_invoice_payments")
          .delete()
          .eq("card_id", cardId)
          .eq("month", month);
        if (error) throw error;
      } else {
        // Marcar como pago — inserir
        const { error } = await supabase
          .from("card_invoice_payments")
          .upsert({
            user_id: user!.id,
            card_id: cardId,
            month,
            amount,
          }, { onConflict: "card_id,month" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice-payments"] }),
  });
}

export function useDeleteCreditCard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-cards"] });
      qc.invalidateQueries({ queryKey: ["future-launches"] });
    },
  });
}
