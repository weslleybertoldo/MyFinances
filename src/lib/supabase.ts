import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Schema do ambiente: "public" (prod) ou "staging". Dirige PostgREST.
export const DB_SCHEMA = (import.meta.env.VITE_DB_SCHEMA as string) || "public";

// Caminho B pros dados: proxy /sb na Vercel (rewrite no vercel.json) que repassa
// pro Supabase. Existe porque tem rede (ex.: Wi-Fi com DNS quebrado) que nao
// resolve *.supabase.co mas resolve vercel.app — o site abre e o APK ficava no
// spinner infinito. Nao e segredo: mesma anon key + RLS do caminho direto.
const supabaseProxyUrl =
  (import.meta.env.VITE_SUPABASE_PROXY_URL as string | undefined) ||
  "https://myfinances-app.vercel.app/sb";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios");
}

/** Base em uso no momento. Comeca no direto; vira proxy quando o direto falha de
 *  rede e o proxy responde (e volta, simetricamente). Falha de DNS estoura na
 *  hora (TypeError), entao o failover custa ~nada. */
let activeBase: string = supabaseUrl;

function otherBase(base: string): string {
  return base === supabaseUrl ? supabaseProxyUrl : supabaseUrl;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/** Reescreve a URL do supabase-js (sempre montada sobre supabaseUrl) pra base dada. */
function withBase(url: string, base: string): string {
  if (url.startsWith(supabaseUrl)) return base + url.slice(supabaseUrl.length);
  if (url.startsWith(supabaseProxyUrl)) return base + url.slice(supabaseProxyUrl.length);
  return url;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  url: string,
  init: RequestInit | undefined,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const req = typeof input === "string" || input instanceof URL ? url : new Request(url, input);
    return await fetch(req, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createResilientFetch(retries = 2, timeout = 15000) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: Error | null = null;
    const originalUrl = requestUrl(input);

    for (let attempt = 0; attempt <= retries; attempt++) {
      let response: Response;
      try {
        response = await fetchWithTimeout(input, withBase(originalUrl, activeBase), init, timeout);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Falha de REDE (DNS/timeout/offline): tenta o outro caminho antes de
        // desistir do attempt. Funcionou = ele vira o caminho ativo.
        const fallbackBase = otherBase(activeBase);
        try {
          const viaFallback = await fetchWithTimeout(
            input,
            withBase(originalUrl, fallbackBase),
            init,
            timeout
          );
          activeBase = fallbackBase;
          response = viaFallback;
        } catch {
          if (attempt < retries && lastError.name !== "AbortError") {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw lastError;
        }
      }

      if (response.status === 401 || response.status === 403) {
        return response;
      }

      if ((response.status >= 500 || response.status === 429) && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, delay + Math.random() * 500));
        continue;
      }

      return response;
    }

    throw lastError || new Error("Fetch failed after retries");
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createResilientFetch(2, 15000),
    headers: { "x-schema": DB_SCHEMA },
  },
  db: { schema: DB_SCHEMA as "public" },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
