import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PluggyClient } from "pluggy-sdk";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
