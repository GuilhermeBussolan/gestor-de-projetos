import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Clock,
  FolderKanban,
  ListChecks,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Perfil } from "@/types";

/** Identifica a miniatura visual mostrada ao lado da explicação (ver GuiaPrevias). */
export type PreviaId =
  | "cadastros"
  | "box"
  | "perfis"
  | "escopo-editor"
  | "escopo-hierarquia"
  | "status-projeto"
  | "termometro"
  | "cancelar-projeto"
  | "atividades-datas"
  | "filtros-dashboard"
  | "pizza"
  | "botoes-mt"
  | "conflito-horario"
  | "fluxo-horas"
  | "aprovar-rejeitar"
  | "kpis-horas"
  | "importar"
  | "confirmar-lote"
  | "rejeicao"
  | "kpis-financeiro"
  | "parcela-status"
  | "fechamento"
  | "marcacao"
  | "sino"
  | "card-projeto"
  | "documentos-mit"
  | "contatos-cliente";

export interface Funcionalidade {
  titulo: string;
  descricao: string;
  previa: PreviaId;
}

export interface ModuloGuia {
  id: string;
  titulo: string;
  icone: LucideIcon;
  resumo: string;
  href: string;
  hrefLabel: string;
  funcionalidades: Funcionalidade[];
}

export interface GuiaPerfil {
  boasVindas: string;
  modulos: ModuloGuia[];
}

export const FLUXO_GERAL: { quem: string; o_que: string }[] = [
  { quem: "Administrador", o_que: "cadastra clientes, recursos e escopos e abre o projeto" },
  { quem: "Consultor", o_que: "lança as horas no Calendário e confirma o que foi realizado" },
  { quem: "Coordenador", o_que: "aprova as horas — só horas aprovadas contam no projeto" },
  { quem: "Financeiro", o_que: "libera, fatura e acompanha o recebimento das parcelas" },
];

// ---------- módulos reutilizados entre perfis ----------

const MOD_CALENDARIO: ModuloGuia = {
  id: "calendario",
  titulo: "Calendário",
  icone: CalendarDays,
  resumo: "Onde as horas são lançadas, dia a dia.",
  href: "/calendario",
  hrefLabel: "Abrir Calendário",
  funcionalidades: [
    {
      titulo: "Lançar manhã ou tarde com um clique",
      descricao:
        "Passe o mouse sobre um dia: +M cria o lançamento da manhã (08h–12h) e +T o da tarde (13h–17h). Depois é só escolher o projeto e ajustar os horários.",
      previa: "botoes-mt",
    },
    {
      titulo: "Sem horários duplicados",
      descricao:
        "O sistema não deixa dois lançamentos do mesmo recurso no mesmo dia e horário, mesmo em projetos diferentes.",
      previa: "conflito-horario",
    },
    {
      titulo: "Atividades do escopo realizadas",
      descricao:
        "Ao lançar, marque as atividades do escopo que foram feitas. Marcar um item pai marca todos os filhos; você pode desmarcar algum.",
      previa: "escopo-hierarquia",
    },
  ],
};

const MOD_PROJETOS: ModuloGuia = {
  id: "projetos",
  titulo: "Projetos",
  icone: FolderKanban,
  resumo: "Abertura, acompanhamento e encerramento de cada projeto.",
  href: "/projetos",
  hrefLabel: "Abrir Projetos",
  funcionalidades: [
    {
      titulo: "Status pela cor",
      descricao:
        "A iniciar (azul), Em andamento (laranja), Concluído (verde) e Cancelado (cinza). O status vem do progresso dos documentos.",
      previa: "status-projeto",
    },
    {
      titulo: "Termômetro do projeto",
      descricao:
        "Marque como Normal, Atenção ou Crítico. Toda mudança exige uma observação, e ela aparece no Dashboard para todos.",
      previa: "termometro",
    },
    {
      titulo: "Incluir escopo: completo ou personalizado",
      descricao:
        "Ao vincular um escopo, escolha \"Incluir completo\" ou \"Personalizar exclusões\": nesta, desmarque uma tarefa para excluir ela (e os filhos dela) do projeto. As exclusões ficam registradas e podem ser revistas depois.",
      previa: "escopo-hierarquia",
    },
    {
      titulo: "Atividades do escopo e datas",
      descricao:
        "No painel do projeto, cada atividade mostra em quais datas foi feita (só horas aprovadas), e o contador conta apenas as atividades finais.",
      previa: "atividades-datas",
    },
    {
      titulo: "Previsão de faturamento dos marcos",
      descricao:
        "Em projetos por marco de faturamento vinculados a um documento MIT, defina a previsão de faturamento de cada marco ainda não liberado — ela alimenta o Faturamento Previsto.",
      previa: "documentos-mit",
    },
    {
      titulo: "Documentos (MIT) e progresso",
      descricao:
        "Cada documento tem um status (A iniciar, Andamento, Validação, Assinado ou Cancelado), e é dele que vem o progresso do projeto. Você altera o status direto no painel do projeto.",
      previa: "documentos-mit",
    },
    {
      titulo: "Contatos principais do cliente",
      descricao:
        "Os principais envolvidos (nome, e-mail e telefone) ficam no projeto, em Editar projeto, e aparecem no painel para toda a equipe consultar.",
      previa: "contatos-cliente",
    },
    {
      titulo: "Cancelar e reabrir",
      descricao:
        "Cancelar exige informar o motivo. O projeto vai para a aba de cancelados e pode ser reaberto quando precisar.",
      previa: "cancelar-projeto",
    },
  ],
};

const MOD_DASHBOARD: ModuloGuia = {
  id: "dashboard",
  titulo: "Dashboard",
  icone: BarChart3,
  resumo: "A leitura rápida da carteira de projetos.",
  href: "/dashboard",
  hrefLabel: "Abrir Dashboard",
  funcionalidades: [
    {
      titulo: "Filtros que atualizam tudo",
      descricao:
        "Filtre por status do projeto, por consultor/coordenador e por projeto. Os totais e gráficos acompanham o que você escolher.",
      previa: "filtros-dashboard",
    },
    {
      titulo: "Status pela cor da borda",
      descricao:
        "Cada card tem uma borda com a cor do status. O ponto colorido indica o termômetro quando é Atenção ou Crítico.",
      previa: "status-projeto",
    },
    {
      titulo: "Termômetro em pizza",
      descricao:
        "Clique no card do termômetro para ver a distribuição em gráfico. Clicar em uma cor filtra a lista de projetos.",
      previa: "pizza",
    },
  ],
};

const MOD_APONTAMENTO_APROVACAO: ModuloGuia = {
  id: "apontamento",
  titulo: "Apontamento e aprovação",
  icone: Clock,
  resumo: "O caminho das horas até virarem oficiais.",
  href: "/apontamento",
  hrefLabel: "Abrir Apontamento",
  funcionalidades: [
    {
      titulo: "O caminho de cada hora",
      descricao:
        "Previsto → Aguardando aprovação → Aprovado. Só horas aprovadas contam nos cálculos do projeto.",
      previa: "fluxo-horas",
    },
    {
      titulo: "Aprovar ou rejeitar",
      descricao:
        "Na aba Aprovação de horas, aprove com um clique ou rejeite informando o motivo. O consultor vê o motivo e ajusta.",
      previa: "aprovar-rejeitar",
    },
    {
      titulo: "Totais que seguem os filtros",
      descricao:
        "Total de horas, dias com lançamento e projetos atendidos acompanham o projeto, o status e o mês escolhidos.",
      previa: "kpis-horas",
    },
    {
      titulo: "Importar horas retroativas",
      descricao: "Traz de uma vez lançamentos antigos, já como horas aprovadas.",
      previa: "importar",
    },
  ],
};

const MOD_MARCACOES: ModuloGuia = {
  id: "marcacoes",
  titulo: "Marcações e notificações",
  icone: Bell,
  resumo: "Avise alguém do projeto e deixe o registro na linha do tempo.",
  href: "/dashboard",
  hrefLabel: "Abrir Dashboard",
  funcionalidades: [
    {
      titulo: "Marcar alguém com @",
      descricao:
        "Na linha do tempo do projeto (no Dashboard, no card do projeto), escolha Atualização, Problema ou Decisão, digite @ e escolha a pessoa. Dá para marcar quem está no projeto e os administradores.",
      previa: "marcacao",
    },
    {
      titulo: "Sino de notificações",
      descricao:
        "No topo da tela, o sino mostra tudo em que você foi marcado. Clique para abrir a linha do tempo do projeto; a notificação fica como lida, mas o registro continua no histórico.",
      previa: "sino",
    },
    {
      titulo: "Dar ciência",
      descricao:
        "Quem foi marcado clica em Dar ciência. O nome e o horário ficam registrados na linha do tempo, e quem marcou é avisado.",
      previa: "marcacao",
    },
  ],
};

const MOD_FINANCEIRO: ModuloGuia = {
  id: "financeiro",
  titulo: "Financeiro",
  icone: Wallet,
  resumo: "Faturamento, recebimento e repasse às parceiras.",
  href: "/financeiro",
  hrefLabel: "Abrir Financeiro",
  funcionalidades: [
    {
      titulo: "Visão geral",
      descricao: "Total contratado, recebido e a receber, e quanto foi pago aos recursos com base nas horas aprovadas.",
      previa: "kpis-financeiro",
    },
    {
      titulo: "Liberação de faturamento",
      descricao:
        "Acompanhe cada parcela: Liberado, Faturado, Recebido ou Cancelado. Cada mudança pede o dado obrigatório, como nota fiscal, data ou motivo. Ao liberar, você não pode pular a ordem das parcelas, e as datas previstas das parcelas futuras são recalculadas automaticamente, com prévia antes de confirmar.",
      previa: "parcela-status",
    },
    {
      titulo: "Faturamento previsto",
      descricao:
        "Gráfico do ano com o que já foi liberado (verde) e o que ainda está previsto (azul). Clique num mês para ver o detalhe por cliente, com valor vendido, faturado e saldo, exportável em CSV, PDF ou Excel.",
      previa: "kpis-financeiro",
    },
    {
      titulo: "Fechamento mensal",
      descricao:
        "Relatório do mês em PDF ou Excel, com cada lançamento e seu horário de início e fim. Filtre por tipo de recurso (Todos, Próprios ou Terceiros), parceiro e recurso. Lançamentos com horário sobreposto ficam destacados. O vencimento é no dia 28 do mês seguinte, ajustado ao próximo dia útil.",
      previa: "fechamento",
    },
  ],
};

// ---------- guia de cada perfil ----------

const ADMINISTRADOR: GuiaPerfil = {
  boasVindas:
    "Você é administrador: configura o sistema e acompanha tudo. Veja como o trabalho flui entre os perfis e depois explore cada módulo.",
  modulos: [
    {
      id: "cadastros",
      titulo: "Cadastros",
      icone: Building2,
      resumo: "A base do sistema: quem, para quem e com quais regras.",
      href: "/clientes",
      hrefLabel: "Abrir Clientes",
      funcionalidades: [
        {
          titulo: "Clientes, recursos, parceiras e documentos",
          descricao: "Ficam no menu lateral, em Cadastros. Tudo o que os projetos usam nasce aqui.",
          previa: "cadastros",
        },
        {
          titulo: "Recursos próprios ou de terceiros",
          descricao:
            "Cada recurso é BOX Próprio ou Terceiro. Isso separa as horas no Apontamento e alimenta o repasse às parceiras.",
          previa: "box",
        },
        {
          titulo: "Usuários e perfis",
          descricao:
            "No menu com suas iniciais, em Ver usuários, você cria contas e define o perfil de cada pessoa.",
          previa: "perfis",
        },
      ],
    },
    {
      id: "escopos",
      titulo: "Escopos",
      icone: ListChecks,
      resumo: "A lista de atividades que serão entregues.",
      href: "/escopos",
      hrefLabel: "Abrir Escopos",
      funcionalidades: [
        {
          titulo: "Criar e organizar atividades",
          descricao:
            "Adicione, edite, exclua e mude a ordem das linhas. As setas movem a atividade junto com seus filhos.",
          previa: "escopo-editor",
        },
        {
          titulo: "Atividades pai e filho",
          descricao:
            "Use o recuo para tornar uma atividade filha da linha de cima. Só as atividades finais contam no progresso.",
          previa: "escopo-hierarquia",
        },
        {
          titulo: "Importar com duração obrigatória",
          descricao:
            "No arquivo .csv/.xlsx, use \"Atividade\" (ou \"Tarefa Pai\"/\"Tarefa Filha\" para já importar com hierarquia) e uma coluna \"Duração\". Faltando duração em alguma linha, a importação para numa tela para você completar antes de seguir.",
          previa: "escopo-editor",
        },
      ],
    },
    MOD_PROJETOS,
    MOD_DASHBOARD,
    MOD_MARCACOES,
    MOD_APONTAMENTO_APROVACAO,
    MOD_FINANCEIRO,
  ],
};

const COORDENADOR: GuiaPerfil = {
  boasVindas:
    "Você é coordenador: conduz os projetos e valida as horas da equipe. Veja como o trabalho flui entre os perfis e depois explore cada módulo.",
  modulos: [MOD_PROJETOS, MOD_DASHBOARD, MOD_MARCACOES, MOD_CALENDARIO, MOD_APONTAMENTO_APROVACAO],
};

const CONSULTOR: GuiaPerfil = {
  boasVindas:
    "Você é consultor: registra as horas que trabalhou nos projetos. Veja como o trabalho flui entre os perfis e depois explore cada módulo.",
  modulos: [
    MOD_CALENDARIO,
    {
      id: "apontamento",
      titulo: "Apontamento",
      icone: Clock,
      resumo: "Confirme o que foi realizado para o coordenador aprovar.",
      href: "/apontamento",
      hrefLabel: "Abrir Apontamento",
      funcionalidades: [
        {
          titulo: "O caminho de cada hora",
          descricao:
            "Previsto → Aguardando aprovação → Aprovado. Só horas aprovadas contam nos cálculos do projeto.",
          previa: "fluxo-horas",
        },
        {
          titulo: "Confirmar realizados de uma vez",
          descricao:
            "Confirme lançamento por lançamento ou use Confirmar todos os realizados para tudo que já aconteceu até hoje. Ainda não aprovado? Você pode excluir.",
          previa: "confirmar-lote",
        },
        {
          titulo: "Quando o coordenador rejeita",
          descricao: "O motivo aparece no cartão da hora. Ajuste o lançamento no Calendário e confirme de novo.",
          previa: "rejeicao",
        },
        {
          titulo: "Totais do que você lançou",
          descricao: "Total de horas, dias e projetos atendidos, seguindo os filtros de projeto, status e mês.",
          previa: "kpis-horas",
        },
      ],
    },
    MOD_MARCACOES,
    {
      id: "meus-projetos",
      titulo: "Meus projetos",
      icone: FolderKanban,
      resumo: "Tudo sobre os projetos em que você atua, em um só lugar.",
      href: "/dashboard",
      hrefLabel: "Abrir Dashboard",
      funcionalidades: [
        {
          titulo: "Seus projetos no Dashboard",
          descricao:
            "Aparecem só os projetos em que você está alocado. A borda do card mostra o status, o ponto colorido mostra o termômetro (Atenção ou Crítico) e as horas mostram o realizado em relação ao previsto. Clique no card para abrir o painel completo.",
          previa: "card-projeto",
        },
        {
          titulo: "Escopo atual e atividades feitas",
          descricao:
            "No painel do projeto, veja o escopo com a hierarquia de atividades, quantas já foram concluídas e em quais datas cada uma foi feita.",
          previa: "atividades-datas",
        },
        {
          titulo: "Documentos (MIT) do projeto",
          descricao:
            "Consulte quais documentos já foram entregues e em que situação está cada um: Kick-off, Diagrama de processos, Validações e os demais. O coordenador mantém o status atualizado.",
          previa: "documentos-mit",
        },
        {
          titulo: "Contatos principais do cliente",
          descricao:
            "Veja nome, e-mail e telefone dos principais envolvidos do cliente, direto no painel do projeto, sem procurar em outro lugar.",
          previa: "contatos-cliente",
        },
        {
          titulo: "Linha do tempo do projeto",
          descricao:
            "Registre atualizações, problemas e decisões, e marque com @ o coordenador ou o administrador. O último registro aparece no card: clique nele para registrar um novo.",
          previa: "marcacao",
        },
      ],
    },
  ],
};

const FINANCEIRO: GuiaPerfil = {
  boasVindas:
    "Você é do financeiro: cuida do faturamento e do fechamento mensal. Veja como o trabalho flui entre os perfis e depois explore cada módulo.",
  modulos: [MOD_FINANCEIRO],
};

const RESPONSAVEL_PARCEIRA: GuiaPerfil = {
  boasVindas:
    "Você representa sua empresa no fechamento mensal: quando o faturamento do mês é liberado, confirme que recebeu e leu, confira as horas e os valores dos consultores da sua empresa e confirme ou conteste.",
  modulos: [],
};

export const GUIA_POR_PERFIL: Record<Perfil, GuiaPerfil> = {
  administrador: ADMINISTRADOR,
  coordenador: COORDENADOR,
  consultor: CONSULTOR,
  financeiro: FINANCEIRO,
  responsavel_parceira: RESPONSAVEL_PARCEIRA,
};

const CHAVE_PREFIXO = "gp_guia_visto_";

export function guiaJaVisto(uid: string): boolean {
  try {
    return localStorage.getItem(CHAVE_PREFIXO + uid) === "1";
  } catch {
    return true;
  }
}

export function marcarGuiaVisto(uid: string) {
  try {
    localStorage.setItem(CHAVE_PREFIXO + uid, "1");
  } catch {
    // sem armazenamento: o guia só não lembra que já foi visto
  }
}
