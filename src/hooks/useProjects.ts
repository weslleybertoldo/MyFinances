import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface ProjectItem {
  id: string;
  name: string;
  value: number;
  date: string | null;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  items: ProjectItem[];
  total: number;
}

export function useProjects() {
  const { user } = useAuth();

  return useQuery<Project[]>({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: items, error: itemsErr } = await supabase
        .from("project_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (itemsErr) throw itemsErr;

      return (projects ?? []).map((p) => {
        const projectItems = (items ?? [])
          .filter((i) => i.project_id === p.id)
          .map((i) => ({
            id: i.id,
            name: i.name,
            value: Number(i.value),
            date: i.date,
          }));
        return {
          id: p.id,
          name: p.name,
          createdAt: p.created_at,
          items: projectItems,
          total: projectItems.reduce((s, i) => s + i.value, 0),
        };
      });
    },
  });
}

export function useCreateProject() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("projects").insert({ user_id: user!.id, name });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("projects").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useAddProjectItem() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (item: { project_id: string; name: string; value: number; date?: string }) => {
      const { error } = await supabase.from("project_items").insert({
        user_id: user!.id,
        project_id: item.project_id,
        name: item.name,
        value: Math.abs(item.value),
        date: item.date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProjectItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; value?: number; date?: string | null }) => {
      const clean: Record<string, unknown> = {};
      if (updates.name !== undefined) clean.name = updates.name;
      if (updates.value !== undefined) clean.value = Math.abs(updates.value);
      if ("date" in updates) clean.date = updates.date || null;
      const { error } = await supabase.from("project_items").update(clean).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProjectItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
