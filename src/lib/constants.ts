import type {
  AbaStatusProjeto,
  StatusDocumento,
  StatusParcela,
  Termometro,
  TipoBox,
  TipoFaturamento,
  TipoRecurso,
  TipoRegistro,
} from "@/types";

export const STATUS_DOCUMENTO_CONFIG: Record<
  StatusDocumento,
  { label: string; bg: string; text: string; fator: number }
> = {
  A_INICIAR: { label: "A iniciar", bg: "#eef1f8", text: "#6a7594", fator: 0 },
  ANDAMENTO: { label: "Andamento", bg: "#e8efff", text: "#2456b8", fator: 0 },
  VALIDACAO: { label: "Validação", bg: "#fff2de", text: "#a4650d", fator: 0.5 },
  ASSINADO: { label: "Assinado", bg: "#e3f5ea", text: "#15754c", fator: 1 },
  CANCELADO: { label: "Cancelado", bg: "#fdeceb", text: "#b5392a", fator: 0 },
};

export const STATUS_DOCUMENTO_ORDEM: StatusDocumento[] = [
  "A_INICIAR",
  "ANDAMENTO",
  "VALIDACAO",
  "ASSINADO",
  "CANCELADO",
];

export const STATUS_PARCELA_CONFIG: Record<StatusParcela, { label: string; bg: string; text: string }> = {
  AGUARDANDO: { label: "Aguardando", bg: "#fff2de", text: "#a4650d" },
  LIBERADO: { label: "Liberado", bg: "#eef1f8", text: "#6a7594" },
  FATURADO: { label: "Faturado", bg: "#e8efff", text: "#2456b8" },
  RECEBIDO: { label: "Recebido", bg: "#e3f5ea", text: "#15754c" },
  CANCELADO: { label: "Cancelado", bg: "#fdeceb", text: "#b5392a" },
};

export const STATUS_PARCELA_ORDEM: StatusParcela[] = [
  "AGUARDANDO",
  "LIBERADO",
  "FATURADO",
  "RECEBIDO",
  "CANCELADO",
];

/** As 4 situações que entram na rotina de Liberação de Faturamento (fora "Aguardando"). */
export const STATUS_FATURAMENTO_ORDEM: StatusParcela[] = ["LIBERADO", "FATURADO", "RECEBIDO", "CANCELADO"];

export const TIPO_FATURAMENTO_CONFIG: Record<TipoFaturamento, { label: string; descricao: string }> = {
  apontamento_horas: {
    label: "Apontamento de horas",
    descricao: "Faturamento baseado nas horas apontadas — sem valor ou parcelas fixas.",
  },
  parcelado: {
    label: "Parcelado",
    descricao: "Valor total dividido igualmente pela quantidade de parcelas.",
  },
  marco_faturamento: {
    label: "Marco de faturamento",
    descricao: "Cada parcela tem uma descrição e um valor definidos manualmente.",
  },
};

export const TIPO_FATURAMENTO_ORDEM: TipoFaturamento[] = [
  "apontamento_horas",
  "parcelado",
  "marco_faturamento",
];

export const TIPO_RECURSO_CONFIG: Record<TipoRecurso, { label: string }> = {
  coordenador: { label: "Coordenador" },
  consultor_funcional: { label: "Consultor Funcional" },
  consultor_tecnico: { label: "Consultor Técnico" },
};

export const TIPO_BOX_CONFIG: Record<TipoBox, { label: string }> = {
  proprio: { label: "BOX – Próprio" },
  terceiro: { label: "BOX – Terceiro" },
};

export const TERMOMETRO_CONFIG: Record<Termometro, { label: string; bg: string; text: string }> = {
  normal: { label: "Normal", bg: "#e3f5ea", text: "#15754c" },
  atencao: { label: "Atenção", bg: "#fff2de", text: "#a4650d" },
  critico: { label: "Crítico", bg: "#fdeceb", text: "#b5392a" },
};

export const TERMOMETRO_ORDEM: Termometro[] = ["normal", "atencao", "critico"];

/** cor = borda/ponto do card; texto = texto de apoio (ex.: motivo do cancelamento). */
export const ABA_STATUS_PROJETO_CONFIG: Record<AbaStatusProjeto, { label: string; cor: string; texto: string }> = {
  a_iniciar: { label: "A iniciar", cor: "#2f6fe4", texto: "#2456b8" },
  em_andamento: { label: "Em andamento", cor: "#e08a1e", texto: "#a4650d" },
  concluidos: { label: "Concluídos", cor: "#15754c", texto: "#15754c" },
  cancelados: { label: "Cancelados", cor: "#8b94ad", texto: "#6a7594" },
};

export const ABA_STATUS_PROJETO_ORDEM: AbaStatusProjeto[] = [
  "a_iniciar",
  "em_andamento",
  "concluidos",
  "cancelados",
];

export const TIPO_REGISTRO_CONFIG: Record<TipoRegistro, { label: string; bg: string; text: string }> = {
  atualizacao: { label: "Atualização", bg: "#eef1f8", text: "#6a7594" },
  problema: { label: "Problema", bg: "#fdeceb", text: "#b5392a" },
  decisao: { label: "Decisão", bg: "#e8efff", text: "#2456b8" },
  ciencia: { label: "Ciência", bg: "#e3f5ea", text: "#15754c" },
};

/** Tipos que o usuário escolhe ao registrar (ciência é gerada pelo botão "Dar ciência"). */
export const TIPO_REGISTRO_ORDEM: TipoRegistro[] = ["atualizacao", "problema", "decisao"];

export const DOCUMENTOS_PADRAO: { codigo: string; descricao: string; pesoIndividual: number }[] = [
  { codigo: "MIT024", descricao: "KICK-OFF", pesoIndividual: 5 },
  { codigo: "MIT041", descricao: "DIAGRAMA DE PROCESSOS", pesoIndividual: 15 },
  {
    codigo: "MIT010A",
    descricao: "VALIDAÇÃO DAS CONFIGURAÇÕES, PARAMETRIZAÇÕES E INTEGRAÇÃO",
    pesoIndividual: 10,
  },
  { codigo: "MIT010B", descricao: "VALIDAÇÃO DA CAPACITAÇÕES", pesoIndividual: 30 },
  { codigo: "MIT045", descricao: "SIMULAÇÃO DE PROCESSOS", pesoIndividual: 10 },
  { codigo: "MIT010C", descricao: "GO-LIVE", pesoIndividual: 10 },
  { codigo: "MIT054", descricao: "PLANO DE CUT-OVER", pesoIndividual: 10 },
  { codigo: "MIT005", descricao: "ACOMPANHAMENTO", pesoIndividual: 5 },
  { codigo: "MIT062", descricao: "TERMO DE ENCERRAMENTO", pesoIndividual: 5 },
];

export const CODIGO_TERMO_ENCERRAMENTO = "MIT062";

export const SEED_ADMIN = {
  nomeCompleto: "Administrador",
  email: "admin@empresa.com",
  senha: "admin123",
  perfil: "administrador" as const,
};
