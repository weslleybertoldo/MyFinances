// Orquestracao da importacao de um extrato OFX para o banco.
//
// Isomorfico: o client do Supabase vem de fora. Na aba Bancos e o client do
// browser (JWT do usuario, RLS cuida do resto); no job de e-mail
// (api/ofx-email-sync) e o client service_role com o schema do ambiente.
// Imports RELATIVOS de proposito: o alias "@/" nao resolve no build das
// functions da Vercel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";
import type { OfxStatement } from "./ofx.js";

export type ImportSource = "manual" | "email";

/** Browser e server usam o mesmo shape de client (schema staging entra com cast). */
export type ImportClient = SupabaseClient<Database>;

export interface ImportResult {
  accountId: string;
  accountCreated: boolean;
  total: number;
  imported: number;
  skipped: number;
}

/** Insere de a 200 pra nao estourar payload nem timeout com extrato longo. */
const CHUNK = 200;

/** O <ORG> do OFX e o nome juridico ("Banco Intermedium S/A"). Encurta os conhecidos. */
function displayBank(org: string, bankId: string): string {
  if (/intermedium|banco inter/i.test(org) || bankId === "077") return "Inter";
  return org || `Banco ${bankId}`;
}

const BANK_COLORS: Record<string, string> = {
  "077": "#FF7A00", // laranja do Inter
};

async function findOrCreateAccount(
  client: ImportClient,
  userId: string,
  statement: OfxStatement
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: findError } = await client
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("ofx_bank_id", statement.bankId)
    .eq("ofx_acct_id", statement.acctId)
    .maybeSingle();
  if (findError) throw findError;

  const balancePatch =
    statement.balance !== null ? { balance: statement.balance } : {};

  if (existing) {
    const { error } = await client
      .from("accounts")
      .update({ ...balancePatch, last_sync_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, created: false };
  }

  const last4 = statement.acctId.slice(-4);
  const { data: created, error } = await client
    .from("accounts")
    .insert({
      user_id: userId,
      bank: displayBank(statement.org, statement.bankId),
      name: `Conta corrente ***${last4}`,
      balance: statement.balance ?? 0,
      color: BANK_COLORS[statement.bankId] ?? "#8B5CF6",
      ofx_bank_id: statement.bankId,
      ofx_acct_id: statement.acctId,
      last_sync_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: created.id, created: true };
}

export async function importOfxStatement(opts: {
  client: ImportClient;
  userId: string;
  statement: OfxStatement;
  fileName: string;
  source: ImportSource;
  /** Mensagem do Gmail de origem (sync por e-mail) — dedupe no nivel do e-mail. */
  gmailMessageId?: string;
}): Promise<ImportResult> {
  const { client, userId, statement, fileName, source, gmailMessageId } = opts;

  const account = await findOrCreateAccount(client, userId, statement);

  const { data: importRow, error: importError } = await client
    .from("bank_imports")
    .insert({
      user_id: userId,
      account_id: account.id,
      source,
      file_name: fileName,
      period_start: statement.periodStart,
      period_end: statement.periodEnd,
      tx_total: statement.transactions.length,
      balance: statement.balance,
      gmail_message_id: gmailMessageId ?? null,
    })
    .select("id")
    .single();
  if (importError) throw importError;

  try {
    const rows = statement.transactions.map((t) => ({
      user_id: userId,
      account_id: account.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: t.date,
      import_key: t.importKey,
      import_source: source,
      import_memo: t.memo,
      ofx_fitid: t.fitid,
      statement_seq: t.daySeq,
      bank_import_id: importRow.id,
    }));

    // ignoreDuplicates: reimportar periodo sobreposto nao duplica nem sobrescreve.
    // O retorno traz SO as linhas realmente inseridas — e daí que sai a contagem.
    let imported = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { data, error } = await client
        .from("transactions")
        .upsert(rows.slice(i, i + CHUNK), {
          onConflict: "user_id,import_key",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      imported += data?.length ?? 0;
    }

    const skipped = rows.length - imported;
    const { error: updateError } = await client
      .from("bank_imports")
      .update({ tx_imported: imported, tx_skipped: skipped })
      .eq("id", importRow.id);
    if (updateError) throw updateError;

    return {
      accountId: account.id,
      accountCreated: account.created,
      total: rows.length,
      imported,
      skipped,
    };
  } catch (e) {
    // Import falhou no meio: remove o registro pra mensagem/arquivo NAO ficar
    // marcado como processado (senao o sync por e-mail pularia pra sempre um
    // extrato que nunca entrou). As transacoes ja inseridas ficam — o dedupe
    // por import_key absorve na proxima tentativa.
    await client.from("bank_imports").delete().eq("id", importRow.id);
    throw e;
  }
}
