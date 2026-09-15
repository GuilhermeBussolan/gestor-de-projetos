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
  nome: string;
  nomeFantasia?: string;
  cnpj?: string;
  createdAt: number;
}

export interface TipoDocumento {
  id: string;
  codigo: string;
  descricao: string;
  pesoIndividual: number;
  ordem: number;
}

export type StatusDocumento = "A_INICIAR" | "ANDAMENTO" | "VALIDACAO" | "ASSINADO" | "CANCELADO";

export interface DocumentoProjeto {
  tipoDocumentoId: string;
  codigo: string;
  descricao: string;
  pesoIndividual: number;
  status: StatusDocumento;
}

export type StatusParcela = "LIBERADO" | "FATURADO" | "RECEBIDO";

export interface Parcela {
  numero: number;
  descricao?: string;
  valor: number;
  status: StatusParcela;
}

export type TipoFaturamento = "apontamento_horas" | "parcelado" | "marco_faturamento";

export interface Financeiro {
  tipoFaturamento: TipoFaturamento;
  valorTotal: number;
  numeroParcelas: number;
  parcelas: Parcela[];
}

export interface ContatoProjeto {
  id: string;
  texto: string;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: number;
}

export interface Projeto {
  id: string;
  clienteId: string;
  codigoProposta: string;
  modulo: Modulo;
  tipoAtendimento: TipoAtendimento;
  coordenadorId?: string | null;
  consultorIds: string[];
  documentos: DocumentoProjeto[];
  observacoes: string;
  financeiro: Financeiro;
  ultimoContato?: {
    texto: string;
    usuarioNome: string;
    criadoEm: number;
  } | null;
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
