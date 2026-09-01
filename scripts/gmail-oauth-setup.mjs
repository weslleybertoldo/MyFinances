#!/usr/bin/env node
// Setup UNICO do OAuth do Gmail pro sync de extrato por e-mail (api/ofx-email-sync).
//
// Pre-requisitos (Google Cloud Console, conta PESSOAL):
//   1. Projeto com a Gmail API habilitada;
//   2. Tela de consentimento OAuth EXTERNA e PUBLICADA ("Em producao" — em modo
//      "Teste" o refresh token EXPIRA EM 7 DIAS e o sync morre sozinho);
//   3. Credencial "ID do cliente OAuth" do tipo "App para computador".
//
// Uso:
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/gmail-oauth-setup.mjs
//
// O script sobe um servidor em http://localhost:8765, imprime a URL de
// consentimento pra abrir no navegador (logado como a conta do Gmail que recebe
// os extratos) e, no callback, troca o code e imprime o GMAIL_REFRESH_TOKEN —
// e so colocar nas envs da Vercel. Nada e gravado em arquivo.

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = Number(process.env.OAUTH_PORT || 8765);
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente.");
  process.exit(1);
}

const state = randomBytes(16).toString("hex");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline", // sem isso nao vem refresh_token
  prompt: "consent",      // forca refresh_token mesmo se ja consentiu antes
  state,
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Link curto pro usuario: http://localhost:8765/start redireciona pro Google
  // (a URL de consentimento completa quebra linha no terminal e chega truncada).
  if (url.pathname === "/" || url.pathname === "/start") {
    res.writeHead(302, { Location: authUrl.toString() }).end();
    return;
  }

  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const fail = (msg) => {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end(msg);
    console.error(msg);
    process.exit(1);
  };

  if (url.searchParams.get("state") !== state) return fail("state não confere — tente de novo.");
  const code = url.searchParams.get("code");
  if (!code) return fail(`Consentimento negado: ${url.searchParams.get("error") ?? "sem code"}`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const tokens = await tokenRes.json();

  if (!tokenRes.ok || !tokens.refresh_token) {
    return fail(`Troca do code falhou (HTTP ${tokenRes.status}): ${JSON.stringify(tokens)}`);
  }

  res
    .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    .end("<h3>Pronto! Pode fechar esta aba — o token está no terminal.</h3>");

  console.log("\n✅ Consentimento OK. Coloque nas envs da Vercel:\n");
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  server.close();
});

server.listen(PORT, () => {
  console.log("Abra no navegador (logado na conta do Gmail que recebe os extratos):\n");
  console.log(authUrl.toString() + "\n");
  console.log(`Aguardando o callback em ${REDIRECT_URI} ...`);
});
