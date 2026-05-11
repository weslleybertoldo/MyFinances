import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { supabase } from "@/lib/supabase";

const isNative = Capacitor.isNativePlatform();
const REDIRECT_SCHEME = "com.weslley.myfinances";
const REDIRECT_URL = `${REDIRECT_SCHEME}://login-callback`;

export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (!isNative) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { error: error.message };
    return {};
  }

  // APK — fluxo com deep link
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      return { error: error?.message || "Erro ao iniciar login" };
    }

    let resolveSession!: (v: { error?: string }) => void;
    let resolved = false;
    const sessionPromise = new Promise<{ error?: string }>((resolve) => {
      resolveSession = (v) => {
        if (resolved) return;
        resolved = true;
        resolve(v);
      };
    });
    const timeoutHandle = setTimeout(() => {
      resolveSession({ error: "Login cancelado ou expirado" });
    }, 120000);

    const listenerHandle = await App.addListener("appUrlOpen", async (event) => {
      if (!event.url.startsWith(REDIRECT_SCHEME)) return;
      clearTimeout(timeoutHandle);

      try {
        const hashPart = event.url.includes("#") ? event.url.split("#")[1] : event.url.split("?")[1];
        if (!hashPart) {
          resolveSession({ error: "Resposta de login invalida" });
          return;
        }

        const params = new URLSearchParams(hashPart);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          resolveSession(sessionError ? { error: sessionError.message } : {});
        } else {
          const errorDesc = params.get("error_description") || params.get("error");
          resolveSession({ error: errorDesc || "Tokens nao recebidos" });
        }
      } catch {
        resolveSession({ error: "Erro ao processar login" });
      }

      try { await Browser.close(); } catch { /* ignore */ }
    });

    await Browser.open({ url: data.url, windowName: "_self" });
    try {
      return await sessionPromise;
    } finally {
      clearTimeout(timeoutHandle);
      await listenerHandle.remove();
    }
  } catch {
    return { error: "Erro ao abrir login do Google" };
  }
}
