import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { mapCategory, buildCategoryMap, type CategoryMap } from "@/lib/mappers";
import type { Category } from "@/lib/types";

export function useCategories() {
  const { user } = useAuth();

  return useQuery<Category[]>({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []).map(mapCategory);
    },
  });
}

export function useCategoryMap() {
  const { user } = useAuth();

  return useQuery<CategoryMap>({
    queryKey: ["category-map", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return buildCategoryMap(data ?? []);
    },
  });
}
