import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "./_rate-limit";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verificar autenticação JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação necessário" });
  }

  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  if (user.email?.toLowerCase() !== "weslleybertoldo18@gmail.com") {
    return res.status(403).json({ error: "Acesso negado" });
  }

  // Rate limit: 10 req / 5 min por user (token endpoint cobra na Pluggy)
  const rl = rateLimit(`pluggy-token:${user.id}`, 10, 5 * 60 * 1000);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter ?? 60));
    return res.status(429).json({ error: "Muitas requisições, tente em instantes" });
  }

  try {
    const pluggy = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID!,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
    });

    const connectToken = await pluggy.createConnectToken();

    return res.json({ accessToken: connectToken.accessToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro Pluggy";
    console.error("[pluggy-token]", msg);
    return res.status(500).json({ error: "Erro ao criar connect token" });
  }
}
