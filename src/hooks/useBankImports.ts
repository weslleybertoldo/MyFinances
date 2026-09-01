import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { ImportSource } from "@/lib/ofxImport";

export interface BankImport {
  id: string;
  source: ImportSource;
  /** Banco da conta destino (join em accounts), ex. "Inter". */
  bank: string | null;
  fileName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  txTotal: number;
  txImported: number;
  txSkipped: number;
  createdAt: string;
}

export interface LastImports {
  /** A mais recente de todas, independente da fonte — a linha compacta do topo. */
  latest: BankImport | null;
  manual: BankImport | null;
  email: BankImport | null;
}

/**
 * Ultimas importacoes. Sem `accountId` considera todas as contas (linha do topo);
 * com `accountId`, so as da conta (painel dentro do card do banco).
 */
export function useLastBankImports(accountId?: string) {
  const { user } = useAuth();

  return useQuery<LastImports>({
    queryKey: ["bank-imports", user?.id, accountId ?? "todas"],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("bank_imports")
        .select("*, accounts(bank)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (accountId) query = query.eq("account_id", accountId);

      const { data, error } = await query;
      if (error) throw error;

      const latest: LastImports = { latest: null, manual: null, email: null };
      for (const row of data ?? []) {
        const source = row.source as ImportSource;
        if (source !== "manual" && source !== "email") continue;
        const item: BankImport = {
          id: row.id,
          source,
          bank: (row.accounts as { bank: string } | null)?.bank ?? null,
          fileName: row.file_name,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          txTotal: row.tx_total,
          txImported: row.tx_imported,
          txSkipped: row.tx_skipped,
          createdAt: row.created_at,
        };
        if (!latest.latest) latest.latest = item;
        if (!latest[source]) latest[source] = item;
      }
      return latest;
    },
  });
}

/** "01/09/2026 às 14:25" no fuso de Brasilia (created_at vem em UTC). */
export function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

export const SOURCE_LABEL: Record<ImportSource, string> = {
  manual: "Manual",
  email: "Por e-mail",
};
