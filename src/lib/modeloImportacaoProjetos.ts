import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/** Colunas do arquivo de importação de projetos, na ordem do modelo (as duas últimas são opcionais). */
export const COLUNAS_IMPORTACAO_PROJETOS = [
  { titulo: "Nome do cliente", largura: 26 },
  { titulo: "Código da Proposta", largura: 20 },
  { titulo: "Tipo de Atendimento", largura: 20 },
  { titulo: "Horas Consultor", largura: 16 },
  { titulo: "Horas Coordenador", largura: 18 },
  { titulo: "Data de Início", largura: 15 },
  { titulo: "Tipo de faturamento", largura: 20 },
  { titulo: "Valor do projeto", largura: 16 },
  { titulo: "Parcelas", largura: 10 },
  { titulo: "Contato de faturamento", largura: 24 },
  { titulo: "CNPJ de faturamento", largura: 22 },
  { titulo: "E-mail", largura: 28 },
  { titulo: "Telefone", largura: 18 },
  { titulo: "E-mail para envio da nota fiscal", largura: 32 },
  { titulo: "Observações", largura: 44 },
  { titulo: "Módulo (opcional)", largura: 18 },
  { titulo: "Valor hora (só banco de horas)", largura: 26 },
] as const;

const EXEMPLO = [
  "Nome do cliente já cadastrado",
  "004677",
  "Implantação",
  120,
  34,
  "01/08/2026",
  "Parcelado",
  20000,
  5,
  "Nome do contato",
  "00.000.000/0001-00",
  "contato@cliente.com.br",
  "(47) 99999-9999",
  "nf@cliente.com.br",
  "Faturar até dia 10 de cada mês com vencimento para dia 28",
  "QRH",
  "",
];

/** Gera e baixa o modelo (.xlsx) para importar projetos: cabeçalho, uma linha de exemplo e uma aba com as regras. */
export async function baixarModeloImportacaoProjetos() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Projetos");
  const cab = ws.addRow(COLUNAS_IMPORTACAO_PROJETOS.map((c) => c.titulo));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF152849" } };
  cab.alignment = { vertical: "middle", wrapText: true };
  cab.height = 32;
  COLUNAS_IMPORTACAO_PROJETOS.forEach((c, i) => (ws.getColumn(i + 1).width = c.largura));
  const exemplo = ws.addRow(EXEMPLO);
  exemplo.font = { italic: true, color: { argb: "FF6A7594" } };
  // Código da proposta e datas como texto, para não perder zeros à esquerda nem virar data errada.
  ws.getColumn(2).numFmt = "@";
  ws.getColumn(6).numFmt = "@";
  ws.getCell("B2").value = "004677";
  ws.getCell("F2").value = "01/08/2026";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const regras = wb.addWorksheet("Como preencher");
  regras.columns = [{ width: 32 }, { width: 100 }];
  [
    ["Coluna", "Como preencher"],
    ["Nome do cliente", "Igual ao nome (ou nome fantasia) do cliente já cadastrado no sistema. Obrigatório."],
    ["Código da Proposta", "Único: não pode repetir no arquivo nem em projetos já existentes. Obrigatório (mantenha os zeros à esquerda)."],
    ["Tipo de Atendimento", "Implantação, Treinamento ou Banco de Horas. Obrigatório."],
    ["Horas Consultor / Coordenador", "Horas estimadas (aceita vírgula: 80,5). Vazio = 0."],
    ["Data de Início", "DD/MM/AAAA. Vazio = data de hoje."],
    ["Tipo de faturamento", "Apontamento, Parcelado ou Banco de horas. Vazio = Apontamento. (Marco de faturamento: cadastre pelo sistema.)"],
    ["Valor do projeto", "Parcelado: valor total. Banco de horas: valor de venda do contrato. Apontamento: opcional (informativo)."],
    ["Parcelas", "Só para Parcelado: quantidade de parcelas iguais."],
    ["Valor hora (só banco de horas)", "Obrigatória quando o tipo de faturamento for Banco de horas (R$ por hora)."],
    ["Contato de faturamento ... E-mail para envio da nota fiscal", "Dados de faturamento do cliente (todos opcionais)."],
    ["Observações", "Observações gerais do projeto (opcional)."],
    ["Módulo (opcional)", "QRH, KPH, MNH, MNF, MDH ou SGH. Vazio = QRH. Define se o projeto conta como LIOT (QRH/KPH) ou NG no Financeiro."],
    ["Linha de exemplo", "A linha 2 da aba Projetos é só um exemplo: apague ou substitua antes de importar."],
  ].forEach((l, i) => {
    const row = regras.addRow(l);
    if (i === 0) row.font = { bold: true };
    row.alignment = { vertical: "top", wrapText: true };
  });

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "modelo-importacao-projetos.xlsx");
}
