import type { StatusDocumento, StatusParcela, TipoRecurso } from "@/types";

export const STATUS_DOCUMENTO_CONFIG: Record<
  StatusDocumento,
  { label: string; color: string; fator: number }
> = {
  A_INICIAR: { label: "A iniciar", color: "#BFBFBF", fator: 0 },
  ANDAMENTO: { label: "Andamento", color: "#0F9ED5", fator: 0 },
  VALIDACAO: { label: "Validação", color: "#CCFF66", fator: 0.5 },
  ASSINADO: { label: "Assinado", color: "#92D050", fator: 1 },
  CANCELADO: { label: "Cancelado", color: "#EE0000", fator: 0 },
};

export const STATUS_DOCUMENTO_ORDEM: StatusDocumento[] = [
  "A_INICIAR",
  "ANDAMENTO",
  "VALIDACAO",
  "ASSINADO",
  "CANCELADO",
];

export const STATUS_PARCELA_CONFIG: Record<StatusParcela, { label: string; color: string }> = {
  LIBERADO: { label: "Liberado", color: "#BFBFBF" },
  FATURADO: { label: "Faturado", color: "#0F9ED5" },
  RECEBIDO: { label: "Recebido", color: "#92D050" },
};

export const STATUS_PARCELA_ORDEM: StatusParcela[] = ["LIBERADO", "FATURADO", "RECEBIDO"];

export const TIPO_RECURSO_CONFIG: Record<TipoRecurso, { label: string }> = {
  coordenador: { label: "Coordenador" },
  consultor_funcional: { label: "Consultor Funcional" },
  consultor_tecnico: { label: "Consultor Técnico" },
};

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

export const SEED_ADMIN = {
  nomeCompleto: "Administrador",
  email: "admin@empresa.com",
  senha: "admin123",
  perfil: "administrador" as const,
};
