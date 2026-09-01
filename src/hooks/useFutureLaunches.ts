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

const EXTEND_THROTTLE_KEY = "myf:lastExtendAt";
const EXTEND_THROTTLE_MS = 12 * 60 * 60 * 1000; // 12h

/** Estende recorrentes pra manter 12 meses à frente. Throttle 12h via localStorage + idempotente via UNIQUE. */
async function extendRecurringLaunches(userId: string) {
  try {
    const last = Number(localStorage.getItem(EXTEND_THROTTLE_KEY)) || 0;
    if (Date.now() - last < EXTEND_THROTTLE_MS) return;
  } catch { /* localStorage indisponivel — segue */ }

  const { data: launches, error } = await supabase
    .from("future_launches")
    .select("*")
    .eq("user_id", userId)
    .eq("recurring", true)
    .not("group_id", "is", null);

  if (error) { console.warn("[FutureLaunches] Erro ao buscar recorrentes:", error.message); return; }
  if (!launches?.length) {
    try { localStorage.setItem(EXTEND_THROTTLE_KEY, String(Date.now())); } catch { /* noop */ }
    return;
  }

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
      // So gera meses DEPOIS do ultimo existente: buraco no meio e exclusao
      // proposital do usuario (Excluir so esta) e nao pode voltar sozinho.
      if (monthKey <= lastMonth) continue;
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
    // UNIQUE (group_id, due_date) previne duplicatas em race entre sessoes
    const { error: insErr } = await supabase
      .from("future_launches")
      .upsert(newRows, { onConflict: "group_id,due_date", ignoreDuplicates: true });
    if (insErr) {
      console.warn("[FutureLaunches] Erro ao estender:", insErr.message);
      return;
    }
  }
  try { localStorage.setItem(EXTEND_THROTTLE_KEY, String(Date.now())); } catch { /* noop */ }
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
    }).catch(e => console.warn("[FutureLaunches] Erro ao estender recorrentes:", e));
  }, [user, qc]);

  return useQuery<FutureLaunch[]>({
    queryKey: ["future-launches", user?.id],
    enabled: !!user && !!catMap,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("future_launches")
        .select("*")
        .eq("user_id", user!.id)
        // created_at/id = desempate estavel: so por due_date, lancamentos do mesmo dia
        // trocavam de posicao a cada UPDATE (o Postgres realoca a tupla).
        .order("due_date")
        .order("created_at")
        .order("id");
      if (error) throw error;
      if (!catMap) return [];
      return (data ?? []).map((row) => mapFutureLaunch(row, catMap));
    },
  });
}

interface CreateLaunchInput {
  description: string;
  amount: number;
  type: "income" | "expense";
  due_date: string;
  category_id?: string;
  card_id?: string;
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

      const cardId = launch.card_id ?? null;

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
            card_id: cardId,
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
            card_id: cardId,
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
          card_id: cardId,
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
      card_id?: string | null;
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
      if ("card_id" in updates) cleanUpdates.card_id = updates.card_id ?? null;

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

/** Limpa card_id de todas as parcelas não pagas do mesmo grupo */
export function useClearCardFromGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId }: { groupId: string }) => {
      const { error } = await supabase
        .from("future_launches")
        .update({ card_id: null })
        .eq("group_id", groupId)
        .eq("paid", false);
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
