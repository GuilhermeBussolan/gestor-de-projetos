import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { calcularVencimentoFechamento } from "@/lib/feriados";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { nomeExibicaoParceira } from "@/lib/parceira";
import { statusEfetivo } from "@/lib/statusHora";
import type { Cliente, EmpresaParceira, EventoCalendario, Projeto, Recurso } from "@/types";

export const NG_INFORMATICA = {
  razaoSocial: "NG INFORMÁTICA LTDA",
  cnpj: "81.773.970/0001-21",
};

export const OBSERVACAO_FECHAMENTO =
  "Notas fiscais recebidas após dia 17 do mês em questão, serão pagas até o quinto dia útil do mês seguinte.";

export interface LinhaFechamento {
  data: string;
  recursoNome: string;
  cliente: string;
  projeto: string;
  totalHoras: number;
  valorRepasse: number;
}

/** Monta as linhas do fechamento mensal de uma parceira: só horas aprovadas dos recursos BOX Terceiro dela, no mês/ano informado. */
export function montarFechamentoMensal(
  eventos: EventoCalendario[],
  recursos: Recurso[],
  projetos: Projeto[],
  clientes: Cliente[],
  parceiraId: string,
  mesAno: string
): LinhaFechamento[] {
  const recursosDaParceira = new Set(
    recursos.filter((r) => r.tipoBox === "terceiro" && r.parceiraId === parceiraId).map((r) => r.id)
  );
  if (recursosDaParceira.size === 0) return [];

  const elegiveis = eventos.filter(
    (e) => recursosDaParceira.has(e.recursoId) && e.data.startsWith(mesAno) && statusEfetivo(e) === "aprovado"
  );

  const grupos = new Map<string, LinhaFechamento>();
  for (const ev of elegiveis) {
    const recurso = recursos.find((r) => r.id === ev.recursoId);
    if (!recurso) continue;
    const projeto = projetos.find((p) => p.id === ev.projetoId);
    const cliente = clientes.find((c) => c.id === projeto?.clienteId);
    const chave = `${ev.data}|${ev.recursoId}|${ev.projetoId}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.totalHoras += ev.totalHoras;
      existente.valorRepasse = Math.round(existente.totalHoras * recurso.valorHora * 100) / 100;
    } else {
      grupos.set(chave, {
        data: ev.data,
        recursoNome: recurso.nomeCompleto,
        cliente: nomeExibicaoCliente(cliente),
        projeto: projeto?.codigoProposta ?? "—",
        totalHoras: ev.totalHoras,
        valorRepasse: Math.round(ev.totalHoras * recurso.valorHora * 100) / 100,
      });
    }
  }
  return [...grupos.values()].sort((a, b) =>
    a.data === b.data ? a.recursoNome.localeCompare(b.recursoNome) : a.data < b.data ? -1 : 1
  );
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

async function carregarImagemDataUrl(url: string): Promise<string | null> {
  if (!url.trim()) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Falha ao ler imagem"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatoImagem(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

export async function exportarFechamentoPdf(
  linhas: LinhaFechamento[],
  parceira: EmpresaParceira,
  mesAno: string,
  logoUrl: string
) {
  const pdf = new jsPDF();
  let y = 16;

  const logo = await carregarImagemDataUrl(logoUrl);
  if (logo) {
    try {
      pdf.addImage(logo, formatoImagem(logo), 14, y - 8, 28, 14);
    } catch {
      // logo inválida — segue sem ela
    }
  }

  pdf.setFontSize(15);
  pdf.text("Relatório de Fechamento Mensal", 105, y, { align: "center" });
  y += 8;

  pdf.setFontSize(10);
  const [ano, mes] = mesAno.split("-");
  pdf.text(`Competência: ${mes}/${ano}`, 14, y);
  y += 5;
  pdf.text(`Parceiro: ${nomeExibicaoParceira(parceira)} — CNPJ: ${parceira.cnpj}`, 14, y);
  y += 5;
  pdf.text(`${NG_INFORMATICA.razaoSocial} — CNPJ: ${NG_INFORMATICA.cnpj}`, 14, y);
  y += 5;
  pdf.text(`Vencimento: ${format(calcularVencimentoFechamento(mesAno), "dd/MM/yyyy")}`, 14, y);
  y += 6;

  pdf.setFontSize(8);
  const obs = pdf.splitTextToSize(OBSERVACAO_FECHAMENTO, 180);
  pdf.text(obs, 14, y);
  y += obs.length * 4 + 4;

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);

  autoTable(pdf, {
    startY: y,
    head: [["Data", "Nome do recurso", "Cliente", "Projeto", "Total de horas", "Valor de repasse"]],
    body: linhas.map((l) => [
      dataBR(l.data),
      l.recursoNome,
      l.cliente,
      l.projeto,
      formatarHoras(l.totalHoras),
      moeda(l.valorRepasse),
    ]),
    foot: [["", "", "", "Total", formatarHoras(totalHoras), moeda(totalRepasse)]],
    styles: { fontSize: 8 },
    footStyles: { fontStyle: "bold", fillColor: [238, 241, 248], textColor: [21, 40, 73] },
    margin: { left: 14, right: 14 },
  });

  pdf.save(`fechamento-mensal-${nomeExibicaoParceira(parceira)}-${mesAno}.pdf`);
}

export async function exportarFechamentoExcel(
  linhas: LinhaFechamento[],
  parceira: EmpresaParceira,
  mesAno: string,
  logoUrl: string
) {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Fechamento Mensal");

  const [ano, mes] = mesAno.split("-");
  const vencimento = format(calcularVencimentoFechamento(mesAno), "dd/MM/yyyy");

  planilha.mergeCells("A1:F1");
  planilha.getCell("A1").value = "Relatório de Fechamento Mensal";
  planilha.getCell("A1").font = { bold: true, size: 14 };

  planilha.getCell("A2").value = `Competência: ${mes}/${ano}`;
  planilha.getCell("A3").value = `Parceiro: ${nomeExibicaoParceira(parceira)} — CNPJ: ${parceira.cnpj}`;
  planilha.getCell("A4").value = `${NG_INFORMATICA.razaoSocial} — CNPJ: ${NG_INFORMATICA.cnpj}`;
  planilha.getCell("A5").value = `Vencimento: ${vencimento}`;
  planilha.mergeCells("A6:F6");
  planilha.getCell("A6").value = OBSERVACAO_FECHAMENTO;
  planilha.getCell("A6").font = { italic: true, size: 9 };
  planilha.getCell("A6").alignment = { wrapText: true };

  const logo = await carregarImagemDataUrl(logoUrl);
  if (logo) {
    try {
      const imageId = workbook.addImage({
        base64: logo,
        extension: formatoImagem(logo) === "JPEG" ? "jpeg" : "png",
      });
      planilha.addImage(imageId, { tl: { col: 5, row: 0 }, ext: { width: 90, height: 45 } });
    } catch {
      // logo inválida — segue sem ela
    }
  }

  const linhaCabecalho = 8;
  planilha.getRow(linhaCabecalho).values = [
    "Data",
    "Nome do recurso",
    "Cliente",
    "Projeto",
    "Total de horas",
    "Valor de repasse",
  ];
  planilha.getRow(linhaCabecalho).font = { bold: true };
  planilha.columns = [
    { key: "data", width: 12 },
    { key: "recurso", width: 28 },
    { key: "cliente", width: 24 },
    { key: "projeto", width: 18 },
    { key: "horas", width: 14 },
    { key: "valor", width: 18 },
  ];

  linhas.forEach((l) => {
    planilha.addRow([dataBR(l.data), l.recursoNome, l.cliente, l.projeto, formatarHoras(l.totalHoras), moeda(l.valorRepasse)]);
  });

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);
  const linhaTotal = planilha.addRow(["", "", "", "Total", formatarHoras(totalHoras), moeda(totalRepasse)]);
  linhaTotal.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `fechamento-mensal-${nomeExibicaoParceira(parceira)}-${mesAno}.xlsx`);
}
