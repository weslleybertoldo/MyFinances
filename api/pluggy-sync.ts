import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "./_rate-limit";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verificar autenticação JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação necessário" });
  }

  const token = authHeader.split(" ")[1];
  const authSupabase = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY!);
  const { data: { user }, error: authError } = await authSupabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  if (user.email?.toLowerCase() !== "weslleybertoldo18@gmail.com") {
    return res.status(403).json({ error: "Acesso negado" });
  }

  // Rate limit: 6 req / 5 min por user (sync e caro: 1 fetchAccounts + N fetchTransactions)
  const rl = rateLimit(`pluggy-sync:${user.id}`, 6, 5 * 60 * 1000);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter ?? 60));
    return res.status(429).json({ error: "Muitas sincronizações, tente em instantes" });
  }

  // userId extraído do JWT verificado, não do body
  const userId = user.id;
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: "itemId required" });

  try {
    const pluggy = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID!,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const syncedAccounts: Array<{ id: string; name: string; balance: number; action: "created" | "updated" }> = [];
    let totalTxSynced = 0;

    // 1. Fetch accounts from Pluggy
    const accountsData = await pluggy.fetchAccounts(itemId);
    const pluggyAccounts = accountsData.results || [];

    for (const pa of pluggyAccounts) {
      // Upsert account in Supabase
      const { data: existing } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("pluggy_account_id", pa.id)
        .maybeSingle();

      let accountDbId: string;

      if (existing) {
        await supabase.from("accounts").update({
          balance: pa.balance,
          connected: true,
          last_sync_at: new Date().toISOString(),
        }).eq("id", existing.id);
        accountDbId = existing.id;
        syncedAccounts.push({ id: existing.id, name: pa.name, balance: pa.balance, action: "updated" });
      } else {
        const bankData = pa.bankData as Record<string, unknown> | undefined;
        const bankName = (bankData?.shortName as string) || (bankData?.name as string) || "Banco";
        const { data: newAcc } = await supabase.from("accounts").insert({
          user_id: userId,
          name: pa.subtype || pa.type || "Conta",
          bank: bankName,
          balance: pa.balance,
          color: "#8B5CF6",
          connected: true,
          pluggy_item_id: itemId,
          pluggy_account_id: pa.id,
          last_sync_at: new Date().toISOString(),
        }).select("id").single();
        accountDbId = newAcc!.id;
        syncedAccounts.push({ id: newAcc?.id, name: pa.name, balance: pa.balance, action: "created" });
      }

      // 2. Fetch transactions for this account
      const txData = await pluggy.fetchTransactions(pa.id, { pageSize: 500 });
      const pluggyTransactions = txData.results || [];

      // Get existing pluggy transaction IDs to avoid duplicates
      const { data: existingTxs } = await supabase
        .from("transactions")
        .select("pluggy_transaction_id")
        .eq("account_id", accountDbId)
        .not("pluggy_transaction_id", "is", null);

      const existingIds = new Set((existingTxs || []).map((t: { pluggy_transaction_id: string }) => t.pluggy_transaction_id));

      // Batch insert new transactions
      const newTransactions = pluggyTransactions
        .filter((pt) => !existingIds.has(pt.id))
        .map((pt) => {
          const dateObj = pt.date instanceof Date ? pt.date : new Date(pt.date || Date.now());
          const date = dateObj.toISOString().split("T")[0];
          return {
            user_id: userId,
            account_id: accountDbId,
            description: pt.description || pt.descriptionRaw || "Sem descrição",
            amount: Math.abs(pt.amount),
            type: pt.type === "CREDIT" ? "income" : "expense",
            date,
            pluggy_transaction_id: pt.id,
          };
        });

      if (newTransactions.length > 0) {
        const { error: upsertError } = await supabase
          .from("transactions")
          .upsert(newTransactions, { onConflict: "user_id,pluggy_transaction_id", ignoreDuplicates: true });
        if (upsertError) {
          console.error("Upsert error:", upsertError.message);
        } else {
          totalTxSynced += newTransactions.length;
        }
      }
    }

    return res.json({ success: true, accounts: syncedAccounts, transactionsSynced: totalTxSynced });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}
