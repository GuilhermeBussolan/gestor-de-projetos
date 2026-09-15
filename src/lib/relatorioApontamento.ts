import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType } from "docx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface JsPdfComAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}
import { saveAs } from "file-saver";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { EventoCalendario, Projeto, Recurso, Cliente } from "@/types";

export interface LinhaRelatorio {
  data: string;
  projeto: string;
  horaInicio: string;
  horaFim: string;
  horaDesconto: string;
  totalHoras: number;
}

export interface RelatorioRecurso {
  recurso: Recurso;
  linhas: LinhaRelatorio[];
  totalHoras: number;
  valorTotal: number;
}

export function montarRelatorio(
  eventos: EventoCalendario[],
  recursos: Recurso[],
  projetos: Projeto[],
  clientes: Cliente[],
  recursoIdFiltro?: string
): RelatorioRecurso[] {
  const recursosAlvo = recursoIdFiltro ? recursos.filter((r) => r.id === recursoIdFiltro) : recursos;

  return recursosAlvo
    .map((recurso) => {
      const doRecurso = eventos.filter((a) => a.recursoId === recurso.id);
      const linhas: LinhaRelatorio[] = doRecurso.map((a) => {
        const projeto = projetos.find((p) => p.id === a.projetoId);
        const cliente = clientes.find((c) => c.id === projeto?.clienteId);
        return {
          data: a.data,
          projeto: nomeExibicaoCliente(cliente),
          horaInicio: a.horaInicio,
          horaFim: a.horaFim,
          horaDesconto: a.horaDesconto,
          totalHoras: a.totalHoras,
        };
      });
      const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
      return {
        recurso,
        linhas,
        totalHoras,
        valorTotal: Math.round(totalHoras * recurso.valorHora * 100) / 100,
      };
    })
    .filter((r) => r.linhas.length > 0);
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function exportarRelatorioWord(relatorio: RelatorioRecurso[]) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: "Relatório Analítico de Apontamento", heading: HeadingLevel.HEADING_1 }),
  ];

  for (const r of relatorio) {
    children.push(
      new Paragraph({
        text: `${r.recurso.nomeCompleto} (${r.recurso.codigo})`,
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun(
            `Total de horas: ${formatarHoras(r.totalHoras)}   ·   Valor/hora: ${moeda(
              r.recurso.valorHora
            )}   ·   Valor a repassar: ${moeda(r.valorTotal)}`
          ),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ["Data", "Projeto", "Início", "Fim", "Desconto", "Total"].map(
              (t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] })
            ),
          }),
          ...r.linhas.map(
            (l) =>
              new TableRow({
                children: [
                  l.data,
                  l.projeto,
                  l.horaInicio,
                  l.horaFim,
                  l.horaDesconto,
                  formatarHoras(l.totalHoras),
                ].map((t) => new TableCell({ children: [new Paragraph(t)] })),
              })
          ),
        ],
      }),
      new Paragraph({ text: "" })
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, "relatorio-apontamento.docx");
}

export function exportarRelatorioPdf(relatorio: RelatorioRecurso[]) {
  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text("Relatório Analítico de Apontamento", 14, 16);
  let y = 24;

  for (const r of relatorio) {
    if (y > 260) {
      pdf.addPage();
      y = 16;
    }
    pdf.setFontSize(11);
    pdf.text(`${r.recurso.nomeCompleto} (${r.recurso.codigo})`, 14, y);
    y += 5;
    pdf.setFontSize(9);
    pdf.text(
      `Total: ${formatarHoras(r.totalHoras)}  ·  Valor/hora: ${moeda(r.recurso.valorHora)}  ·  A repassar: ${moeda(
        r.valorTotal
      )}`,
      14,
      y
    );
    y += 4;

    autoTable(pdf, {
      startY: y,
      head: [["Data", "Projeto", "Início", "Fim", "Desconto", "Total"]],
      body: r.linhas.map((l) => [
        l.data,
        l.projeto,
        l.horaInicio,
        l.horaFim,
        l.horaDesconto,
        formatarHoras(l.totalHoras),
      ]),
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (pdf as JsPdfComAutoTable).lastAutoTable.finalY + 10;
  }

  pdf.save("relatorio-apontamento.pdf");
}
