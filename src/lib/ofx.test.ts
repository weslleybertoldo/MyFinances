import { describe, it, expect } from "vitest";
import { parseOfx, decodeOfx, OfxParseError } from "@/lib/ofx";

// Fixture sintetico no formato exato do Banco Inter (OFXSGML 102, ordem decrescente
// de data, FITID = DTPOSTED + "077" + indice-no-dia). Dados inventados de proposito:
// o repo e publico, extrato real nao entra aqui.
function ofx(transactions: string, opts: { accounts?: number } = {}) {
  const stmt = (acctId: string) => `
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>077</BANKID>
<BRANCHID>0001-9</BRANCHID>
<ACCTID>${acctId}</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260604</DTSTART>
<DTEND>20260901</DTEND>
${transactions}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1483.68</BALAMT>
<DTASOF>20260901</DTASOF>
</LEDGERBAL>
</STMTRS>`;
  const accounts = opts.accounts ?? 1;
  const bodies = Array.from({ length: accounts }, (_, i) => stmt(`9999${i}`)).join("\n");
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<DTSERVER>20260901</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
<FI>
<ORG>Banco Intermedium S/A</ORG>
<FID>077</FID>
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
${bodies}
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
}

const tx = (o: {
  type: string;
  date: string;
  amt: string;
  fitid: string;
  memo: string;
  name?: string;
}) => `<STMTTRN>
<TRNTYPE>${o.type}</TRNTYPE>
<DTPOSTED>${o.date}</DTPOSTED>
<TRNAMT>${o.amt}</TRNAMT>
<FITID>${o.fitid}</FITID>
<CHECKNUM>077</CHECKNUM>
<REFNUM>077</REFNUM>
<MEMO>${o.memo}</MEMO>
${o.name ? `<NAME>${o.name}</NAME>` : ""}
</STMTTRN>`;

const CREDITO_ARGS = {
  type: "CREDIT",
  date: "20260901",
  amt: "4000.00",
  fitid: "202609010771",
  memo: 'Pix recebido: "Cp :11111111-EMPRESA EXEMPLO LTDA"',
  name: "Empresa Exemplo Ltda",
};
const CREDITO = tx(CREDITO_ARGS);
const DEBITO = tx({
  type: "PAYMENT",
  date: "20260830",
  amt: "-584.71",
  fitid: "202608300771",
  memo: 'Pagamento efetuado: "CONTA DE LUZ"',
  name: "Conta De Luz",
});

describe("parseOfx — conta e periodo", () => {
  it("le identidade da conta, periodo e saldo do LEDGERBAL", () => {
    const s = parseOfx(ofx([CREDITO, DEBITO].join("\n")));
    expect(s.bankId).toBe("077");
    expect(s.branchId).toBe("0001-9");
    expect(s.acctId).toBe("99990");
    expect(s.acctType).toBe("CHECKING");
    expect(s.org).toBe("Banco Intermedium S/A");
    expect(s.periodStart).toBe("2026-06-04");
    expect(s.periodEnd).toBe("2026-09-01");
    expect(s.balance).toBe(1483.68);
    expect(s.balanceDate).toBe("2026-09-01");
  });
});

describe("parseOfx — transacoes", () => {
  it("usa NAME como descricao e preserva o MEMO cru", () => {
    const [primeira] = parseOfx(ofx(CREDITO)).transactions;
    expect(primeira.description).toBe("Empresa Exemplo Ltda");
    expect(primeira.memo).toContain("Pix recebido");
    expect(primeira.memo).toContain("11111111");
  });

  it("cai pro MEMO quando nao tem NAME", () => {
    const semName = tx({
      type: "PAYMENT",
      date: "20260901",
      amt: "-10.00",
      fitid: "202609010771",
      memo: "Tarifa avulsa",
    });
    expect(parseOfx(ofx(semName)).transactions[0].description).toBe("Tarifa avulsa");
  });

  it("guarda valor sempre positivo e poe o sinal no type", () => {
    const s = parseOfx(ofx([CREDITO, DEBITO].join("\n")));
    const credito = s.transactions.find((t) => t.description === "Empresa Exemplo Ltda")!;
    const debito = s.transactions.find((t) => t.description === "Conta De Luz")!;
    expect(credito.amount).toBe(4000);
    expect(credito.type).toBe("income");
    expect(debito.amount).toBe(584.71);
    expect(debito.type).toBe("expense");
  });

  it("ordena crescente por data (o arquivo do Inter vem decrescente)", () => {
    const s = parseOfx(ofx([CREDITO, DEBITO].join("\n")));
    expect(s.transactions.map((t) => t.date)).toEqual(["2026-08-30", "2026-09-01"]);
  });

  it("aceita DTPOSTED com hora e timezone colados", () => {
    const comHora = tx({
      type: "CREDIT",
      date: "20260901120000[-3:BRT]",
      amt: "1.00",
      fitid: "202609010771",
      memo: "x",
    });
    expect(parseOfx(ofx(comHora)).transactions[0].date).toBe("2026-09-01");
  });

  it("aceita valor com virgula decimal (outros bancos)", () => {
    const comVirgula = tx({
      type: "PAYMENT",
      date: "20260901",
      amt: "-1234,56",
      fitid: "202609010771",
      memo: "x",
    });
    expect(parseOfx(ofx(comVirgula)).transactions[0].amount).toBe(1234.56);
  });
});

describe("importKey — a parte que protege contra duplicata", () => {
  it("NAO depende do FITID: mesmo conteudo com FITID diferente da a mesma chave", () => {
    // Cenario real: o Inter insere uma transacao no meio do dia num export posterior,
    // os indices deslocam e o FITID da mesma transacao muda.
    const antes = parseOfx(ofx(tx({ ...CREDITO_ARGS, fitid: "202609010772" })));
    const depois = parseOfx(ofx(tx({ ...CREDITO_ARGS, fitid: "202609010775" })));
    expect(antes.transactions[0].importKey).toBe(depois.transactions[0].importKey);
    expect(antes.transactions[0].fitid).not.toBe(depois.transactions[0].fitid);
  });

  it("distingue duas transacoes IDENTICAS no mesmo dia (caso real: 2 Pix iguais)", () => {
    const igual = tx({
      type: "PAYMENT",
      date: "20260811",
      amt: "-5.10",
      fitid: "202608110771",
      memo: 'Pix enviado: "Cp :22222222-TECNOLOGIA LTDA"',
    });
    const outro = tx({
      type: "PAYMENT",
      date: "20260811",
      amt: "-5.10",
      fitid: "202608110772",
      memo: 'Pix enviado: "Cp :22222222-TECNOLOGIA LTDA"',
    });
    const chaves = parseOfx(ofx([igual, outro].join("\n"))).transactions.map((t) => t.importKey);
    expect(new Set(chaves).size).toBe(2);
    expect(chaves[0].endsWith(":0")).toBe(true);
    expect(chaves[1].endsWith(":1")).toBe(true);
  });

  it("separa entrada de saida do mesmo valor no mesmo dia", () => {
    const entrada = tx({ type: "CREDIT", date: "20260901", amt: "50.00", fitid: "a", memo: "x" });
    const saida = tx({ type: "PAYMENT", date: "20260901", amt: "-50.00", fitid: "b", memo: "x" });
    const chaves = parseOfx(ofx([entrada, saida].join("\n"))).transactions.map((t) => t.importKey);
    expect(new Set(chaves).size).toBe(2);
  });

  it("gera chaves unicas pro extrato inteiro", () => {
    const muitas = Array.from({ length: 30 }, (_, i) =>
      tx({
        type: "PAYMENT",
        date: `202608${String((i % 28) + 1).padStart(2, "0")}`,
        amt: `-${i + 1}.00`,
        fitid: `x${i}`,
        memo: `Compra no debito: "LOJA ${i}"`,
      })
    );
    const s = parseOfx(ofx(muitas.join("\n")));
    expect(new Set(s.transactions.map((t) => t.importKey)).size).toBe(s.transactions.length);
  });
});

describe("daySeq — ordem dentro do dia (o extrato nao traz hora)", () => {
  it("extrai a sequencia do sufixo do FITID e ordena o mesmo dia por ela", () => {
    // Arquivo em ordem decrescente de data e, dentro do dia, sequencia crescente —
    // exatamente como o Inter exporta.
    const dia = [
      tx({ type: "CREDIT", date: "20260901", amt: "1.00", fitid: "202609010771", memo: "primeira do dia" }),
      tx({ type: "PAYMENT", date: "20260901", amt: "-2.00", fitid: "202609010772", memo: "segunda do dia" }),
      tx({ type: "PAYMENT", date: "20260901", amt: "-3.00", fitid: "202609010773", memo: "terceira do dia" }),
    ];
    const s = parseOfx(ofx(dia.join("\n")));
    expect(s.transactions.map((t) => t.daySeq)).toEqual([771, 772, 773]);
    expect(s.transactions.map((t) => t.memo)).toEqual([
      "primeira do dia",
      "segunda do dia",
      "terceira do dia",
    ]);
  });

  it("sequencia e monotonica quando o indice passa de 9 (0779 < 07710)", () => {
    const dia = Array.from({ length: 12 }, (_, i) =>
      tx({ type: "PAYMENT", date: "20260901", amt: `-${i + 1}.00`, fitid: `20260901077${i + 1}`, memo: `x${i + 1}` })
    );
    const s = parseOfx(ofx(dia.join("\n")));
    const seqs = s.transactions.map((t) => t.daySeq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(s.transactions[11].memo).toBe("x12");
  });

  it("cai pra posicao no arquivo quando o FITID nao segue o padrao data+numero", () => {
    const dia = [
      tx({ type: "PAYMENT", date: "20260901", amt: "-1.00", fitid: "abc-1", memo: "a" }),
      tx({ type: "PAYMENT", date: "20260901", amt: "-2.00", fitid: "abc-2", memo: "b" }),
    ];
    const s = parseOfx(ofx(dia.join("\n")));
    expect(s.transactions.map((t) => t.daySeq)).toEqual([1, 2]);
  });
});

describe("parseOfx — erros claros em vez de importacao errada", () => {
  it("recusa arquivo que nao e OFX", () => {
    expect(() => parseOfx("isso aqui e um PDF")).toThrow(OfxParseError);
  });

  it("recusa OFX sem extrato de conta corrente", () => {
    expect(() => parseOfx("<OFX><CREDITCARDMSGSRSV1></CREDITCARDMSGSRSV1></OFX>")).toThrow(
      /conta corrente/i
    );
  });

  it("recusa arquivo com mais de uma conta em vez de importar a errada", () => {
    expect(() => parseOfx(ofx(CREDITO, { accounts: 2 }))).toThrow(/uma conta por vez/i);
  });

  it("recusa extrato sem nenhuma transacao", () => {
    expect(() => parseOfx(ofx(""))).toThrow(/Nenhuma transacao/i);
  });
});

describe("decodeOfx — o header do Inter mente sobre o charset", () => {
  it("decodifica UTF-8 mesmo com CHARSET:1252 no header", () => {
    const bytes = new TextEncoder().encode("CHARSET:1252\n<OFX>Alimentação, Saúde</OFX>");
    expect(decodeOfx(bytes)).toContain("Alimentação, Saúde");
  });

  it("cai pra windows-1252 quando o arquivo realmente nao e UTF-8", () => {
    // 0xE7 0xE3 = "çã" em windows-1252, sequencia invalida em UTF-8.
    const bytes = new Uint8Array([0x41, 0x6c, 0x69, 0x6d, 0x65, 0x6e, 0x74, 0x61, 0xe7, 0xe3, 0x6f]);
    expect(decodeOfx(bytes)).toBe("Alimentação");
  });
});
