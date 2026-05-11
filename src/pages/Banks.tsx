import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Building2, Wifi, WifiOff, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { useAccounts, useDeleteAccount } from "@/hooks/useAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { PluggyConnect } from "react-pluggy-connect";

export default function Banks() {
  const { data: accounts = [], isLoading } = useAccounts();
  const { user, session } = useAuth();
  const qc = useQueryClient();
  const deleteAccount = useDeleteAccount();
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [showPluggy, setShowPluggy] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");

  const openPluggyConnect = async () => {
    try {
      const res = await fetch("/api/pluggy-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.accessToken) {
        setConnectToken(data.accessToken);
        setShowPluggy(true);
      } else {
        setSyncMessage("Erro ao obter token do Pluggy");
      }
    } catch {
      setSyncMessage("Erro de conexão com o servidor");
    }
  };

  const handlePluggySuccess = useCallback(async (data: { item: { id: string } }) => {
    setShowPluggy(false);
    setSyncMessage("Sincronizando dados bancários...");
    try {
      const res = await fetch("/api/pluggy-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ itemId: data.item.id }),
      });
      const result = await res.json();
      if (result.success) {
        setSyncMessage(`Sincronizado! ${result.accounts?.length || 0} conta(s) encontrada(s)`);
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        setSyncMessage(`Erro: ${result.error}`);
      }
    } catch {
      setSyncMessage("Erro ao sincronizar");
    }
  }, [user, session, qc]);

  const handlePluggyError = useCallback((error: { message?: string; code?: string }) => {
    setShowPluggy(false);
    const msg = error?.message || error?.code || "Erro desconhecido";
    setSyncMessage(`Erro na conexão bancária: ${msg}. Tente novamente.`);
  }, []);

  const handleRemoveAccount = (id: string, bank: string) => {
    if (!confirm(`Remover a conta do ${bank}? As transações vinculadas também serão removidas.`)) return;
    deleteAccount.mutate(id);
  };

  const handleSync = async (accountId: string, pluggyItemId: string | null) => {
    if (!pluggyItemId || !user) return;
    setSyncing(accountId);
    setSyncMessage("");
    try {
      const res = await fetch("/api/pluggy-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ itemId: pluggyItemId }),
      });
      const result = await res.json();
      if (result.success) {
        setSyncMessage("Dados atualizados!");
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        setSyncMessage(`Erro: ${result.error}`);
      }
    } catch {
      setSyncMessage("Erro ao sincronizar");
    } finally {
      setSyncing(null);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const connectedCount = accounts.filter((a) => a.connected).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Bancos</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bancos</h1>
          <p className="text-muted-foreground">Gerencie suas contas bancárias conectadas</p>
        </div>
        <Button onClick={openPluggyConnect}>
          <Plus className="h-4 w-4 mr-2" />Conectar Banco
        </Button>
      </div>

      {syncMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          {syncMessage}
        </div>
      )}

      {showPluggy && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={handlePluggySuccess}
          onError={handlePluggyError as unknown as (err: unknown) => void}
          onClose={() => setShowPluggy(false)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Conectadas</p>
            <p className="text-2xl font-bold text-success">{connectedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 && (
          <p className="text-muted-foreground col-span-2 text-center py-8">Nenhuma conta cadastrada. Clique em "Conectar Banco" para começar.</p>
        )}
        {accounts.map((account) => (
          <Card key={account.id} className="overflow-hidden">
            <div className="h-1" style={{ backgroundColor: account.color }} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${account.color}20` }}>
                    <Building2 className="h-5 w-5" style={{ color: account.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{account.bank}</CardTitle>
                    <CardDescription>{account.name}</CardDescription>
                  </div>
                </div>
                <Badge variant={account.connected ? "default" : "secondary"} className="gap-1">
                  {account.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {account.connected ? "Online" : "Offline"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-4">{formatCurrency(account.balance)}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleSync(account.id, account.pluggyItemId)}
                  disabled={!account.connected || syncing === account.id || !account.pluggyItemId}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncing === account.id ? "animate-spin" : ""}`} />
                  {syncing === account.id ? "Sincronizando..." : "Sincronizar"}
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
