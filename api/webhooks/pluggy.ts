import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function syncItem(itemId: string) {
  const pluggy = new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find which user owns this item
  const { data: account } = await supabase
    .from("accounts")
    .select("user_id")
    .eq("pluggy_item_id", itemId)
    .limit(1)
    .maybeSingle();

  if (!account) return;
  const userId = account.user_id;

  const accountsData = await pluggy.fetchAccounts(itemId);
  for (const pa of accountsData.results || []) {
    const { data: existing } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("pluggy_account_id", pa.id)
      .maybeSingle();

    const accountDbId = existing?.id;
    if (!accountDbId) continue;

    // Update balance
    await supabase.from("accounts").update({
      balance: pa.balance,
      last_sync_at: new Date().toISOString(),
    }).eq("id", accountDbId);

    // Sync new transactions
    const txData = await pluggy.fetchTransactions(pa.id, { pageSize: 500 });
    for (const pt of txData.results || []) {
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("pluggy_transaction_id", pt.id)
        .maybeSingle();

      if (existingTx) continue;

      await supabase.from("transactions").insert({
        user_id: userId,
        account_id: accountDbId,
        description: pt.description || pt.descriptionRaw || "Sem descrição",
        amount: Math.abs(pt.amount),
        type: pt.type === "CREDIT" ? "income" : "expense",
        date: pt.date ? pt.date.split("T")[0] : new Date().toISOString().split("T")[0],
        pluggy_transaction_id: pt.id,
      });
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const event = req.body;

    switch (event.event) {
      case "item/created":
      case "item/updated":
        await syncItem(event.itemId);
        break;
      case "item/error":
        console.error("Pluggy item error:", event.itemId, event.error);
        break;
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return res.json({ received: true });
  }
}
