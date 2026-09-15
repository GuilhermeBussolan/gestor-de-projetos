export type Perfil = "administrador" | "coordenador" | "consultor";

export interface Usuario {
  uid: string;
  nomeCompleto: string;
  email: string;
  perfil: Perfil;
  recursoId?: string | null;
  createdAt: number;
}

export type TipoRecurso = "coordenador" | "consultor_funcional" | "consultor_tecnico";

export interface Recurso {
  id: string;
  tipo: TipoRecurso;
  nomeCompleto: string;
  codigo: string;
  valorHora: number;
  createdAt: number;
}

export const MODULOS = ["QRH", "KPH", "MNH", "MNF", "MDH", "SGH"] as const;
export type Modulo = (typeof MODULOS)[number];

export const TIPOS_ATENDIMENTO = ["Implantação", "Treinamento", "Banco de Horas"] as const;
export type TipoAtendimento = (typeof TIPOS_ATENDIMENTO)[number];

export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  codigoProposta: string;
  modulo: Modulo;
  tipoAtendimento: TipoAtendimento;
  createdAt: number;
}

export interface TipoDocumento {
  id: string;
  codigo: string;
  descricao: string;
  pesoIndividual: number;
  ordem: number;
}

export type StatusDocumento = "ANDAMENTO" | "VALIDACAO" | "ASSINADO" | "CANCELADO";

export interface DocumentoProjeto {
  tipoDocumentoId: string;
  codigo: string;
  descricao: string;
  pesoIndividual: number;
  status: StatusDocumento;
}

export type StatusParcela = "FATURADO" | "RECEBIDO";

export interface Parcela {
  numero: number;
  valor: number;
  status: StatusParcela;
}

export interface Financeiro {
  valorTotal: number;
  numeroParcelas: number;
  parcelas: Parcela[];
}

export interface Projeto {
  id: string;
  clienteId: string;
  coordenadorId?: string | null;
  consultorIds: string[];
  documentos: DocumentoProjeto[];
  observacoes: string;
  financeiro: Financeiro;
  createdAt: number;
  updatedAt: number;
}

export type Periodo = "manha" | "tarde";

export interface EventoCalendario {
  id: string;
  data: string; // YYYY-MM-DD
  periodo: Periodo;
  projetoId: string;
  recursoId: string;
  descricao: string;
  createdAt: number;
}

export interface Apontamento {
  id: string;
  recursoId: string;
  projetoId: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  horaDesconto: string; // HH:mm
  totalHoras: number; // decimal hours
  createdAt: number;
}
