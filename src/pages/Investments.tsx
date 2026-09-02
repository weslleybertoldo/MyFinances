import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Plus, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageLoader } from "@/components/PageLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  portfolioTotals,
  summarizeAssets,
  summarizeClasses,
  todayIso,
} from "@/lib/investments";
import {
  useClassTargets,
  useInvestmentAssets,
  useInvestmentQuotes,
  useInvestmentTransactions,
  useQuotesSync,
  useRefreshQuotes,
} from "@/hooks/useInvestments";
import { InvestmentsDashboard } from "@/components/investments/InvestmentsDashboard";
import { InvestmentsAssets } from "@/components/investments/InvestmentsAssets";
import { AddTransactionDialog } from "@/components/investments/AddTransactionDialog";

const TAB_STORAGE = "myf.investimentos.aba";

export default function Investments() {
  const { data: assets = [], isPending: assetsPending } = useInvestmentAssets();
  const { data: txs = [], isPending: txsPending } = useInvestmentTransactions();
  const { data: targets, isPending: targetsPending } = useClassTargets();
  const tickers = useMemo(() => assets.map((a) => a.ticker), [assets]);
  const { data: quotes = {}, isPending: quotesPending } = useInvestmentQuotes(tickers);
  const sync = useQuotesSync(tickers);
  const refresh = useRefreshQuotes();

  const [tab, setTab] = useState<string>(() => {
    try {
      return localStorage.getItem(TAB_STORAGE) === "ativos" ? "ativos" : "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addAssetId, setAddAssetId] = useState<string | null>(null);

  const today = todayIso();
  const safeTargets = useMemo(() => targets ?? { acao: 25, fii: 25, etf: 25, tesouro: 25 }, [targets]);
  const summaries = useMemo(
    () => summarizeAssets(assets, txs, quotes, safeTargets, today),
    [assets, txs, quotes, safeTargets, today]
  );
  const classes = useMemo(() => summarizeClasses(summaries, safeTargets), [summaries, safeTargets]);
  const totals = useMemo(() => portfolioTotals(summaries, assets, txs, quotes, today), [summaries, assets, txs, quotes, today]);

  const updatedAt = useMemo(() => {
    let latest: string | null = null;
    for (const t of tickers) {
      const u = quotes[t]?.updatedAt;
      if (u && (!latest || u > latest)) latest = u;
    }
    return latest;
  }, [quotes, tickers]);

  const openAdd = (assetId?: string) => {
    setAddAssetId(assetId ?? null);
    setAddOpen(true);
  };

  const changeTab = (v: string) => {
    setTab(v);
    try {
      localStorage.setItem(TAB_STORAGE, v);
    } catch {
      /* sem storage */
    }
  };

  if (assetsPending || txsPending || targetsPending || (tickers.length > 0 && quotesPending)) {
    return <PageLoader title="Investimentos" />;
  }

  const syncErrors = sync.data?.errors ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Investimentos</h1>
          {tickers.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {sync.isFetching
                ? "Atualizando cotações…"
                : updatedAt
                  ? `Cotações atualizadas ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: ptBR })} · B3 / Yahoo / Tesouro`
                  : "Sem cotações ainda"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tickers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={refresh.isPending || sync.isFetching}
              onClick={() =>
                refresh.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success(
                      r.refreshed.length > 0
                        ? `${r.refreshed.length} cotação(ões) atualizada(s)${r.dividendsCreated ? ` · ${r.dividendsCreated} provento(s) novo(s)` : ""}`
                        : "Cotações já estavam atualizadas"
                    ),
                  onError: (e) => toast.error(`Não atualizou: ${(e as Error).message}`),
                })
              }
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refresh.isPending || sync.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs" onClick={() => openAdd()}>
            <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Lançamento
          </Button>
        </div>
      </div>

      {syncErrors.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium">Cotação indisponível pra {syncErrors.length} ativo(s)</p>
            <p className="text-muted-foreground truncate">{syncErrors.map((e) => `${e.ticker}: ${e.error}`).join(" · ")}</p>
          </div>
        </div>
      )}

      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum ativo na carteira</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Registre sua primeira compra (ação, FII, ETF ou Tesouro Direto). A cotação vem sozinha da B3, Yahoo e Tesouro Transparente.
            </p>
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="h-4 w-4 mr-1" />Adicionar Lançamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="ativos">Meus ativos</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <InvestmentsDashboard totals={totals} classes={classes} summaries={summaries} assets={assets} txs={txs} quotes={quotes} today={today} />
          </TabsContent>
          <TabsContent value="ativos" className="mt-4">
            <InvestmentsAssets summaries={summaries} classes={classes} targets={safeTargets} assets={assets} txs={txs} onAddTransaction={openAdd} />
          </TabsContent>
        </Tabs>
      )}

      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} assets={assets} defaultAssetId={addAssetId} />
    </div>
  );
}
