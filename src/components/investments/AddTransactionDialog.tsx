import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/mock-data";
import {
  ASSET_CLASSES,
  ASSET_CLASS_LABEL,
  assetDisplayName,
  tesouroTicker,
  todayIso,
  type Asset,
  type AssetClass,
  type TxKind,
} from "@/lib/investments";
import {
  useAddTransaction,
  useSearchTickers,
  useTesouroCatalog,
  useUpsertAsset,
} from "@/hooks/useInvestments";
import { KIND_LABEL } from "./shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: Asset[];
  /** Pre-seleciona um ativo existente (clique na linha da tabela). */
  defaultAssetId?: string | null;
}

const NEW = "__novo__";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function num(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? NaN : n;
}

export function AddTransactionDialog({ open, onOpenChange, assets, defaultAssetId }: Props) {
  const [assetChoice, setAssetChoice] = useState<string>(NEW);
  const [assetClass, setAssetClass] = useState<AssetClass>("acao");
  const [tickerQuery, setTickerQuery] = useState("");
  const [picked, setPicked] = useState<{ ticker: string; name: string | null } | null>(null);
  const [tesouroTipo, setTesouroTipo] = useState("");
  const [tesouroVenc, setTesouroVenc] = useState("");
  const [kind, setKind] = useState<TxKind>("buy");
  const [date, setDate] = useState(todayIso());
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [total, setTotal] = useState("");
  const [totalTouched, setTotalTouched] = useState(false);
  const [notes, setNotes] = useState("");

  const upsertAsset = useUpsertAsset();
  const addTx = useAddTransaction();

  const debouncedQuery = useDebounced(tickerQuery, 350);
  const isTesouro = assetClass === "tesouro";
  const search = useSearchTickers(assetChoice === NEW && !isTesouro && !picked ? debouncedQuery : "");
  const catalog = useTesouroCatalog(open && assetChoice === NEW && isTesouro);

  const tipos = useMemo(() => [...new Set((catalog.data?.items ?? []).map((i) => i.tipo))], [catalog.data]);
  const vencimentos = useMemo(
    () => (catalog.data?.items ?? []).filter((i) => i.tipo === tesouroTipo),
    [catalog.data, tesouroTipo]
  );

  // reset ao abrir
  useEffect(() => {
    if (!open) return;
    setAssetChoice(defaultAssetId ?? NEW);
    const existing = assets.find((a) => a.id === defaultAssetId);
    setAssetClass(existing?.assetClass ?? "acao");
    setTickerQuery("");
    setPicked(null);
    setTesouroTipo("");
    setTesouroVenc("");
    setKind("buy");
    setDate(todayIso());
    setQuantity("");
    setUnitPrice("");
    setTotal("");
    setTotalTouched(false);
    setNotes("");
  }, [open, defaultAssetId, assets]);

  // total = qtd x preco enquanto o usuario nao mexer no total
  useEffect(() => {
    if (totalTouched || kind === "dividend") return;
    const q = num(quantity);
    const p = num(unitPrice);
    setTotal(!isNaN(q) && !isNaN(p) ? (q * p).toFixed(2).replace(".", ",") : "");
  }, [quantity, unitPrice, totalTouched, kind]);

  // Tesouro: PU do catalogo pre-preenche o preco
  useEffect(() => {
    if (!isTesouro || !tesouroVenc) return;
    const item = vencimentos.find((v) => v.vencimento === tesouroVenc);
    if (item && !unitPrice) setUnitPrice(item.pu.toFixed(2).replace(".", ","));
  }, [isTesouro, tesouroVenc, vencimentos, unitPrice]);

  const existingAsset = assets.find((a) => a.id === assetChoice);
  const busy = upsertAsset.isPending || addTx.isPending;

  const submit = async () => {
    const q = num(quantity);
    const p = num(unitPrice);
    const t = num(total);
    if (!date) return toast.error("Informe a data");
    if (kind === "dividend") {
      if (isNaN(t) || t <= 0) return toast.error("Informe o valor recebido");
    } else {
      if (isNaN(q) || q <= 0) return toast.error("Informe a quantidade");
      if (isNaN(p) || p <= 0) return toast.error("Informe o preço unitário");
      if (isNaN(t) || t <= 0) return toast.error("Informe o valor total");
    }

    try {
      let assetId = existingAsset?.id;
      if (!assetId) {
        if (isTesouro) {
          if (!tesouroTipo || !tesouroVenc) return toast.error("Escolha o título e o vencimento");
          assetId = await upsertAsset.mutateAsync({
            ticker: tesouroTicker(tesouroTipo, tesouroVenc),
            name: `${tesouroTipo} ${tesouroVenc.slice(0, 4)}`,
            assetClass: "tesouro",
            tesouroTipo,
            tesouroVencimento: tesouroVenc,
          });
        } else {
          const ticker = (picked?.ticker ?? tickerQuery).trim().toUpperCase();
          if (!/^[A-Z0-9]{4,10}$/.test(ticker)) return toast.error("Informe um ticker válido (ex.: BBSE3, MXRF11)");
          assetId = await upsertAsset.mutateAsync({ ticker, name: picked?.name ?? null, assetClass });
        }
      }
      await addTx.mutateAsync({
        assetId,
        kind,
        date,
        quantity: kind === "dividend" ? (isNaN(q) ? 0 : q) : q,
        unitPrice: kind === "dividend" ? (isNaN(p) ? 0 : p) : p,
        total: t,
        notes: notes.trim() || null,
      });
      toast.success(`${KIND_LABEL[kind]} registrada`);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Lançamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Ativo</Label>
            <Select value={assetChoice} onValueChange={setAssetChoice}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW}>+ Novo ativo</SelectItem>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{assetDisplayName(a)} · {ASSET_CLASS_LABEL[a.assetClass]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assetChoice === NEW && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <div className="grid grid-cols-4 gap-1">
                  {ASSET_CLASSES.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={assetClass === c ? "default" : "outline"}
                      className="h-8 text-[11px] px-1"
                      onClick={() => { setAssetClass(c); setPicked(null); setUnitPrice(""); }}
                    >
                      {ASSET_CLASS_LABEL[c]}
                    </Button>
                  ))}
                </div>
              </div>

              {isTesouro ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título</Label>
                    <Select value={tesouroTipo} onValueChange={(v) => { setTesouroTipo(v); setTesouroVenc(""); setUnitPrice(""); }} disabled={catalog.isPending}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={catalog.isPending ? "Carregando…" : "Escolha"} /></SelectTrigger>
                      <SelectContent>
                        {tipos.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vencimento</Label>
                    <Select value={tesouroVenc} onValueChange={(v) => { setTesouroVenc(v); setUnitPrice(""); }} disabled={!tesouroTipo}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Escolha" /></SelectTrigger>
                      <SelectContent>
                        {vencimentos.map((v) => (
                          <SelectItem key={v.vencimento} value={v.vencimento} className="text-xs">
                            {v.vencimento.split("-").reverse().join("/")} · {formatCurrency(v.pu)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {catalog.isError && <p className="col-span-2 text-xs text-destructive">Catálogo do Tesouro indisponível agora. Tente de novo em instantes.</p>}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Ticker</Label>
                  {picked ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{picked.ticker}</p>
                        {picked.name && <p className="text-[11px] text-muted-foreground truncate">{picked.name}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setPicked(null); setTickerQuery(""); }}>Trocar</Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input
                          value={tickerQuery}
                          onChange={(e) => setTickerQuery(e.target.value.toUpperCase())}
                          placeholder="Ex.: BBSE3, MXRF11, BOVA11"
                          className="h-9 pl-8 uppercase"
                          autoComplete="off"
                        />
                        {search.isFetching && <Loader2 className="h-3.5 w-3.5 absolute right-2.5 top-2.5 animate-spin text-muted-foreground" />}
                      </div>
                      {search.data && search.data.length > 0 && (
                        <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
                          {search.data.map((hit) => (
                            <li key={hit.ticker}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-muted text-xs flex items-center justify-between gap-2"
                                onClick={() => { setPicked({ ticker: hit.ticker, name: hit.name }); setAssetClass(hit.assetClass); }}
                              >
                                <span className="min-w-0"><span className="font-semibold">{hit.ticker}</span> <span className="text-muted-foreground truncate">{hit.name}</span></span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{ASSET_CLASS_LABEL[hit.assetClass]}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {tickerQuery.length >= 4 && search.data?.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">Nenhum resultado — o ticker digitado será usado como está.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operação</Label>
              <Select value={kind} onValueChange={(v) => { setKind(v as TxKind); setTotalTouched(false); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Compra</SelectItem>
                  <SelectItem value="sell">Venda</SelectItem>
                  <SelectItem value="dividend">Provento (dividendo/JCP/rendimento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
          </div>

          {kind === "dividend" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Valor recebido (R$)</Label>
              <Input value={total} onChange={(e) => { setTotal(e.target.value); setTotalTouched(true); }} placeholder="0,00" inputMode="decimal" className="h-9" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" inputMode="decimal" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço unit. (R$)</Label>
                <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0,00" inputMode="decimal" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total (R$)</Label>
                <Input value={total} onChange={(e) => { setTotal(e.target.value); setTotalTouched(true); }} placeholder="0,00" inputMode="decimal" className="h-9" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Corretora, taxas…" className="h-9" />
          </div>

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Salvando…" : "Salvar lançamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
