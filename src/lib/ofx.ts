// Parser de extrato OFX (OFXSGML 1.0x) — testado com o extrato do Banco Inter.
//
// Isomorfico de proposito: nao usa nada de Node nem de browser alem de TextDecoder,
// pra este mesmo arquivo servir tanto pro upload na tela quanto pro job que vai
// ler o anexo do Gmail depois.

export interface OfxTransaction {
  /** FITID cru do arquivo. Guardado so como referencia — NAO serve de chave (ver importKey). */
  fitid: string;
  /** YYYY-MM-DD */
  date: string;
  /** Sempre positivo. O sinal vive em `type`, igual ao resto do app. */
  amount: number;
  type: "income" | "expense";
  /** Contraparte limpa (<NAME>), com fallback pro <MEMO>. */
  description: string;
  /** <MEMO> cru, preservado pra rastreio (traz CNPJ da contraparte nos Pix). */
  memo: string;
  /** Chave de dedupe estavel. Ver comentario em `buildImportKey`. */
  importKey: string;
  /**
   * Sequencia da transacao DENTRO do dia. O extrato do Inter nao traz hora, mas o
   * sufixo numerico do FITID cresce na ordem do dia (0771 = 1a, 0772 = 2a, ...) —
   * o numero nao e o indice puro (embute o 077), mas e MONOTONICO nele, que e o
   * que importa pra ordenar. Fallback: posicao no arquivo dentro do dia.
   */
  daySeq: number;
}

export interface OfxStatement {
  org: string;
  bankId: string;
  branchId: string;
  acctId: string;
  acctType: string;
  /** YYYY-MM-DD */
  periodStart: string | null;
  periodEnd: string | null;
  /** <LEDGERBAL> — saldo da conta na data `balanceDate`. */
  balance: number | null;
  balanceDate: string | null;
  /** Ordem crescente de data (o arquivo do Inter vem decrescente). */
  transactions: OfxTransaction[];
}

export class OfxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfxParseError";
  }
}

/**
 * Decodifica os bytes do arquivo.
 *
 * O header do Inter declara `CHARSET:1252` mas o arquivo e UTF-8 de verdade —
 * confiar no header quebra os acentos. Entao: tenta UTF-8 estrito e so cai pra
 * windows-1252 se o conteudo nao for UTF-8 valido.
 */
export function decodeOfx(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("windows-1252").decode(view);
  }
}

/** Le uma tag simples dentro de um bloco. Aceita com e sem tag de fechamento. */
function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`).exec(block);
  return m ? m[1].trim() : "";
}

/** OFX usa YYYYMMDD, podendo vir com hora/timezone colados (YYYYMMDDHHMMSS[-3:BRT]). */
function ofxDate(raw: string): string | null {
  const d = raw.replace(/[^\d]/g, "").slice(0, 8);
  if (d.length !== 8) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function ofxAmount(raw: string): number {
  let s = raw.replace(/\s/g, "");
  // Valor com virgula decimal (nao e o caso do Inter, mas outros bancos usam).
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Normaliza texto pra compor chave: sem acento, minusculo, so alfanumerico. */
function slug(text: string, maxLen: number): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

/**
 * Chave de dedupe.
 *
 * Nao usa FITID porque o do Inter e `DTPOSTED || '077' || indice-no-dia`, ou seja,
 * a POSICAO da transacao dentro do dia: se o banco inserir uma transacao no meio do
 * dia num export posterior, os indices deslocam e o mesmo FITID passa a apontar pra
 * outra transacao (reimportar duplicaria e sobrescreveria errado).
 *
 * A chave aqui e data + valor assinado + memo + numero da ocorrencia entre transacoes
 * IDENTICAS. Isso e estavel sob reordenacao, porque o indice de ocorrencia so conta
 * entre linhas indistinguiveis entre si — e o caso existe de verdade (2 Pix de R$ 5,10
 * pro mesmo CNPJ no mesmo dia).
 */
function buildImportKey(
  acct: { bankId: string; acctId: string },
  tx: { date: string; signedAmount: number; memo: string },
  occurrence: number
): string {
  const cents = Math.round(tx.signedAmount * 100);
  return [
    "ofx",
    acct.bankId || "0",
    acct.acctId || "0",
    tx.date,
    cents,
    slug(tx.memo, 48) || "sem-memo",
    occurrence,
  ].join(":");
}

export function parseOfx(text: string): OfxStatement {
  if (!/<OFX>/i.test(text)) {
    throw new OfxParseError("Arquivo nao parece ser OFX (nao achei a tag <OFX>).");
  }

  const stmts = [...text.matchAll(/<STMTRS>([\s\S]*?)<\/STMTRS>/gi)];
  if (stmts.length === 0) {
    throw new OfxParseError(
      "OFX sem extrato de conta corrente (<STMTRS>). Extrato de cartao/investimento nao e suportado."
    );
  }
  if (stmts.length > 1) {
    throw new OfxParseError(
      `O arquivo tem ${stmts.length} contas. Exporte o extrato de uma conta por vez.`
    );
  }

  const body = stmts[0][1];
  const acctBlock = /<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i.exec(body)?.[1] ?? "";
  const balBlock = /<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i.exec(body)?.[1] ?? "";
  const fiBlock = /<FI>([\s\S]*?)<\/FI>/i.exec(text)?.[1] ?? "";

  const acct = {
    bankId: tag(acctBlock, "BANKID"),
    acctId: tag(acctBlock, "ACCTID"),
  };

  const balRaw = tag(balBlock, "BALAMT");
  const balance = balRaw ? ofxAmount(balRaw) : NaN;

  // Contador de ocorrencias por (data, valor, memo) — base do indice na importKey.
  const seen = new Map<string, number>();
  // Posicao no arquivo dentro de cada dia — fallback do daySeq.
  const posNoDia = new Map<string, number>();
  const transactions: OfxTransaction[] = [];

  for (const [, block] of text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const date = ofxDate(tag(block, "DTPOSTED"));
    const signedAmount = ofxAmount(tag(block, "TRNAMT"));
    if (!date || !Number.isFinite(signedAmount)) continue;

    const memo = tag(block, "MEMO");
    const name = tag(block, "NAME");

    const fitid = tag(block, "FITID");
    const dateDigits = date.replace(/-/g, "");
    const pos = (posNoDia.get(date) ?? 0) + 1;
    posNoDia.set(date, pos);
    let daySeq = pos;
    if (fitid.startsWith(dateDigits)) {
      const suffix = fitid.slice(dateDigits.length);
      if (/^\d{1,12}$/.test(suffix)) daySeq = Number(suffix);
    }

    const dedupeBase = `${date}|${Math.round(signedAmount * 100)}|${slug(memo, 48)}`;
    const occurrence = seen.get(dedupeBase) ?? 0;
    seen.set(dedupeBase, occurrence + 1);

    transactions.push({
      fitid,
      date,
      amount: Math.abs(signedAmount),
      type: signedAmount >= 0 ? "income" : "expense",
      description: name || memo || "Sem descricao",
      memo,
      importKey: buildImportKey(acct, { date, signedAmount, memo }, occurrence),
      daySeq,
    });
  }

  if (transactions.length === 0) {
    throw new OfxParseError("Nenhuma transacao encontrada no arquivo.");
  }

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.daySeq - b.daySeq));

  return {
    org: tag(fiBlock, "ORG"),
    bankId: acct.bankId,
    branchId: tag(acctBlock, "BRANCHID"),
    acctId: acct.acctId,
    acctType: tag(acctBlock, "ACCTTYPE"),
    periodStart: ofxDate(tag(body, "DTSTART")),
    periodEnd: ofxDate(tag(body, "DTEND")),
    balance: Number.isFinite(balance) ? balance : null,
    balanceDate: ofxDate(tag(balBlock, "DTASOF")),
    transactions,
  };
}
