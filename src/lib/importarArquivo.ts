import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface LinhaImportada {
  linha: number;
  valores: Record<string, string>;
}

function normalizarCabecalho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function celulaParaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object" && "text" in (valor as Record<string, unknown>)) {
    return String((valor as { text: unknown }).text ?? "");
  }
  if (typeof valor === "object" && "result" in (valor as Record<string, unknown>)) {
    return String((valor as { result: unknown }).result ?? "");
  }
  if (valor instanceof Date) {
    const dia = String(valor.getDate()).padStart(2, "0");
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    return `${dia}/${mes}/${valor.getFullYear()}`;
  }
  return String(valor).trim();
}

async function lerXlsx(file: File): Promise<LinhaImportada[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const planilha = workbook.worksheets[0];
  if (!planilha) return [];

  let cabecalhos: string[] = [];
  const linhas: LinhaImportada[] = [];

  planilha.eachRow((row, numeroLinha) => {
    const celulas = (row.values as unknown[]).slice(1).map(celulaParaTexto);
    if (numeroLinha === 1) {
      cabecalhos = celulas.map(normalizarCabecalho);
      return;
    }
    if (celulas.every((c) => !c.trim())) return;
    const valores: Record<string, string> = {};
    cabecalhos.forEach((cab, i) => {
      valores[cab] = (celulas[i] ?? "").trim();
    });
    linhas.push({ linha: numeroLinha, valores });
  });

  return linhas;
}

async function lerCsv(file: File): Promise<LinhaImportada[]> {
  const texto = await file.text();
  const resultado = Papa.parse<string[]>(texto, { skipEmptyLines: true });
  const dados = resultado.data;
  if (dados.length === 0) return [];

  const cabecalhos = dados[0].map(normalizarCabecalho);
  const linhas: LinhaImportada[] = [];
  for (let i = 1; i < dados.length; i++) {
    const celulas = dados[i];
    if (celulas.every((c) => !c?.trim())) continue;
    const valores: Record<string, string> = {};
    cabecalhos.forEach((cab, j) => {
      valores[cab] = (celulas[j] ?? "").trim();
    });
    linhas.push({ linha: i + 1, valores });
  }
  return linhas;
}

export async function lerArquivoTabular(file: File): Promise<LinhaImportada[]> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xlsm")) return lerXlsx(file);
  if (nome.endsWith(".csv")) return lerCsv(file);
  throw new Error("Formato não suportado — envie um arquivo .csv ou .xlsx.");
}

/** Busca um valor no objeto de valores por uma lista de nomes de coluna aceitos (já normalizados). */
export function pegarCampo(valores: Record<string, string>, ...nomes: string[]): string {
  for (const nome of nomes) {
    const chave = normalizarCabecalho(nome);
    if (valores[chave] !== undefined) return valores[chave];
  }
  return "";
}
