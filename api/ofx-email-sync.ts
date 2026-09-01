// Sincroniza os extratos OFX que o Inter manda por e-mail.
//
// Chamado de dois jeitos:
//   - pg_cron (Supabase) de hora em hora, com `Authorization: Bearer CRON_SECRET`;
//   - botao "Verificar e-mail" na aba Bancos, com o JWT do usuario (+ allowlist).
//
// Le o Gmail via REST com refresh token (escopo gmail.readonly), acha anexos
// .ofx do Inter ainda nao processados (bank_imports.gmail_message_id) e importa
// pelo MESMO parser/dedupe do upload manual. Envs alem das do Supabase:
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, CRON_SECRET.

import { createHash, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { decodeOfx, parseOfx } from "../src/lib/ofx";
import { importOfxStatement, type ImportClient, type ImportResult } from "../src/lib/ofxImport";

export const config = { maxDuration: 60 };

const ALLOWED_EMAIL = "weslleybertoldo18@gmail.com";
const GMAIL_QUERY = "from:no-reply@inter.co filename:ofx newer_than:90d";
const MAX_MESSAGES = 10;
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Compara via sha256 (tamanho fixo) — nao vaza tamanho nem conteudo por timing. */
function secretMatches(candidate: string, secret: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

interface GmailPart {
  filename?: string;
  body?: { attachmentId?: string; data?: string };
  parts?: GmailPart[];
}

/** Anexos .ofx em qualquer nivel da arvore MIME. */
function findOfxParts(part: GmailPart, acc: GmailPart[] = []): GmailPart[] {
  if (part.filename && /\.ofx$/i.test(part.filename)) acc.push(part);
  for (const p of part.parts ?? []) findOfxParts(p, acc);
  return acc;
}

async function gmailAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`refresh do token Google falhou: HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("refresh do token Google veio sem access_token");
  return body.access_token;
}

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL_API}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail ${path.split("?")[0]}: HTTP ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function POST(request: Request): Promise<Response> {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json(500, { error: "Configuração incompleta no servidor" });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "Token de autenticação necessário" });
  }
  const token = authHeader.slice("Bearer ".length);

  const schema = (process.env.DB_SCHEMA || "public") as "public";
  const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as ImportClient;

  // ---- autenticacao: cron (secret) OU usuario (JWT + allowlist) ----
  let userId: string;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secretMatches(token, cronSecret)) {
    const { data, error } = await db.auth.admin.listUsers();
    const owner = data?.users?.find((u) => u.email?.toLowerCase() === ALLOWED_EMAIL);
    if (error || !owner) {
      console.error("[ofx-email-sync] dono da conta nao encontrado", error);
      return json(500, { error: "Configuração incompleta no servidor" });
    }
    userId = owner.id;
  } else {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data.user) return json(401, { error: "Token inválido ou expirado" });
    if (data.user.email?.toLowerCase() !== ALLOWED_EMAIL) {
      return json(403, { error: "Acesso negado" });
    }
    userId = data.user.id;
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GMAIL_REFRESH_TOKEN
  ) {
    return json(503, { error: "Verificação por e-mail ainda não configurada" });
  }

  try {
    const gToken = await gmailAccessToken();

    const list = await gmailGet<{ messages?: { id: string }[] }>(
      gToken,
      `messages?q=${encodeURIComponent(GMAIL_QUERY)}&maxResults=${MAX_MESSAGES}`
    );
    const ids = (list.messages ?? []).map((m) => m.id);
    if (ids.length === 0) return json(200, { ok: true, checked: 0, imports: [] });

    const { data: doneRows, error: doneError } = await db
      .from("bank_imports")
      .select("gmail_message_id")
      .eq("user_id", userId)
      .in("gmail_message_id", ids);
    if (doneError) throw doneError;
    const done = new Set((doneRows ?? []).map((r) => r.gmail_message_id));

    // list vem do mais novo pro mais velho; importa em ordem cronologica.
    const pending = ids.filter((id) => !done.has(id)).reverse();

    const imports: Array<ImportResult & { fileName: string }> = [];
    for (const id of pending) {
      const msg = await gmailGet<{ payload?: GmailPart }>(gToken, `messages/${id}?format=full`);
      // O Inter manda PDF+CSV+OFX no mesmo e-mail; so o primeiro .ofx interessa
      // (dois imports da mesma mensagem violariam o unique de gmail_message_id).
      const part = msg.payload ? findOfxParts(msg.payload)[0] : undefined;
      if (!part) continue;

      let data = part.body?.data;
      if (!data && part.body?.attachmentId) {
        const att = await gmailGet<{ data?: string }>(
          gToken,
          `messages/${id}/attachments/${part.body.attachmentId}`
        );
        data = att.data;
      }
      if (!data) continue;

      const bytes = new Uint8Array(Buffer.from(data, "base64url"));
      const statement = parseOfx(decodeOfx(bytes));
      const result = await importOfxStatement({
        client: db,
        userId,
        statement,
        fileName: part.filename ?? "extrato.ofx",
        source: "email",
        gmailMessageId: id,
      });
      imports.push({ ...result, fileName: part.filename ?? "extrato.ofx" });
    }

    return json(200, { ok: true, checked: ids.length, imports });
  } catch (e) {
    console.error("[ofx-email-sync]", e);
    return json(500, { error: "Falha ao sincronizar com o e-mail" });
  }
}
