import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { itemId, userId } = req.body;
  if (!itemId || !userId) return res.status(400).json({ error: "itemId and userId required" });

  try {
    const pluggy = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID!,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const syncedAccounts: any[] = [];

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
        const bankName = pa.bankData?.shortName || pa.bankData?.name || "Banco";
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

      for (const pt of pluggyTransactions) {
        // Skip if already synced
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("pluggy_transaction_id", pt.id)
          .maybeSingle();

        if (existingTx) continue;

        const amount = Math.abs(pt.amount);
        const type = pt.type === "CREDIT" ? "income" : "expense";
        const date = pt.date ? pt.date.split("T")[0] : new Date().toISOString().split("T")[0];

        await supabase.from("transactions").insert({
          user_id: userId,
          account_id: accountDbId,
          description: pt.description || pt.descriptionRaw || "Sem descrição",
          amount,
          type,
          date,
          pluggy_transaction_id: pt.id,
        });
      }
    }

    return res.json({ success: true, accounts: syncedAccounts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
