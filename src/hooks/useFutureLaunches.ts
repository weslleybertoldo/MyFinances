import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoryMap } from "@/hooks/useCategories";
import { mapFutureLaunch } from "@/lib/mappers";
import type { FutureLaunch } from "@/lib/types";

/** Avança uma data por N meses sem pular meses (ex: 31/01 + 1 = 28/02, não 03/03) */
function addMonths(baseDate: string, months: number): string {
  const [y, m, d] = baseDate.split("-").map(Number);
  const targetMonth = m - 1 + months;
  const targetYear = y + Math.floor(targetMonth / 12);
  const targetMon = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMon + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Estende recorrentes pra manter 12 meses à frente. Roda uma vez por sessão. */
async function extendRecurringLaunches(userId: string) {
  const { data: launches, error } = await supabase
    .from("future_launches")
    .select("*")
    .eq("user_id", userId)
    .eq("recurring", true)
    .not("group_id", "is", null);

  if (error || !launches?.length) return;

  const recurringGroups = new Map<string, Array<Record<string, unknown>>>();
  for (const l of launches) {
    const gid = l.group_id as string;
    if (!recurringGroups.has(gid)) recurringGroups.set(gid, []);
    recurringGroups.get(gid)!.push(l);
  }

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  const targetMonth = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;

  const newRows: Array<Record<string, unknown>> = [];

  for (const [groupId, items] of recurringGroups) {
    const sortedDates = items.map((l) => l.due_date as string).sort();
    const lastMonth = sortedDates[sortedDates.length - 1].substring(0, 7);

    if (lastMonth >= targetMonth) continue;

    const firstDate = sortedDates[0];
    const template = items[items.length - 1];
    const existingMonths = new Set(sortedDates.map((d) => d.substring(0, 7)));

    for (let offset = 0; offset < 120; offset++) {
      const dateStr = addMonths(firstDate, offset);
      const monthKey = dateStr.substring(0, 7);
      if (monthKey > targetMonth) break;
      if (existingMonths.has(monthKey)) continue;

      newRows.push({
        user_id: userId,
        description: template.description,
        amount: template.amount,
        type: template.type,
        due_date: dateStr,
        category_id: template.category_id,
        recurring: true,
        group_id: groupId,
      });
    }
  }

  if (newRows.length > 0) {
    // UNIQUE index (group_id, due_date) previne duplicatas mesmo com race condition
    await supabase.from("future_launches").insert(newRows);
  }
}

export function useFutureLaunches() {
  const { user } = useAuth();
  const { data: catMap } = useCategoryMap();
  const qc = useQueryClient();
  const extendedRef = useRef(false);

  // Estende recorrentes UMA VEZ por sessão, fora do queryFn
  useEffect(() => {
    if (!user || extendedRef.current) return;
    extendedRef.current = true;
    extendRecurringLaunches(user.id).then(() => {
      qc.invalidateQueries({ queryKey: ["future-launches"] });
    });
  }, [user, qc]);

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

interface CreateLaunchInput {
  description: string;
  amount: number;
  type: "income" | "expense";
  due_date: string;
  category_id?: string;
  recurring?: boolean;
  installments?: number;
}

export function useCreateFutureLaunch() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (launch: CreateLaunchInput) => {
      const amount = Math.abs(launch.amount);
      if (isNaN(amount) || amount === 0) throw new Error("Valor inválido");

      if (launch.installments && launch.installments > 1) {
        const groupId = crypto.randomUUID();
        const rows = [];
        for (let i = 0; i < launch.installments; i++) {
          rows.push({
            user_id: user!.id,
            description: launch.description,
            amount,
            type: launch.type,
            due_date: addMonths(launch.due_date, i),
            category_id: launch.category_id ?? null,
            recurring: false,
            group_id: groupId,
            parcel_number: i + 1,
            total_parcels: launch.installments,
          });
        }
        const { error } = await supabase.from("future_launches").insert(rows);
        if (error) throw error;
      } else if (launch.recurring) {
        const groupId = crypto.randomUUID();
        const rows = [];
        for (let i = 0; i < 12; i++) {
          rows.push({
            user_id: user!.id,
            description: launch.description,
            amount,
            type: launch.type,
            due_date: addMonths(launch.due_date, i),
            category_id: launch.category_id ?? null,
            recurring: true,
            group_id: groupId,
          });
        }
        const { error } = await supabase.from("future_launches").insert(rows);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("future_launches").insert({
          user_id: user!.id,
          description: launch.description,
          amount,
          type: launch.type,
          due_date: launch.due_date,
          category_id: launch.category_id ?? null,
          recurring: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future-launches"] }),
  });
}

export function useUpdateFutureLaunch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      paid?: boolean;
      amount?: number;
      description?: string;
      due_date?: string;
      category_id?: string | null;
      recurring?: boolean;
      type?: "income" | "expense";
    }) => {
      const cleanUpdates: Record<string, unknown> = {};
      if (updates.paid !== undefined) cleanUpdates.paid = updates.paid;
      if (updates.description !== undefined) cleanUpdates.description = updates.description;
      if (updates.due_date !== undefined) cleanUpdates.due_date = updates.due_date;
      if (updates.recurring !== undefined) cleanUpdates.recurring = updates.recurring;
      if (updates.type !== undefined) cleanUpdates.type = updates.type;
      if (updates.amount !== undefined) cleanUpdates.amount = Math.abs(updates.amount);
      if ("category_id" in updates) cleanUpdates.category_id = updates.category_id ?? null;

      const { error } = await supabase.from("future_launches").update(cleanUpdates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future-launches"] }),
  });
}

export function useUpdateFutureLaunchGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, ...updates }: {
      groupId: string;
      description?: string;
      category_id?: string | null;
      type?: "income" | "expense";
      amount?: number;
    }) => {
      const cleanUpdates: Record<string, unknown> = {};
      if (updates.description !== undefined) cleanUpdates.description = updates.description;
      if (updates.type !== undefined) cleanUpdates.type = updates.type;
      if (updates.amount !== undefined) cleanUpdates.amount = Math.abs(updates.amount);
      if ("category_id" in updates) cleanUpdates.category_id = updates.category_id ?? null;

      const { error } = await supabase
        .from("future_launches")
        .update(cleanUpdates)
        .eq("group_id", groupId);
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

export function useDeleteFutureLaunchGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("future_launches").delete().eq("group_id", groupId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future-launches"] }),
  });
}
