import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

async function syncItem(itemId: string) {
  const pluggy = new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: process.env.DB_SCHEMA || "public" } });

  // Validate item ownership — only process if a user owns this item
  const { data: account, error: lookupError } = await supabase
    .from("accounts")
    .select("user_id")
    .eq("pluggy_item_id", itemId)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Erro ao verificar dono do item: ${lookupError.message}`);
  }

  if (!account) {
    console.warn(`Webhook ignorado: item ${itemId} não pertence a nenhum usuário`);
    return;
  }
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
    const { error: updateError } = await supabase.from("accounts").update({
      balance: pa.balance,
      last_sync_at: new Date().toISOString(),
    }).eq("id", accountDbId);

    if (updateError) {
      console.error(`Erro ao atualizar conta ${accountDbId}:`, updateError.message);
    }

    // Sync new transactions — bulk upsert com onConflict (mata N+1)
    const txData = await pluggy.fetchTransactions(pa.id, { pageSize: 500 });
    const rows = (txData.results || []).map((pt) => ({
      user_id: userId,
      account_id: accountDbId,
      description: pt.description || pt.descriptionRaw || "Sem descrição",
      amount: Math.abs(pt.amount),
      type: pt.type === "CREDIT" ? "income" : "expense",
      date: pt.date
        ? pt.date instanceof Date
          ? pt.date.toISOString().split("T")[0]
          : String(pt.date).split("T")[0]
        : new Date().toISOString().split("T")[0],
      pluggy_transaction_id: pt.id,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "user_id,pluggy_transaction_id", ignoreDuplicates: true });

      if (upsertError) {
        console.error(`Erro ao upsert transações (${rows.length}):`, upsertError.message);
      }
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Validate webhook secret
  if (!WEBHOOK_SECRET) {
    console.error("WEBHOOK_SECRET não configurado");
    return res.status(500).json({ error: "Webhook secret não configurado" });
  }

  const authHeader = req.headers.authorization;
  const querySecret = req.query?.secret as string | undefined;
  const providedSecret = authHeader?.replace("Bearer ", "") || querySecret || "";

  // Compara contra hash sha256 de tamanho fixo: zero leak via length
  const expectedHash = crypto.createHash("sha256").update(WEBHOOK_SECRET).digest();
  const providedHash = crypto.createHash("sha256").update(providedSecret).digest();
  const isValid = providedSecret.length > 0 && crypto.timingSafeEqual(providedHash, expectedHash);
  if (!isValid) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  try {
    const event = req.body;

    if (!event?.event || !event?.itemId) {
      return res.status(400).json({ error: "Payload inválido: event e itemId obrigatórios" });
    }

    switch (event.event) {
      case "item/created":
      case "item/updated":
        await syncItem(event.itemId);
        break;
      case "item/error":
        console.error("Pluggy item error:", event.itemId, event.error);
        break;
      default:
        console.warn("Evento desconhecido:", event.event);
    }

    return res.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("Webhook error:", message);
    return res.status(500).json({ received: false, error: "Erro ao processar webhook" });
  }
}
