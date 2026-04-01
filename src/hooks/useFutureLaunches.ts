import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoryMap } from "@/hooks/useCategories";
import { mapFutureLaunch } from "@/lib/mappers";
import type { FutureLaunch } from "@/lib/types";

export function useFutureLaunches() {
  const { user } = useAuth();
  const { data: catMap } = useCategoryMap();

  return useQuery<FutureLaunch[]>({
    queryKey: ["future-launches", user?.id],
    enabled: !!user && !!catMap,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("future_launches")
        .select("*")
        .eq("user_id", user!.id)
        .order("due_date");
      if (error) throw error;
      return (data ?? []).map((row) => mapFutureLaunch(row, catMap!));
    },
  });
}

export function useCreateFutureLaunch() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (launch: { description: string; amount: number; type: "income" | "expense"; due_date: string; category_id?: string; recurring?: boolean }) => {
      const { error } = await supabase.from("future_launches").insert({
        user_id: user!.id,
        description: launch.description,
        amount: Math.abs(launch.amount),
        type: launch.type,
        due_date: launch.due_date,
        category_id: launch.category_id ?? null,
        recurring: launch.recurring ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future-launches"] }),
  });
}

export function useUpdateFutureLaunch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; paid?: boolean; amount?: number; description?: string; due_date?: string; category_id?: string; recurring?: boolean }) => {
      const cleanUpdates = { ...updates };
      if (cleanUpdates.amount !== undefined) cleanUpdates.amount = Math.abs(cleanUpdates.amount);
      const { error } = await supabase.from("future_launches").update(cleanUpdates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future-launches"] }),
  });
}

export function useDeleteFutureLaunch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("future_launches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future-launches"] }),
  });
}
