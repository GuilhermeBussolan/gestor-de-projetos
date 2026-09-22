export type Perfil = "administrador" | "coordenador" | "consultor" | "financeiro";

export interface Usuario {
  uid: string;
  nomeCompleto: string;
  email: string;
  perfil: Perfil;
  recursoId?: string | null;
  createdAt: number;
}

export type TipoRecurso = "coordenador" | "consultor_funcional" | "consultor_tecnico";

export type TipoBox = "proprio" | "terceiro";

export interface Recurso {
  id: string;
  tipo: TipoRecurso;
  nomeCompleto: string;
  codigo: string;
  valorHora: number;
  /** BOX próprio (colaborador direto) ou terceiro (alocado via empresa parceira). Ausente = "proprio". */
  tipoBox?: TipoBox;
  /** Obrigatório quando tipoBox é "terceiro" — id da empresa parceira em /parceiras. */
  parceiraId?: string | null;
  createdAt: number;
}

export interface ContatoParceira {
  nome: string;
  email?: string;
  telefone?: string;
}

export interface EmpresaParceira {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  /** Até 2 contatos. */
  contatos: ContatoParceira[];
  createdAt: number;
  updatedAt: number;
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
  /** Nota fiscal (obrigatória ao marcar como FATURADO). */
  notaFiscal?: string | null;
  /** Data em que a parcela foi recebida (YYYY-MM-DD, obrigatória ao marcar como RECEBIDO). */
  dataRecebimento?: string | null;
  /** Data em que a parcela foi cancelada (YYYY-MM-DD, obrigatória ao marcar como CANCELADO). */
  dataCancelamento?: string | null;
  /** Motivo do cancelamento (obrigatório ao marcar como CANCELADO). */
  motivoCancelamento?: string | null;
  /** Quem liberou (auditoria). Ausente em parcelas liberadas antes desse controle existir. */
  liberadoPor?: { uid: string; nome: string } | null;
  /**
   * Data prevista atual (YYYY-MM-DD), recalculada em cascata quando uma parcela anterior é
   * liberada — só existe em projetos "parcelado" com a previsão inicial preenchida.
   */
  dataPrevista?: string | null;
  /** Baseline imutável da data prevista, usada para calcular o intervalo entre parcelas. */
  dataPrevistaOriginal?: string | null;
  /**
   * Previsão de faturamento do marco (só "marco_faturamento"), editável enquanto a parcela
   * está AGUARDANDO. Quando a parcela tem tipoDocumentoId, ela é mostrada ao lado do status
   * do documento MIT correspondente em Projeto.documentos.
   */
  dataPrevisaoFaturamento?: string | null;
  previsaoAtualizadaEm?: number | null;
  previsaoAtualizadaPor?: string | null;
}

export type TipoFaturamento = "apontamento_horas" | "parcelado" | "marco_faturamento";

export interface Financeiro {
  tipoFaturamento: TipoFaturamento;
  valorTotal: number;
  numeroParcelas: number;
  parcelas: Parcela[];
}

/** ciencia: registro automático de que alguém marcado leu e ficou ciente de outro registro. */
export type TipoRegistro = "atualizacao" | "problema" | "decisao" | "ciencia";

export interface Mencionado {
  uid: string;
  nome: string;
}

export interface ContatoProjeto {
  id: string;
  texto: string;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: number;
  /** Ausente em registros antigos = "atualizacao". */
  tipo?: TipoRegistro;
  mencionados?: Mencionado[];
  /** Nas ciências: id do registro do qual se deu ciência. */
  respondeAId?: string | null;
}

/** Aviso para quem foi marcado numa linha do tempo (coleção "notificacoes"). */
export interface Notificacao {
  id: string;
  destinatarioUid: string;
  projetoId: string;
  projetoNome: string;
  contatoId: string;
  autorUid: string;
  autorNome: string;
  tipo: TipoRegistro;
  texto: string;
  criadoEm: number;
  lida: boolean;
}

/** Espelho enxuto de "usuarios" (id = uid) que todos leem — serve à lista de @. */
export interface PessoaDiretorio {
  id: string;
  nomeCompleto: string;
  perfil: Perfil;
  recursoId?: string | null;
}

export interface ContatoFaturamento {
  nome?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  emailNF?: string;
  memo?: string;
}

export type StatusProjeto = "ativo" | "finalizado" | "cancelado";

/** Classificação por andamento, usada nas abas do dashboard. */
export type AbaStatusProjeto = "a_iniciar" | "em_andamento" | "concluidos" | "cancelados";

export interface CancelamentoProjeto {
  motivo: string;
  usuarioNome: string;
  criadoEm: number;
}

export type Termometro = "normal" | "atencao" | "critico";

export interface TermometroObservacao {
  texto: string;
  usuarioNome: string;
  criadoEm: number;
}

export type UnidadeDuracao = "minutos" | "horas";

export interface EscopoAtividade {
  id: string;
  descricao: string;
  /** Profundidade na hierarquia pai/filho (0 = raiz). Ausente = 0. Os filhos de uma atividade são as seguintes com nível maior. */
  nivel?: number;
  /** Duração estimada da tarefa. Ausente em atividades que são só agrupadoras (têm filhos) ou em escopos antigos. */
  duracao?: number;
  /** Ausente = "horas" quando duracao existe. */
  unidadeDuracao?: UnidadeDuracao;
}

/** Auditoria de uma importação de escopo (coleção "escoposImportados"). */
export interface EscopoImportacao {
  id: string;
  escopoId: string;
  nomeEscopo: string;
  arquivoNome: string;
  linhasValidadas: number;
  /** Quantas linhas chegaram sem duração e precisaram ser corrigidas na pré-importação. */
  linhasComErro: number;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: number;
}

export interface Escopo {
  id: string;
  nome: string;
  atividades: EscopoAtividade[];
  createdAt: number;
}

export interface EnvolvidoChave {
  nome: string;
  email?: string;
  telefone?: string;
}

/** Registro de auditoria de uma tarefa excluída ao incluir um escopo no projeto (3.1). */
export interface ExclusaoEscopo {
  atividadeId: string;
  descricao: string;
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
  horasPrevistasConsultor: number;
  horasPrevistasCoordenador: number;
  dataInicio?: string | null;
  dataFim?: string | null;
  status?: StatusProjeto | null;
  contatoFaturamento?: ContatoFaturamento | null;
  escopoId?: string | null;
  escopoNome?: string | null;
  escopoAtividades?: EscopoAtividade[] | null;
  /** Tarefas do escopo excluídas na inclusão ("Personalizar exclusões"), para auditoria. */
  escopoExclusoes?: ExclusaoEscopo[] | null;
  principaisEnvolvidos?: EnvolvidoChave[] | null;
  /** Ausente = "normal". Só admin/coordenador altera. */
  termometro?: Termometro | null;
  termometroObservacao?: TermometroObservacao | null;
  cancelamento?: CancelamentoProjeto | null;
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
