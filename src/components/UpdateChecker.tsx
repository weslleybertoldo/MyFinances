import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, RefreshCw, X } from "lucide-react";

const CURRENT_VERSION = __APP_VERSION__;
const GITHUB_REPO = "weslleybertoldo/MyFinances";

function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, "");
  const l = local.replace(/^v/, "");
  const rParts = r.split(".").map(Number);
  const lParts = l.split(".").map(Number);
  const len = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < len; i++) {
    const rv = rParts[i] || 0;
    const lv = lParts[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
}

export default function UpdateChecker() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = () => {
    setChecking(true);
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const remoteVersion = (data.tag_name || "").replace(/^v/, "");
        const apkAsset = data.assets?.find((a: { name: string }) => a.name.endsWith(".apk"));
        const downloadUrl = apkAsset?.browser_download_url || data.html_url;

        setRelease({ version: remoteVersion, downloadUrl });
        setHasUpdate(isNewerVersion(remoteVersion, CURRENT_VERSION));
        setDismissed(false);
      })
      .catch((err) => {
        console.warn("Erro ao verificar atualizações:", err.message);
      })
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  // Notificação de atualização (estilo NutriTrack)
  if (hasUpdate && release && !dismissed) {
    return (
      <Card className="fixed bottom-4 left-4 z-50 p-4 shadow-lg border-blue-200 dark:border-blue-800 bg-background max-w-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Atualização disponível</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              v{CURRENT_VERSION} → v{release.version}
            </p>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => window.open(release.downloadUrl, "_blank")}
            >
              <Download className="h-3 w-3 mr-1" />
              Baixar atualização
            </Button>
          </div>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    );
  }

  // Versão atual no rodapé
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
        <span className="text-xs text-muted-foreground">v{CURRENT_VERSION}</span>
      </div>
      <button
        onClick={checkForUpdates}
        disabled={checking}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
        {checking ? "Verificando..." : "Verificar"}
      </button>
    </div>
  );
}
