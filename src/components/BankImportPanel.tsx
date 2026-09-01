import { Mail, Upload } from "lucide-react";
import {
  useLastBankImports,
  formatImportedAt,
  SOURCE_LABEL,
  type BankImport,
} from "@/hooks/useBankImports";
import { formatDate } from "@/lib/mock-data";

/**
 * Linha compacta do topo da aba Bancos: a importacao mais recente de todas —
 * de onde foi (manual/e-mail), quando, e pra qual banco.
 */
export function LastImportSummary() {
  const { data, isLoading } = useLastBankImports();

  if (isLoading) return null;
  const last = data?.latest ?? null;

  return (
    <div className="text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Última importação
      </p>
      {!last ? (
        <p className="text-muted-foreground">nunca</p>
      ) : (
        <>
          <p className="font-medium">
            {SOURCE_LABEL[last.source]} · {formatImportedAt(last.createdAt)}
            {last.bank ? ` · ${last.bank}` : ""}
          </p>
          {last.periodStart && last.periodEnd && (
            <p className="text-xs text-muted-foreground">
              período {formatDate(last.periodStart)} a {formatDate(last.periodEnd)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ImportLine({
  icon,
  label,
  data,
}: {
  icon: React.ReactNode;
  label: string;
  data: BankImport | null;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        {!data ? (
          <span className="text-muted-foreground">nunca</span>
        ) : (
          <>
            <span className="font-medium">{formatImportedAt(data.createdAt)}</span>
            <span className="text-muted-foreground">
              {" "}
              · {data.txImported} nova{data.txImported === 1 ? "" : "s"}
              {data.txSkipped > 0 && `, ${data.txSkipped} já existia${data.txSkipped === 1 ? "" : "m"}`}
            </span>
            {data.periodStart && data.periodEnd && (
              <div className="text-muted-foreground">
                período {formatDate(data.periodStart)} a {formatDate(data.periodEnd)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Painel completo (por conta), dentro do card do banco: as duas fontes com contagens. */
export function BankImportPanel({ accountId }: { accountId?: string }) {
  const { data, isLoading } = useLastBankImports(accountId);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando importações...</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Última importação
      </p>
      <ImportLine icon={<Upload className="h-3 w-3" />} label="Manual" data={data?.manual ?? null} />
      <ImportLine icon={<Mail className="h-3 w-3" />} label="Por e-mail" data={data?.email ?? null} />
    </div>
  );
}
