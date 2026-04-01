import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { mapAccount } from "@/lib/mappers";
import type { BankAccount } from "@/lib/types";

export function useAccounts() {
  const { user } = useAuth();

  return useQuery<BankAccount[]>({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map(mapAccount);
    },
  });
}

export function useTotalBalance() {
  const { data: accounts } = useAccounts();
  return accounts?.reduce((sum, a) => sum + a.balance, 0) ?? 0;
}

export function useCreateAccount() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (account: { name: string; bank: string; balance?: number; color?: string }) => {
      const { error } = await supabase.from("accounts").insert({
        user_id: user!.id,
        name: account.name,
        bank: account.bank,
        balance: account.balance ?? 0,
        color: account.color ?? "#8B5CF6",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; balance?: number; connected?: boolean; name?: string }) => {
      const { error } = await supabase.from("accounts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
