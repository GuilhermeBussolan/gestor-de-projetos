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
  codigoCI?: string;
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

export type StatusParcela = "AGUARDANDO" | "LIBERADO" | "FATURADO" | "RECEBIDO" | "CANCELADO";

export interface Parcela {
  numero: number;
  descricao?: string;
  tipoDocumentoId?: string;
  valor: number;
  status: StatusParcela;
  /** Timestamp de quando o status virou LIBERADO (usado na tela de Liberação de Faturamento). */
  dataLiberacao?: number | null;
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

export interface ContatoFaturamento {
  nome?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  emailNF?: string;
  memo?: string;
}

export type StatusProjeto = "ativo" | "finalizado";

export interface EscopoAtividade {
  id: string;
  descricao: string;
}

export interface Escopo {
  id: string;
  nome: string;
  atividades: EscopoAtividade[];
  createdAt: number;
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
  horasPrevistasConsultor: number;
  horasPrevistasCoordenador: number;
  dataInicio?: string | null;
  dataFim?: string | null;
  status?: StatusProjeto | null;
  contatoFaturamento?: ContatoFaturamento | null;
  escopoId?: string | null;
  escopoNome?: string | null;
  escopoAtividades?: EscopoAtividade[] | null;
  ultimoContato?: {
    texto: string;
    usuarioNome: string;
    criadoEm: number;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export type OrigemEvento = "avulso" | "recorrencia";

/**
 * previsto: lançado, aguardando o próprio consultor confirmar que foi realizado
 * aguardando_aprovacao: consultor confirmou; aguardando decisão do coordenador
 * aprovado: aprovado — única situação que conta para os cálculos "reais" do projeto
 * rejeitado: coordenador rejeitou (motivoRejeicao preenchido); consultor pode ajustar e reenviar
 * cancelado: ocorrência de agenda fixa que não aconteceu (sem horas)
 */
export type StatusHora = "previsto" | "aguardando_aprovacao" | "aprovado" | "rejeitado" | "cancelado";

export interface EventoCalendario {
  id: string;
  data: string; // YYYY-MM-DD
  projetoId: string;
  recursoId: string;
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  horaDesconto: string; // HH:mm
  totalHoras: number; // decimal hours
  descricao: string;
  origem: OrigemEvento;
  seriesId?: string | null;
  status?: StatusHora | null;
  motivoRejeicao?: string | null;
  aprovadoPorNome?: string | null;
  aprovadoEm?: number | null;
  /** Hora retroativa importada em lote: aprovada direto, some do calendário. */
  retroativo?: boolean;
  /** IDs das EscopoAtividade do projeto marcadas como realizadas nesse apontamento. */
  atividadesRealizadas?: string[] | null;
  createdAt: number;
}
