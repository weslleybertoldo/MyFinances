import type { VercelRequest, VercelResponse } from "@vercel/node";

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID!;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 1. Get Pluggy API key
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
    });
    const { apiKey } = await authRes.json();
    if (!apiKey) return res.status(500).json({ error: "Failed to get Pluggy API key" });

    // 2. Create connect token for the widget
    const connectRes = await fetch("https://api.pluggy.ai/connect_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({}),
    });
    const connectData = await connectRes.json();

    return res.json({ accessToken: connectData.accessToken });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
