import { useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Trash2, Upload, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useAccounts, useDeleteAccount } from "@/hooks/useAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { decodeOfx, parseOfx, OfxParseError } from "@/lib/ofx";
import { importOfxStatement, type ImportResult } from "@/lib/ofxImport";
import { BankImportPanel, LastImportSummary } from "@/components/BankImportPanel";
import { PageLoader } from "@/components/PageLoader";

// No APK nao existe backend no localhost do Capacitor — URL relativa devolvia o
// index.html ("resposta inesperada do servidor"). Nativo chama a prod direto.
const API_BASE = Capacitor.isNativePlatform() ? "https://myfinances-app.vercel.app" : "";

export default function Banks() {
  const { data: accounts = [], isPending } = useAccounts();
  const { user } = useAuth();
  const qc = useQueryClient();
  const deleteAccount = useDeleteAccount();
  const [message, setMessage] = useState("");
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const afterImport = (results: ImportResult[]) => {
    if (results.length > 0) {
      setExpandedAccount(results[results.length - 1].accountId);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["bank-imports"] });
    }
  };

  const handleOfxFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setImporting(true);
    setMessage("Lendo o extrato...");
    try {
      const statement = parseOfx(decodeOfx(await file.arrayBuffer()));
      const result = await importOfxStatement({
        client: supabase,
        userId: user.id,
        statement,
        fileName: file.name,
        source: "manual",
      });
      const partes = [`${result.imported} transação(ões) importada(s)`];
      if (result.skipped > 0) partes.push(`${result.skipped} já existia(m)`);
      if (result.accountCreated) partes.push("conta criada");
      setMessage(`${partes.join(" · ")}.`);
      afterImport([result]);
    } catch (e) {
      // Erro de parse tem mensagem propria e util; o resto vira mensagem generica.
      setMessage(
        e instanceof OfxParseError
          ? e.message
          : `Erro ao importar o extrato: ${e instanceof Error ? e.message : "desconhecido"}`
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Manda o backend olhar o Gmail agora (mesmo caminho do pg_cron de hora em hora).
  const handleEmailSync = async () => {
    setCheckingEmail(true);
    setMessage("Verificando o e-mail...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("sessão expirada — entre de novo");

      const res = await fetch(`${API_BASE}/api/ofx-email-sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; imports?: Array<ImportResult & { fileName: string }> }
        | null;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (!body?.ok) throw new Error(body?.error ?? "resposta inesperada do servidor");

      const imports = body.imports ?? [];
      if (imports.length === 0) {
        setMessage("Nenhum extrato novo no e-mail.");
      } else {
        const imported = imports.reduce((s, i) => s + i.imported, 0);
        const skipped = imports.reduce((s, i) => s + i.skipped, 0);
        const partes = [
          `${imports.length} extrato(s) do e-mail`,
          `${imported} transação(ões) importada(s)`,
        ];
        if (skipped > 0) partes.push(`${skipped} já existia(m)`);
        if (imports.some((i) => i.accountCreated)) partes.push("conta criada");
        setMessage(`${partes.join(" · ")}.`);
        afterImport(imports);
      }
    } catch (e) {
      setMessage(`Erro ao verificar o e-mail: ${e instanceof Error ? e.message : "desconhecido"}`);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleRemoveAccount = (id: string, bank: string) => {
    if (!confirm(`Remover a conta do ${bank}? As transações vinculadas também serão removidas.`)) return;
    deleteAccount.mutate(id);
  };

  const toggleAccount = (id: string) =>
    setExpandedAccount((cur) => (cur === id ? null : id));

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  if (isPending) {
    return <PageLoader title="Bancos" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold">Bancos</h1>
            <p className="text-muted-foreground">Importe o extrato do banco e acompanhe o saldo</p>
          </div>
          <LastImportSummary />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ofx,application/x-ofx,text/plain"
          className="hidden"
          onChange={(e) => handleOfxFile(e.target.files?.[0])}
        />
        <div className="flex flex-col gap-2">
          <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Importando..." : "Importar extrato (OFX)"}
          </Button>
          <Button variant="outline" onClick={handleEmailSync} disabled={checkingEmail || importing}>
            <Mail className="h-4 w-4 mr-2" />
            {checkingEmail ? "Verificando..." : "Verificar e-mail"}
          </Button>
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Saldo Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Contas</p>
            <p className="text-2xl font-bold">{accounts.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-8">
            Nenhuma conta cadastrada. No app do Inter: <strong>Saldo</strong> → seta ↓ →{" "}
            <strong>Enviar por e-mail</strong>, e importe aqui o arquivo <code>.ofx</code> que
            chegar. A conta é criada na primeira importação.
          </p>
        )}
        {accounts.map((account) => (
          <Card key={account.id} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: account.color }} />
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => toggleAccount(account.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleAccount(account.id);
                }
              }}
              aria-expanded={expandedAccount === account.id}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${account.color}20` }}
                  >
                    <Building2 className="h-5 w-5" style={{ color: account.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{account.bank}</CardTitle>
                    <CardDescription>{account.name}</CardDescription>
                  </div>
                </div>
                {expandedAccount === account.id ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(account.balance)}</p>

              {expandedAccount === account.id && (
                <div className="mt-4 space-y-3 border-t pt-3">
                  <BankImportPanel accountId={account.id} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {importing ? "Importando..." : "Importar extrato (OFX)"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveAccount(account.id, account.bank)}
                      disabled={deleteAccount.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
