interface Props {
  title: string;
}

/**
 * Estado de carregamento das abas: titulo + spinner centralizado.
 *
 * As paginas usam `isPending` (react-query) como gate, e nao `isLoading`:
 * durante a restauracao da sessao as queries ficam DESABILITADAS (`enabled: !!user`)
 * e query desabilitada tem `isLoading === false` — a pagina renderizava tudo
 * zerado antes de carregar. `isPending` = "ainda nao tem dado", que e o que importa.
 */
export function PageLoader({ title }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
