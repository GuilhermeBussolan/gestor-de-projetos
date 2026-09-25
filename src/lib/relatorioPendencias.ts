import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { nfPendente, pagamentoAtrasado, situacaoDaParceira, SITUACAO_PARCEIRO_CONFIG, totalPago, vencimentoDoMes } from "@/lib/fechamentoNf";
import type { FechamentoParceiro } from "@/types";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

async function gerar(nomeArquivo: string, titulo: string, colunas: { cabecalho: string; largura: number; formato?: string }[], linhas: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(titulo);
  ws.addRow(colunas.map((c) => c.cabecalho)).font = { bold: true };
  colunas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.largura;
    if (c.formato) ws.getColumn(i + 1).numFmt = c.formato;
  });
  linhas.forEach((l) => ws.addRow(l));
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nomeArquivo);
}

/** Excel com as NFs pendentes: parceiras que já confirmaram os valores mas ainda não têm NF validada. */
export async function exportarNfsPendentes(lista: FechamentoParceiro[]) {
  const pendentes = lista.filter(nfPendente).sort((a, b) => a.mesAno.localeCompare(b.mesAno) || a.parceiraNome.localeCompare(b.parceiraNome, "pt-BR"));
  await gerar(
    "nfs-pendentes.xlsx",
    "NFs pendentes",
    [
      { cabecalho: "Mês", largura: 10 },
      { cabecalho: "Parceira", largura: 34 },
      { cabecalho: "Valor calculado", largura: 16, formato: '"R$" #,##0.00' },
      { cabecalho: "Situação", largura: 22 },
      { cabecalho: "NF nº", largura: 14 },
      { cabecalho: "Motivo da rejeição", largura: 40 },
    ],
    pendentes.map((f) => [f.mesAno, f.parceiraNome, f.valor, SITUACAO_PARCEIRO_CONFIG[situacaoDaParceira(f)].label, f.nf?.numero ?? "", f.nf?.motivoRejeicao ?? ""])
  );
}

/** Excel com os pagamentos atrasados: NF validada, ainda não quitado e vencimento vencido. */
export async function exportarPagamentosAtrasados(lista: FechamentoParceiro[], hojeIso: string) {
  const atrasados = lista.filter((f) => pagamentoAtrasado(f, hojeIso)).sort((a, b) => a.mesAno.localeCompare(b.mesAno));
  await gerar(
    "pagamentos-atrasados.xlsx",
    "Pagamentos atrasados",
    [
      { cabecalho: "Mês", largura: 10 },
      { cabecalho: "Parceira", largura: 34 },
      { cabecalho: "NF nº", largura: 14 },
      { cabecalho: "Valor calculado", largura: 16, formato: '"R$" #,##0.00' },
      { cabecalho: "Já pago", largura: 14, formato: '"R$" #,##0.00' },
      { cabecalho: "Saldo", largura: 14, formato: '"R$" #,##0.00' },
      { cabecalho: "Vencimento", largura: 13 },
    ],
    atrasados.map((f) => [f.mesAno, f.parceiraNome, f.nf?.numero ?? "", f.valor, totalPago(f), Math.round((f.valor - totalPago(f)) * 100) / 100, dataBR(vencimentoDoMes(f.mesAno))])
  );
}
