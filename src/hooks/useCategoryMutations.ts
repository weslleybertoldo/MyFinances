import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["categories"] });
  qc.invalidateQueries({ queryKey: ["category-map"] });
  qc.invalidateQueries({ queryKey: ["future-launches"] });
  qc.invalidateQueries({ queryKey: ["transactions"] });
}

export function useCreateCategory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (cat: { name: string; color: string; type: "income" | "expense" | "both" }) => {
      const { error } = await supabase.from("categories").insert({
        user_id: user!.id,
        name: cat.name,
        color: cat.color,
        type: cat.type,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; color?: string; type?: "income" | "expense" | "both" }) => {
      const { error } = await supabase.from("categories").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
