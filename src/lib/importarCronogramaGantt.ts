import ExcelJS from "exceljs";
import { criarAtividadeId } from "@/lib/escopo";
import { parseDataCronograma, parsePeriodoCronograma, type AtividadeCronogramaBruta, type ResultadoImportacaoCronograma } from "@/lib/importarCronograma";
import type { ErroDuracao } from "@/lib/importarEscopo";

/**
 * Leitor para o cronograma-padrão (export tipo Gantt, ex: modelo MIT da metodologia de
 * implantação): uma única coluna "Nome da Tarefa" onde a hierarquia (fase > grupo > subgrupo >
 * tarefa) é implícita, e a duração de cada grupo é uma fórmula de soma sobre as células dos
 * filhos — diferente do cronograma tabular simples (Atividade/Duração/Recurso em colunas
 * separadas), que continua sendo lido por `converterLinhasEmCronograma`.
 */

const EPOCA_EXCEL_MS = Date.UTC(1899, 11, 30);

function normalizarTexto(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Extrai os números de linha referenciados numa fórmula de soma, ex: "SUM(C7:C9,C11)" -> [7,8,9,11]. */
function extrairLinhasDaFormula(formula: string): number[] {
  const linhas = new Set<number>();
  const semRanges = formula.replace(/[A-Z]+(\d+):[A-Z]+(\d+)/g, (_, ini: string, fim: string) => {
    for (let r = Number(ini); r <= Number(fim); r++) linhas.add(r);
    return "";
  });
  const singleRe = /[A-Z]+(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = singleRe.exec(semRanges))) linhas.add(Number(m[1]));
  return [...linhas].sort((a, b) => a - b);
}

interface ColunasGantt {
  nome: number;
  tempo: number;
  inicio?: number;
  fim?: number;
  recurso?: number;
  periodo?: number;
}

function localizarColunas(ws: ExcelJS.Worksheet): { linhaCabecalho: number; colunas: ColunasGantt } | null {
  for (let r = 1; r <= 10; r++) {
    const row = ws.getRow(r);
    const total = Math.max(row.cellCount, ws.columnCount);
    const encontrados: Record<string, number> = {};
    for (let c = 1; c <= total; c++) {
      const v = row.getCell(c).value;
      if (typeof v !== "string" || !v.trim()) continue;
      const chave = normalizarTexto(v);
      if (["nome da tarefa", "tarefa", "atividade"].includes(chave)) encontrados.nome = c;
      else if (["time", "tempo", "tempo previsto", "duracao", "duração"].includes(chave)) encontrados.tempo = c;
      else if (["inicio", "início", "data de inicio", "data de início"].includes(chave)) encontrados.inicio = c;
      else if (["fim", "data fim", "data de fim"].includes(chave)) encontrados.fim = c;
      else if (["recurso", "recurso responsavel", "recurso responsável", "consultor"].includes(chave)) encontrados.recurso = c;
      else if (["periodo", "período", "turno"].includes(chave)) encontrados.periodo = c;
    }
    if (encontrados.nome && encontrados.tempo) {
      return { linhaCabecalho: r, colunas: encontrados as unknown as ColunasGantt };
    }
  }
  return null;
}

interface NoBruto {
  linha: number;
  texto: string;
  isGroup: boolean;
  minutos?: number;
  dataInicio: string | null;
  periodo: ReturnType<typeof parsePeriodoCronograma>;
  recursoNome?: string;
  filhos: number[];
}

function dataDaCelula(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "string") return parseDataCronograma(valor);
  return null;
}

/** true se o arquivo parece ser o cronograma-padrão (tem a coluna "Nome da Tarefa"); false caso contrário. */
export async function ehCronogramaGantt(file: File): Promise<boolean> {
  if (!/\.xlsx$|\.xlsm$/i.test(file.name)) return false;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  const achado = ws ? localizarColunas(ws) : null;
  if (!ws || !achado) return false;
  // Uma planilha tabular comum também tem "Atividade" e "Duração": só é o modelo Gantt se a
  // hierarquia vier de fórmulas de soma na coluna de tempo (e não de uma coluna "Nível").
  const ultima = ws.lastRow ? ws.lastRow.number : ws.rowCount;
  for (let r = achado.linhaCabecalho + 1; r <= ultima; r++) {
    if (ws.getRow(r).getCell(achado.colunas.tempo).type === ExcelJS.ValueType.Formula) return true;
  }
  return false;
}

export async function lerCronogramaGantt(file: File): Promise<ResultadoImportacaoCronograma> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return { atividades: [], erros: [], linhasValidadas: 0 };

  const achado = localizarColunas(ws);
  if (!achado) {
    throw new Error('Não encontrei a coluna "Nome da Tarefa" no arquivo.');
  }
  const { linhaCabecalho, colunas } = achado;

  const nos = new Map<number, NoBruto>();
  const erros: ErroDuracao[] = [];
  let linhasValidadas = 0;

  const ultimaLinha = ws.lastRow ? ws.lastRow.number : ws.rowCount;
  for (let r = linhaCabecalho + 1; r <= ultimaLinha; r++) {
    const row = ws.getRow(r);
    const nomeValor = row.getCell(colunas.nome).value;
    const texto = typeof nomeValor === "string" ? nomeValor.trim() : "";
    if (!texto) continue;

    const tempoCell = row.getCell(colunas.tempo);
    const isGroup = tempoCell.type === ExcelJS.ValueType.Formula;
    let filhos: number[] = [];
    let minutos: number | undefined;
    if (isGroup) {
      const formulaTexto = (tempoCell.value as { formula?: string } | null)?.formula ?? "";
      filhos = extrairLinhasDaFormula(formulaTexto);
    } else if (tempoCell.value instanceof Date) {
      minutos = Math.round((tempoCell.value.getTime() - EPOCA_EXCEL_MS) / 60000);
    } else if (typeof tempoCell.value === "number") {
      minutos = Math.round(tempoCell.value * 24 * 60);
    }

    const dataInicio = colunas.inicio ? dataDaCelula(row.getCell(colunas.inicio).value) : null;
    const periodoValor = colunas.periodo ? row.getCell(colunas.periodo).value : null;
    const periodo = typeof periodoValor === "string" ? parsePeriodoCronograma(periodoValor) : null;
    const recursoValor = colunas.recurso ? row.getCell(colunas.recurso).value : null;
    const recursoNome = typeof recursoValor === "string" && recursoValor.trim() ? recursoValor.trim() : undefined;

    nos.set(r, { linha: r, texto, isGroup, minutos, dataInicio, periodo, recursoNome, filhos });
    if (!isGroup) {
      linhasValidadas++;
      if (minutos === undefined) erros.push({ linha: r, descricao: texto });
    }
  }

  const paiDe = new Map<number, number>();
  for (const no of nos.values()) {
    if (no.isGroup) for (const f of no.filhos) if (nos.has(f)) paiDe.set(f, no.linha);
  }
  let raizes = [...nos.keys()].filter((l) => !paiDe.has(l));

  if (raizes.length === 1) {
    const unica = nos.get(raizes[0])!;
    if (unica.isGroup && unica.filhos.length > 0 && /^projeto\b/i.test(unica.texto)) {
      raizes = unica.filhos.filter((f) => nos.has(f));
      nos.delete(unica.linha);
    }
  }

  const atividades: AtividadeCronogramaBruta[] = [];
  function visitar(linha: number, nivel: number) {
    const no = nos.get(linha);
    if (!no) return;
    if (no.isGroup) {
      atividades.push({ id: criarAtividadeId(), descricao: no.texto, nivel });
      for (const f of no.filhos) visitar(f, nivel + 1);
    } else {
      atividades.push({
        id: criarAtividadeId(),
        descricao: no.texto,
        nivel,
        // Hora cheia ou meia hora fica em horas; o resto (5 min, 10 min...) vai em minutos exatos, sem
        // arredondar — 5 min como 0,08h fazia a soma de um bloco perder minutos.
        duracao: no.minutos !== undefined && no.minutos % 30 === 0 ? no.minutos / 60 : no.minutos,
        unidadeDuracao: no.minutos !== undefined && no.minutos % 30 === 0 ? "horas" : "minutos",
        dataInicio: no.dataInicio,
        periodo: no.periodo,
        recursoNome: no.recursoNome,
      });
    }
  }
  for (const raiz of raizes) visitar(raiz, 0);

  return { atividades, erros, linhasValidadas };
}
