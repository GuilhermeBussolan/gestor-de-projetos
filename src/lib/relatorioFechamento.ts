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
import type { Cliente, EmpresaParceira, EventoCalendario, Projeto, Recurso, TipoBox } from "@/types";

export const NG_INFORMATICA = {
  razaoSocial: "NG INFORMÁTICA LTDA",
  cnpj: "81.773.970/0001-21",
};

export const OBSERVACAO_FECHAMENTO =
  "Notas fiscais recebidas após dia 17 do mês em questão, serão pagas até o quinto dia útil do mês seguinte.";

export interface LinhaFechamento {
  data: string;
  recursoNome: string;
  /** "Próprio" ou "Terceiro – Parceira". */
  vinculo: string;
  cliente: string;
  projeto: string;
  totalHoras: number;
  valorRepasse: number;
}

export interface FiltrosFechamento {
  /** "" = próprios e terceiros. */
  tipo: "" | TipoBox;
  /** "" = todos. Só faz sentido para terceiros (recursos próprios não têm parceira). */
  parceiraId: string;
}

/** Quem o relatório cobre — vai no cabeçalho do PDF/Excel e da tela. */
export interface EscopoFechamento {
  rotulo: string;
  cnpj?: string | null;
  /** Mostra a coluna "Vínculo" (quando o relatório mistura próprios e terceiros ou várias parceiras). */
  incluirVinculo: boolean;
}

export const tipoBoxEfetivo = (r: Pick<Recurso, "tipoBox">): TipoBox => r.tipoBox ?? "proprio";

/** Parceiras que têm ao menos um recurso terceiro — as únicas que fazem sentido no filtro. */
export function parceirasComRecursos(parceiras: EmpresaParceira[], recursos: Recurso[]): EmpresaParceira[] {
  const ids = new Set(
    recursos.filter((r) => tipoBoxEfetivo(r) === "terceiro" && r.parceiraId).map((r) => r.parceiraId as string)
  );
  return parceiras.filter((p) => ids.has(p.id));
}

export function descreverEscopo(filtros: FiltrosFechamento, parceira: EmpresaParceira | null): EscopoFechamento {
  if (parceira) {
    return {
      rotulo: nomeExibicaoParceira(parceira),
      cnpj: parceira.cnpj,
      incluirVinculo: false,
    };
  }
  if (filtros.tipo === "proprio") {
    return { rotulo: "Recursos próprios", incluirVinculo: false };
  }
  if (filtros.tipo === "terceiro") {
    return { rotulo: "Recursos terceiros (todas as parceiras)", incluirVinculo: true };
  }
  return { rotulo: "Todos os recursos (próprios e terceiros)", incluirVinculo: true };
}

/**
 * Monta as linhas do fechamento mensal: só horas aprovadas do mês/ano informado, dos recursos
 * que passam nos filtros (tipo próprio/terceiro e, para terceiros, a parceira).
 */
export function montarFechamentoMensal(
  eventos: EventoCalendario[],
  recursos: Recurso[],
  projetos: Projeto[],
  clientes: Cliente[],
  parceiras: EmpresaParceira[],
  filtros: FiltrosFechamento,
  mesAno: string
): LinhaFechamento[] {
  const recursosIncluidos = new Set(
    recursos
      .filter((r) => {
        const tipo = tipoBoxEfetivo(r);
        if (filtros.tipo && tipo !== filtros.tipo) return false;
        if (filtros.parceiraId) return tipo === "terceiro" && r.parceiraId === filtros.parceiraId;
        return true;
      })
      .map((r) => r.id)
  );
  if (recursosIncluidos.size === 0) return [];

  const elegiveis = eventos.filter(
    (e) => recursosIncluidos.has(e.recursoId) && e.data.startsWith(mesAno) && statusEfetivo(e) === "aprovado"
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
      const parceiraDoRecurso = parceiras.find((p) => p.id === recurso.parceiraId);
      grupos.set(chave, {
        data: ev.data,
        recursoNome: recurso.nomeCompleto,
        vinculo:
          tipoBoxEfetivo(recurso) === "terceiro"
            ? `Terceiro – ${nomeExibicaoParceira(parceiraDoRecurso)}`
            : "Próprio",
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
const nomeArquivoSeguro = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-");

function cabecalhoColunas(incluirVinculo: boolean): string[] {
  return [
    "Data",
    "Nome do recurso",
    ...(incluirVinculo ? ["Vínculo"] : []),
    "Cliente",
    "Projeto",
    "Total de horas",
    "Valor de repasse",
  ];
}

function celulasLinha(l: LinhaFechamento, incluirVinculo: boolean): string[] {
  return [
    dataBR(l.data),
    l.recursoNome,
    ...(incluirVinculo ? [l.vinculo] : []),
    l.cliente,
    l.projeto,
    formatarHoras(l.totalHoras),
    moeda(l.valorRepasse),
  ];
}

function linhaTotal(totalHoras: number, totalRepasse: number, incluirVinculo: boolean): string[] {
  return [
    "",
    "",
    ...(incluirVinculo ? [""] : []),
    "",
    "Total",
    formatarHoras(totalHoras),
    moeda(totalRepasse),
  ];
}

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

function linhaEscopo(escopo: EscopoFechamento): string {
  return `${escopo.rotulo}${escopo.cnpj ? ` — CNPJ: ${escopo.cnpj}` : ""}`;
}

export async function exportarFechamentoPdf(
  linhas: LinhaFechamento[],
  escopo: EscopoFechamento,
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
  pdf.text(`Recursos: ${linhaEscopo(escopo)}`, 14, y);
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
    head: [cabecalhoColunas(escopo.incluirVinculo)],
    body: linhas.map((l) => celulasLinha(l, escopo.incluirVinculo)),
    foot: [linhaTotal(totalHoras, totalRepasse, escopo.incluirVinculo)],
    styles: { fontSize: 8 },
    footStyles: { fontStyle: "bold", fillColor: [238, 241, 248], textColor: [21, 40, 73] },
    margin: { left: 14, right: 14 },
  });

  pdf.save(`fechamento-mensal-${nomeArquivoSeguro(escopo.rotulo)}-${mesAno}.pdf`);
}

export async function exportarFechamentoExcel(
  linhas: LinhaFechamento[],
  escopo: EscopoFechamento,
  mesAno: string,
  logoUrl: string
) {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Fechamento Mensal");

  const [ano, mes] = mesAno.split("-");
  const vencimento = format(calcularVencimentoFechamento(mesAno), "dd/MM/yyyy");
  const colunas = cabecalhoColunas(escopo.incluirVinculo);
  const ultimaColuna = String.fromCharCode("A".charCodeAt(0) + colunas.length - 1);

  planilha.mergeCells(`A1:${ultimaColuna}1`);
  planilha.getCell("A1").value = "Relatório de Fechamento Mensal";
  planilha.getCell("A1").font = { bold: true, size: 14 };

  planilha.getCell("A2").value = `Competência: ${mes}/${ano}`;
  planilha.getCell("A3").value = `Recursos: ${linhaEscopo(escopo)}`;
  planilha.getCell("A4").value = `${NG_INFORMATICA.razaoSocial} — CNPJ: ${NG_INFORMATICA.cnpj}`;
  planilha.getCell("A5").value = `Vencimento: ${vencimento}`;
  planilha.mergeCells(`A6:${ultimaColuna}6`);
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
      planilha.addImage(imageId, { tl: { col: colunas.length - 1, row: 0 }, ext: { width: 90, height: 45 } });
    } catch {
      // logo inválida — segue sem ela
    }
  }

  const linhaCabecalho = 8;
  planilha.getRow(linhaCabecalho).values = colunas;
  planilha.getRow(linhaCabecalho).font = { bold: true };
  const larguras: Record<string, number> = {
    Data: 12,
    "Nome do recurso": 28,
    Vínculo: 26,
    Cliente: 24,
    Projeto: 18,
    "Total de horas": 14,
    "Valor de repasse": 18,
  };
  planilha.columns = colunas.map((c) => ({ width: larguras[c] ?? 16 }));

  linhas.forEach((l) => {
    planilha.addRow(celulasLinha(l, escopo.incluirVinculo));
  });

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);
  const total = planilha.addRow(linhaTotal(totalHoras, totalRepasse, escopo.incluirVinculo));
  total.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `fechamento-mensal-${nomeArquivoSeguro(escopo.rotulo)}-${mesAno}.xlsx`);
}
