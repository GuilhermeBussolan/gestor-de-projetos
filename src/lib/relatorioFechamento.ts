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

/** Uma linha por lançamento aprovado, para o financeiro conferir horário a horário. */
export interface LinhaFechamento {
  data: string;
  recursoId: string;
  recursoNome: string;
  /** "Próprio" ou "Terceiro – Parceira". */
  vinculo: string;
  cliente: string;
  projeto: string;
  horaInicio: string;
  horaFim: string;
  /** HH:mm de desconto (ex.: almoço); "00:00" ou vazio quando não há. */
  horaDesconto: string;
  totalHoras: number;
  valorRepasse: number;
  /** Outro lançamento do mesmo recurso, no mesmo dia, cruza este horário. */
  sobreposto: boolean;
}

export interface FiltrosFechamento {
  /** "" = próprios e terceiros. */
  tipo: "" | TipoBox;
  /** "" = todos. Só faz sentido para terceiros (recursos próprios não têm parceira). */
  parceiraId: string;
  /** "" = todos os recursos que passam nos filtros acima. */
  recursoId: string;
}

/** Quem o relatório cobre — vai no cabeçalho do PDF/Excel e da tela. */
export interface EscopoFechamento {
  rotulo: string;
  cnpj?: string | null;
  /** Mostra a coluna "Vínculo" (quando o relatório mistura próprios e terceiros ou várias parceiras). */
  incluirVinculo: boolean;
  /** Mostra a coluna "Desconto" (só quando algum lançamento do período tem desconto). */
  incluirDesconto: boolean;
}

export const temDesconto = (linhas: Pick<LinhaFechamento, "horaDesconto">[]) =>
  linhas.some((l) => !!l.horaDesconto && l.horaDesconto !== "00:00");

type ColunasOpcionais = Pick<EscopoFechamento, "incluirVinculo" | "incluirDesconto">

export const tipoBoxEfetivo = (r: Pick<Recurso, "tipoBox">): TipoBox => r.tipoBox ?? "proprio";

/** Parceiras que têm ao menos um recurso terceiro — as únicas que fazem sentido no filtro. */
export function parceirasComRecursos(parceiras: EmpresaParceira[], recursos: Recurso[]): EmpresaParceira[] {
  const ids = new Set(
    recursos.filter((r) => tipoBoxEfetivo(r) === "terceiro" && r.parceiraId).map((r) => r.parceiraId as string)
  );
  return parceiras.filter((p) => ids.has(p.id));
}

/** Recursos que passam nos filtros de tipo e parceira — alimenta o filtro de recurso e o relatório. */
export function recursosDoFiltro(
  recursos: Recurso[],
  filtros: Pick<FiltrosFechamento, "tipo" | "parceiraId">
): Recurso[] {
  return recursos
    .filter((r) => {
      const tipo = tipoBoxEfetivo(r);
      if (filtros.tipo && tipo !== filtros.tipo) return false;
      if (filtros.parceiraId) return tipo === "terceiro" && r.parceiraId === filtros.parceiraId;
      return true;
    })
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
}

export function descreverEscopo(
  filtros: FiltrosFechamento,
  parceira: EmpresaParceira | null,
  recurso: Recurso | null = null
): EscopoFechamento {
  if (recurso) {
    // Aqui "parceira" é a do próprio recurso (a tela passa a parceira dele, mesmo sem filtro de parceiro).
    const terceiro = tipoBoxEfetivo(recurso) === "terceiro";
    const vinculo = terceiro ? (parceira ? nomeExibicaoParceira(parceira) : "terceiro") : "próprio";
    return {
      rotulo: `${recurso.nomeCompleto} (${vinculo})`,
      cnpj: terceiro ? parceira?.cnpj : undefined,
      incluirVinculo: false,
      incluirDesconto: false,
    };
  }
  if (parceira) {
    return {
      rotulo: nomeExibicaoParceira(parceira),
      cnpj: parceira.cnpj,
      incluirVinculo: false,
      incluirDesconto: false,
    };
  }
  if (filtros.tipo === "proprio") {
    return { rotulo: "Recursos próprios", incluirVinculo: false, incluirDesconto: false };
  }
  if (filtros.tipo === "terceiro") {
    return { rotulo: "Recursos terceiros (todas as parceiras)", incluirVinculo: true, incluirDesconto: false };
  }
  return { rotulo: "Todos os recursos (próprios e terceiros)", incluirVinculo: true, incluirDesconto: false };
}

/** Marca as linhas em que o mesmo recurso tem outro lançamento cruzando o horário, no mesmo dia. */
function marcarSobreposicoes(linhas: LinhaFechamento[]) {
  const porDia = new Map<string, LinhaFechamento[]>();
  for (const l of linhas) {
    const chave = `${l.data}|${l.recursoId}`;
    porDia.set(chave, [...(porDia.get(chave) ?? []), l]);
  }
  for (const grupo of porDia.values()) {
    for (const a of grupo) {
      a.sobreposto = grupo.some((b) => b !== a && a.horaInicio < b.horaFim && b.horaInicio < a.horaFim);
    }
  }
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
    recursosDoFiltro(recursos, filtros)
      .filter((r) => !filtros.recursoId || r.id === filtros.recursoId)
      .map((r) => r.id)
  );
  if (recursosIncluidos.size === 0) return [];

  const elegiveis = eventos.filter(
    (e) => recursosIncluidos.has(e.recursoId) && e.data.startsWith(mesAno) && statusEfetivo(e) === "aprovado"
  );

  // Um lançamento por linha (sem somar por dia): o financeiro confere o horário de cada um.
  const linhas: LinhaFechamento[] = [];
  for (const ev of elegiveis) {
    const recurso = recursos.find((r) => r.id === ev.recursoId);
    if (!recurso) continue;
    const projeto = projetos.find((p) => p.id === ev.projetoId);
    const cliente = clientes.find((c) => c.id === projeto?.clienteId);
    const parceiraDoRecurso = parceiras.find((p) => p.id === recurso.parceiraId);
    linhas.push({
      data: ev.data,
      recursoId: recurso.id,
      recursoNome: recurso.nomeCompleto,
      vinculo:
        tipoBoxEfetivo(recurso) === "terceiro"
          ? `Terceiro – ${nomeExibicaoParceira(parceiraDoRecurso)}`
          : "Próprio",
      cliente: nomeExibicaoCliente(cliente),
      projeto: projeto?.codigoProposta ?? "—",
      horaInicio: ev.horaInicio ?? "",
      horaFim: ev.horaFim ?? "",
      horaDesconto: ev.horaDesconto ?? "",
      totalHoras: ev.totalHoras,
      valorRepasse: Math.round(ev.totalHoras * recurso.valorHora * 100) / 100,
      sobreposto: false,
    });
  }
  linhas.sort((a, b) =>
    a.data !== b.data
      ? a.data < b.data
        ? -1
        : 1
      : a.recursoNome !== b.recursoNome
        ? a.recursoNome.localeCompare(b.recursoNome, "pt-BR")
        : a.horaInicio.localeCompare(b.horaInicio)
  );
  marcarSobreposicoes(linhas);
  return linhas;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
export const nomeArquivoSeguro = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-");

function cabecalhoColunas(o: ColunasOpcionais): string[] {
  return [
    "Data",
    "Nome do recurso",
    ...(o.incluirVinculo ? ["Vínculo"] : []),
    "Cliente",
    "Projeto",
    "Hora início",
    "Hora fim",
    ...(o.incluirDesconto ? ["Desconto"] : []),
    "Total de horas",
    "Valor de repasse",
  ];
}

function celulasLinha(l: LinhaFechamento, o: ColunasOpcionais): string[] {
  return [
    dataBR(l.data),
    l.recursoNome,
    ...(o.incluirVinculo ? [l.vinculo] : []),
    l.cliente,
    l.projeto,
    l.horaInicio || "—",
    l.horaFim || "—",
    ...(o.incluirDesconto ? [l.horaDesconto && l.horaDesconto !== "00:00" ? l.horaDesconto : "—"] : []),
    formatarHoras(l.totalHoras),
    moeda(l.valorRepasse),
  ];
}

/** "Total" fica na última coluna antes de "Total de horas". */
function linhaTotal(totalHoras: number, totalRepasse: number, o: ColunasOpcionais): string[] {
  const antesDasHoras = cabecalhoColunas(o).length - 2;
  return [...Array(antesDasHoras - 1).fill(""), "Total", formatarHoras(totalHoras), moeda(totalRepasse)];
}

export async function carregarImagemDataUrl(url: string): Promise<string | null> {
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

export function formatoImagem(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

/**
 * Redesenha a imagem num canvas na largura de destino (em pixels) antes de embutir no PDF — sem
 * isso, uma logo em alta resolução (a nossa tem 2587×980) vira um PDF de dezenas de MB, porque o
 * jsPDF embute o bitmap bruto, não o PNG comprimido do arquivo original.
 */
export function redimensionarImagem(dataUrl: string, larguraAlvoPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = larguraAlvoPx / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = larguraAlvoPx;
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponível"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Falha ao redimensionar imagem"));
    img.src = dataUrl;
  });
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
  // Paisagem: com início, fim e desconto o relatório passa de 8 colunas.
  const pdf = new jsPDF({ orientation: "landscape" });
  const largura = pdf.internal.pageSize.getWidth();
  let y = 16;

  // A logo mantém a proporção original e o texto começa abaixo dela (antes ficava por cima).
  let baseDaLogo = 0;
  const logoBruto = await carregarImagemDataUrl(logoUrl);
  const logo = logoBruto ? await redimensionarImagem(logoBruto, 360).catch(() => logoBruto) : null;
  if (logo) {
    try {
      const props = pdf.getImageProperties(logo);
      const altura = 14;
      const larguraLogo = Math.min((props.width / props.height) * altura, 50);
      pdf.addImage(logo, formatoImagem(logo), 14, 8, larguraLogo, altura);
      baseDaLogo = 8 + altura;
    } catch {
      // logo inválida — segue sem ela
    }
  }

  pdf.setFontSize(15);
  pdf.text("Relatório de Fechamento Mensal", largura / 2, y, { align: "center" });
  y = Math.max(y + 8, baseDaLogo + 6);

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
  const obs = pdf.splitTextToSize(OBSERVACAO_FECHAMENTO, largura - 28);
  pdf.text(obs, 14, y);
  y += obs.length * 4 + 4;

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);

  autoTable(pdf, {
    startY: y,
    head: [cabecalhoColunas(escopo)],
    body: linhas.map((l) => celulasLinha(l, escopo)),
    foot: [linhaTotal(totalHoras, totalRepasse, escopo)],
    // Horário sobreposto do mesmo recurso no mesmo dia fica destacado para conferência.
    didParseCell: (dados) => {
      if (dados.section === "body" && linhas[dados.row.index]?.sobreposto) {
        dados.cell.styles.fillColor = [255, 242, 222];
      }
    },
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
  const colunas = cabecalhoColunas(escopo);
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
    "Hora início": 12,
    "Hora fim": 10,
    Desconto: 10,
    "Total de horas": 14,
    "Valor de repasse": 18,
  };
  planilha.columns = colunas.map((c) => ({ width: larguras[c] ?? 16 }));

  linhas.forEach((l) => {
    const linha = planilha.addRow(celulasLinha(l, escopo));
    if (l.sobreposto) {
      // Horário sobreposto do mesmo recurso no mesmo dia: destaca para conferência.
      linha.eachCell((celula) => {
        celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2DE" } };
      });
    }
  });

  const totalHoras = linhas.reduce((acc, l) => acc + l.totalHoras, 0);
  const totalRepasse = linhas.reduce((acc, l) => acc + l.valorRepasse, 0);
  const total = planilha.addRow(linhaTotal(totalHoras, totalRepasse, escopo));
  total.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `fechamento-mensal-${nomeArquivoSeguro(escopo.rotulo)}-${mesAno}.xlsx`);
}
