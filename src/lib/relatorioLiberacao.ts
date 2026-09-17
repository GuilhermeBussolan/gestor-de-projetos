import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { STATUS_FATURAMENTO_ORDEM, STATUS_PARCELA_CONFIG } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto, StatusParcela } from "@/types";

export interface LinhaLiberacao {
  projetoId: string;
  numero: number;
  cliente: string;
  parcela: string;
  valor: number;
  contato: string;
  cnpj: string;
  email: string;
  emailNF: string;
  status: StatusParcela;
  dataLiberacao: number | null;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Todas as parcelas que já entraram na rotina de faturamento (tudo, exceto "Aguardando"). */
export function montarRelatorioLiberacao(projetos: Projeto[], clientes: Cliente[]): LinhaLiberacao[] {
  const linhas: LinhaLiberacao[] = [];
  for (const projeto of projetos) {
    const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId));
    for (const parc of projeto.financeiro?.parcelas ?? []) {
      if (!STATUS_FATURAMENTO_ORDEM.includes(parc.status)) continue;
      linhas.push({
        projetoId: projeto.id,
        numero: parc.numero,
        cliente,
        parcela: parc.descricao ? parc.descricao : `Parcela ${parc.numero}`,
        valor: parc.valor,
        contato: projeto.contatoFaturamento?.nome ?? "",
        cnpj: projeto.contatoFaturamento?.cnpj ?? "",
        email: projeto.contatoFaturamento?.email ?? "",
        emailNF: projeto.contatoFaturamento?.emailNF ?? "",
        status: parc.status,
        dataLiberacao: parc.dataLiberacao ?? null,
      });
    }
  }
  return linhas.sort((a, b) => (b.dataLiberacao ?? 0) - (a.dataLiberacao ?? 0));
}

const CABECALHO = ["Cliente", "Parcela", "Valor a faturar", "Contato", "CNPJ", "E-mail", "E-mail para NF", "Status"];

function linhaParaCelulas(l: LinhaLiberacao): string[] {
  return [
    l.cliente,
    l.parcela,
    moeda(l.valor),
    l.contato || "—",
    l.cnpj || "—",
    l.email || "—",
    l.emailNF || "—",
    STATUS_PARCELA_CONFIG[l.status].label,
  ];
}

export function exportarLiberacaoPdf(linhas: LinhaLiberacao[]) {
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(14);
  pdf.text("Liberação de Faturamento", 14, 16);
  autoTable(pdf, {
    startY: 22,
    head: [CABECALHO],
    body: linhas.map(linhaParaCelulas),
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  pdf.save("liberacao-faturamento.pdf");
}

export async function exportarLiberacaoExcel(linhas: LinhaLiberacao[]) {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Liberação de Faturamento");
  planilha.columns = [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Parcela", key: "parcela", width: 20 },
    { header: "Valor a faturar", key: "valor", width: 18 },
    { header: "Contato", key: "contato", width: 24 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "E-mail para NF", key: "emailNF", width: 28 },
    { header: "Status", key: "status", width: 16 },
  ];
  planilha.getRow(1).font = { bold: true };
  linhas.forEach((l) => {
    planilha.addRow({
      cliente: l.cliente,
      parcela: l.parcela,
      valor: moeda(l.valor),
      contato: l.contato || "—",
      cnpj: l.cnpj || "—",
      email: l.email || "—",
      emailNF: l.emailNF || "—",
      status: STATUS_PARCELA_CONFIG[l.status].label,
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "liberacao-faturamento.xlsx");
}
