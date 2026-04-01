import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link2, Plus, RefreshCw, Building2, Wifi, WifiOff } from "lucide-react";
import { mockAccounts, formatCurrency, type BankAccount } from "@/lib/mock-data";

const availableBanks = [
  { name: "Nubank", color: "hsl(280, 100%, 40%)" },
  { name: "Itaú", color: "hsl(25, 95%, 53%)" },
  { name: "Bradesco", color: "hsl(0, 84%, 60%)" },
  { name: "Banco do Brasil", color: "hsl(47, 96%, 53%)" },
  { name: "Santander", color: "hsl(0, 84%, 50%)" },
  { name: "Caixa", color: "hsl(217, 91%, 60%)" },
  { name: "Inter", color: "hsl(25, 95%, 53%)" },
  { name: "C6 Bank", color: "hsl(220, 10%, 20%)" },
];

export default function Banks() {
  const [accounts, setAccounts] = useState<BankAccount[]>(mockAccounts);
  const [showConnect, setShowConnect] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => setSyncing(null), 2000);
  };

  const handleConnect = (bankName: string, bankColor: string) => {
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      name: "Conta Corrente",
      bank: bankName,
      balance: 0,
      color: bankColor,
      connected: true,
    };
    setAccounts((prev) => [...prev, newAccount]);
    setShowConnect(false);
  };

  const toggleConnection = (id: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, connected: !a.connected } : a))
    );
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const connectedCount = accounts.filter((a) => a.connected).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bancos</h1>
          <p className="text-muted-foreground">Gerencie suas contas bancárias conectadas</p>
        </div>
        <Dialog open={showConnect} onOpenChange={setShowConnect}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Conectar Banco</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar Novo Banco</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione seu banco para conectar via Open Finance (Pluggy)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {availableBanks.map((bank) => (
                <Button
                  key={bank.name}
                  variant="outline"
                  className="h-16 flex flex-col gap-1"
                  onClick={() => handleConnect(bank.name, bank.color)}
                >
                  <Building2 className="h-5 w-5" style={{ color: bank.color }} />
                  <span className="text-xs">{bank.name}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              🔒 Conexão segura via Open Finance / Pluggy
            </p>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview */}
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

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onClick={() => handleSync(account.id)}
                  disabled={!account.connected || syncing === account.id}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncing === account.id ? "animate-spin" : ""}`} />
                  {syncing === account.id ? "Sincronizando..." : "Sincronizar"}
                </Button>
                <Button
                  variant={account.connected ? "destructive" : "default"}
                  size="sm"
                  onClick={() => toggleConnection(account.id)}
                >
                  {account.connected ? "Desconectar" : "Reconectar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
