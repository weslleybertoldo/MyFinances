import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, RefreshCw } from "lucide-react";

const APP_VERSION = "1.5";

interface VersionInfo {
  version: string;
  apkUrl: string;
  changelog: string;
}

/** Compara versões semânticas (ex: "1.4" vs "1.10"). Retorna true se remote > local */
function isNewerVersion(remote: string, local: string): boolean {
  const rParts = remote.split(".").map(Number);
  const lParts = local.split(".").map(Number);
  const len = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export default function UpdateChecker() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkForUpdates = () => {
    setChecking(true);
    fetch("/version.json?t=" + Date.now())
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: VersionInfo) => {
        setVersionInfo(data);
        setHasUpdate(isNewerVersion(data.version, APP_VERSION));
      })
      .catch((err) => {
        console.warn("Erro ao verificar atualizações:", err.message);
      })
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  if (hasUpdate && versionInfo) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs text-blue-700">
            Nova versão v{versionInfo.version} disponível
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2"
          onClick={() => window.open(versionInfo.apkUrl, "_blank")}
        >
          <Download className="h-3 w-3 mr-1" />
          Baixar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
        <span className="text-xs text-muted-foreground">v{APP_VERSION}</span>
      </div>
      <button
        onClick={checkForUpdates}
        disabled={checking}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
        {checking ? "Verificando..." : "Verificar atualizações"}
      </button>
    </div>
  );
}
