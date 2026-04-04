import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoryMap } from "@/hooks/useCategories";
import { mapTransaction } from "@/lib/mappers";
import type { Transaction } from "@/lib/types";

interface TransactionFilters {
  month?: string; // "YYYY-MM"
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 100;

export function useTransactions(filters?: TransactionFilters) {
  const { user } = useAuth();
  const { data: catMap } = useCategoryMap();
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE;

  return useQuery<Transaction[]>({
    queryKey: ["transactions", user?.id, filters],
    enabled: !!user && !!catMap,
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("date", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.month) {
        const [year, month] = filters.month.split("-");
        const start = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const end = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("date", start).lte("date", end);
      }

      if (filters?.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }

      if (filters?.search) {
        const escaped = filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.ilike("description", `%${escaped}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!catMap) return [];
      return (data ?? []).map((row) => mapTransaction(row, catMap));
    },
  });
}

export function useUpdateTransactionCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, categoryId, description }: { transactionId: string; categoryId: string; description: string }) => {
      // Atualizar categoria da transação
      const { error: txError } = await supabase
        .from("transactions")
        .update({ category_id: categoryId })
        .eq("id", transactionId);
      if (txError) throw txError;

      // Salvar regra de categorização automática (upsert)
      const { error: ruleError } = await supabase
        .from("category_rules")
        .upsert(
          { user_id: user!.id, pattern: description, category_id: categoryId },
          { onConflict: "user_id,pattern" }
        );
      if (ruleError) throw ruleError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tx: { description: string; amount: number; type: "income" | "expense"; date: string; account_id: string; category_id?: string }) => {
      const { error } = await supabase.from("transactions").insert({
        user_id: user!.id,
        ...tx,
        amount: Math.abs(tx.amount),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
