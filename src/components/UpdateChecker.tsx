import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, CheckCircle, X } from "lucide-react";

const APP_VERSION = "1.1";

interface VersionInfo {
  version: string;
  apkUrl: string;
  changelog: string;
}

export default function UpdateChecker() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/version.json?t=" + Date.now())
      .then((r) => r.json())
      .then((data: VersionInfo) => {
        setVersionInfo(data);
        setHasUpdate(data.version !== APP_VERSION);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  if (!checked || dismissed) return null;

  if (hasUpdate && versionInfo) {
    return (
      <Card className="border-blue-200 bg-blue-50 mb-4">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-blue-900">
                  Nova versão disponível: v{versionInfo.version}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">{versionInfo.changelog}</p>
                <p className="text-xs text-muted-foreground mt-1">Versão atual: v{APP_VERSION}</p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => window.open(versionInfo.apkUrl, "_blank")}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Baixar v{versionInfo.version}
                </Button>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // App atualizado — mostra por 5 segundos
  return <UpToDateBanner />;
}

function UpToDateBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Card className="border-green-200 bg-green-50 mb-4">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <p className="text-sm text-green-700">App atualizado — v{APP_VERSION}</p>
        </div>
      </CardContent>
    </Card>
  );
}
