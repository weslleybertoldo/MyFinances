import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";
import { createClient } from "@supabase/supabase-js";

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

  try {
    const pluggy = new PluggyClient({
      clientId: process.env.PLUGGY_CLIENT_ID!,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
    });

    const connectToken = await pluggy.createConnectToken();

    return res.json({ accessToken: connectToken.accessToken });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
