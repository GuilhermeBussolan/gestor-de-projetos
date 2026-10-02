import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Clock,
  FolderKanban,
  LayoutGrid,
  ListChecks,
  Receipt,
  StickyNote,
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
  | "contatos-cliente"
  | "versao-cronograma"
  | "bloqueio-agenda"
  | "mapa-alocacao"
  | "os-envolvidos"
  | "reabrir-hora"
  | "recurso-inativo"
  | "ordenar-tabela"
  | "workspace-quadro"
  | "tarefa-compartilhada"
  | "etapas-fechamento"
  | "meu-fechamento"
  | "banco-anterior"
  | "lote-parcelas";

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
  { quem: "Administrador", o_que: "cadastra clientes, recursos e escopos e abre o projeto com o cronograma" },
  { quem: "Consultor", o_que: "lança as horas no Calendário e confirma o que foi realizado" },
  { quem: "Coordenador", o_que: "aprova as horas — só horas aprovadas contam no projeto" },
  { quem: "Financeiro", o_que: "libera, fatura, recebe e fecha o mês com os terceiros" },
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
        "O sistema não deixa dois lançamentos do mesmo recurso no mesmo dia e horário, mesmo em projetos diferentes. As horas retroativas importadas também aparecem no calendário (já aprovadas) e contam nessa conferência.",
      previa: "conflito-horario",
    },
    {
      titulo: "Atividades do escopo realizadas",
      descricao:
        "Ao lançar, marque as atividades do cronograma que foram feitas e diga se ficaram finalizadas ou em andamento. Marcar um item pai marca todos os filhos; você pode desmarcar algum.",
      previa: "escopo-hierarquia",
    },
    {
      titulo: "Bloqueios de agenda",
      descricao:
        "Férias, curso ou folga: bloqueie horas, um dia inteiro ou vários dias seguidos. Nenhum apontamento pode cair dentro de um bloqueio. O consultor bloqueia a própria agenda; o administrador, a de qualquer um.",
      previa: "bloqueio-agenda",
    },
    {
      titulo: "Recurso inativado",
      descricao:
        "Quando um recurso é inativado, ele só aceita apontamentos até a data de inativação (inclusive). Depois dela, o sistema avisa e não deixa lançar.",
      previa: "recurso-inativo",
    },
  ],
};

const MOD_MAPA: ModuloGuia = {
  id: "mapa",
  titulo: "Mapa de Alocação",
  icone: LayoutGrid,
  resumo: "Quem está ocupado e quem está livre, manhã e tarde.",
  href: "/calendario/mapa-alocacao",
  hrefLabel: "Abrir Mapa de Alocação",
  funcionalidades: [
    {
      titulo: "Manhã e tarde de cada recurso",
      descricao:
        "O mapa monta a agenda prevista a partir dos cronogramas dos projetos (data, período e recurso da planilha) e mostra o realizado. Cada turno tem 4h; mais de 4h no mesmo turno aparece como sobreposição — para resolver, corrija o cronograma.",
      previa: "mapa-alocacao",
    },
    {
      titulo: "Quem está livre?",
      descricao:
        "Use \"Quem está livre?\" para achar rapidamente um recurso sem alocação num dia ou turno. A agenda prevista também aparece no calendário de cada consultor (só a dele) e na aba Apontamento → Horas previstas.",
      previa: "mapa-alocacao",
    },
  ],
};

const MOD_PROJETOS: ModuloGuia = {
  id: "projetos",
  titulo: "Projetos",
  icone: FolderKanban,
  resumo: "Abertura, cronograma, acompanhamento e encerramento de cada projeto.",
  href: "/projetos",
  hrefLabel: "Abrir Projetos",
  funcionalidades: [
    {
      titulo: "Status e progresso",
      descricao:
        "A iniciar (azul), Em andamento (laranja), Concluído (verde) e Cancelado (cinza). O progresso é a média das atividades do cronograma (finalizada = 100%; em andamento = horas apontadas ÷ previstas). Nos projetos de Banco de Horas, o progresso é o consumo: horas aprovadas ÷ horas previstas.",
      previa: "status-projeto",
    },
    {
      titulo: "Cronograma com versões",
      descricao:
        "Importe o cronograma já na criação do projeto (vira a versão 1). Cada nova importação vira uma versão, com observação obrigatória, e o histórico mostra quem importou e quando. O que já foi realizado é preservado.",
      previa: "versao-cronograma",
    },
    {
      titulo: "Termômetro do projeto",
      descricao:
        "Marque como Normal, Atenção ou Crítico. Toda mudança exige uma observação, e ela aparece no Dashboard para todos.",
      previa: "termometro",
    },
    {
      titulo: "Atividades e datas",
      descricao:
        "No painel do projeto, cada atividade mostra em quais datas foi feita (só horas aprovadas), e o contador conta apenas as atividades finais.",
      previa: "atividades-datas",
    },
    {
      titulo: "Principais envolvidos do cliente",
      descricao:
        "Nome, cargo, vínculo, e-mail e telefone dos principais envolvidos ficam no painel do projeto para toda a equipe. Quem pode editar o projeto (incluindo o consultor alocado) inclui e edita ali mesmo — ou direto na geração da OS.",
      previa: "contatos-cliente",
    },
    {
      titulo: "Documentos (MIT)",
      descricao:
        "Cada documento tem um status (A iniciar, Andamento, Validação, Assinado ou Cancelado), alterado direto no painel. Nos projetos por marco de faturamento, defina a previsão de faturamento de cada marco ainda não liberado.",
      previa: "documentos-mit",
    },
    {
      titulo: "Listas que você ordena",
      descricao:
        "Em todas as tabelas do sistema, clique no título da coluna para ordenar: o 1º clique faz A→Z (ou do menor para o maior), o 2º inverte e o 3º volta ao normal.",
      previa: "ordenar-tabela",
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

const OS_FUNC: Funcionalidade = {
  titulo: "Ordem de Serviço (OS)",
  descricao:
    "Em cada apontamento, \"Gerar OS\" cria o PDF com as atividades realizadas para enviar ao cliente. Marque quem participou entre os principais envolvidos; se faltar alguém, use \"Incluir envolvido\" — a pessoa já fica salva no projeto.",
  previa: "os-envolvidos",
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
        "Previsto → Aguardando aprovação → Aprovado. Só horas aprovadas contam nos cálculos do projeto. O menu mostra quantas horas aguardam aprovação.",
      previa: "fluxo-horas",
    },
    {
      titulo: "Aprovar ou rejeitar",
      descricao:
        "Na aba Aprovação de horas, aprove com um clique ou rejeite informando o motivo. O consultor vê o motivo e ajusta.",
      previa: "aprovar-rejeitar",
    },
    {
      titulo: "Reabrir uma hora aprovada",
      descricao:
        "Só o administrador: em Horas aprovadas, \"Reabrir\" desfaz a aprovação (com motivo opcional). A hora volta para a aprovação, deixa de contar nos cálculos e o consultor pode ajustá-la.",
      previa: "reabrir-hora",
    },
    OS_FUNC,
    {
      titulo: "Totais que seguem os filtros",
      descricao:
        "Total de horas, dias com lançamento e projetos atendidos acompanham o projeto, o status e o mês escolhidos.",
      previa: "kpis-horas",
    },
    {
      titulo: "Importar horas retroativas",
      descricao:
        "Traz de uma vez lançamentos antigos, já aprovados. Elas aparecem no calendário e nas horas aprovadas do consultor. Recurso com nome repetido no cadastro ou inativo na data é recusado.",
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
        "No topo da tela, o sino mostra tudo em que você foi marcado, os lembretes do seu Workspace e os avisos de tarefas compartilhadas. Clique para abrir; a notificação fica como lida.",
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

const FUNCS_WORKSPACE: Funcionalidade[] = [
  {
    titulo: "Suas anotações, só suas",
    descricao:
      "Lembretes, pendências e observações em quadro (A fazer, Em andamento, Concluído), lista ou por projeto. Ninguém mais vê — nem o administrador. Vincular a um projeto é só referência: não altera o projeto.",
    previa: "workspace-quadro",
  },
  {
    titulo: "Rápido de usar",
    descricao:
      "Digite no topo da coluna A fazer e tecle Enter para anotar; clique na bolinha do cartão para concluir; arraste entre as colunas. Prazo, prioridade, tags e filtros ajudam a organizar. Excluído vai para a lixeira por 15 dias.",
    previa: "workspace-quadro",
  },
  {
    titulo: "Lembretes no sino",
    descricao:
      "Com um prazo definido, ligue \"Me lembrar no sino\" e escolha um ou mais avisos (no dia, 1, 2, 3 dias antes, 1 semana ou outro). O menu Meu Workspace mostra a bolinha com o que está pendente.",
    previa: "sino",
  },
];

const MOD_WORKSPACE: ModuloGuia = {
  id: "workspace",
  titulo: "Meu Workspace",
  icone: StickyNote,
  resumo: "Suas anotações e pendências pessoais.",
  href: "/workspace",
  hrefLabel: "Abrir Meu Workspace",
  funcionalidades: FUNCS_WORKSPACE,
};

const MOD_WORKSPACE_COMPARTILHADO: ModuloGuia = {
  ...MOD_WORKSPACE,
  resumo: "Suas anotações e as tarefas que você troca com o administrador e o financeiro.",
  funcionalidades: [
    ...FUNCS_WORKSPACE,
    {
      titulo: "Tarefas compartilhadas",
      descricao:
        "Ao criar uma tarefa, use \"Compartilhar com\" para marcar outros administradores ou o financeiro. Eles veem a tarefa no Workspace deles, atualizam o status e registram o andamento (atividades, pendências, correções, pagamentos) em \"Atualizações da tarefa\". Cada atualização avisa os demais no sino. Só quem criou exclui e escolhe os participantes.",
      previa: "tarefa-compartilhada",
    },
  ],
};

const MOD_MEU_FECHAMENTO: ModuloGuia = {
  id: "meu-fechamento",
  titulo: "Meu fechamento",
  icone: Receipt,
  resumo: "Se você é terceiro (de uma empresa parceira): confira e confirme suas horas do mês.",
  href: "/meu-fechamento",
  hrefLabel: "Abrir Meu fechamento",
  funcionalidades: [
    {
      titulo: "Conferir e confirmar as horas",
      descricao:
        "Quando o Financeiro envia o fechamento do mês para revisão, o item \"Meu fechamento\" aparece no menu. Confira cada lançamento e o valor, e confirme — ou conteste explicando o que está errado. O mês só é fechado depois que todos os consultores da empresa confirmarem.",
      previa: "meu-fechamento",
    },
    {
      titulo: "Nota fiscal da empresa",
      descricao:
        "Depois que o faturamento é liberado, o contato 1 da parceira envia a nota fiscal (número, data, valor e PDF) por aqui e acompanha a validação e o pagamento.",
      previa: "etapas-fechamento",
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
      descricao:
        "Total contratado, recebido e a receber, e quanto foi pago aos recursos com base nas horas aprovadas. Cada projeto tem um card com as parcelas e o seletor de status. As abas do Financeiro ficam fixas no topo enquanto a tela rola.",
      previa: "kpis-financeiro",
    },
    {
      titulo: "Banco de horas",
      descricao:
        "No card do projeto, \"Gerar parcela do mês\" calcula horas aprovadas × valor hora (valor editável). Para meses faturados antes do sistema, \"Lançar faturamento anterior\" inclui mês, horas, valor, situação (Liberado, Faturado ou Recebido), datas e NF.",
      previa: "banco-anterior",
    },
    {
      titulo: "Liberação de faturamento",
      descricao:
        "Acompanhe cada parcela: Liberado, Faturado, Recebido ou Cancelado. Cada mudança pede o dado obrigatório, como nota fiscal, data ou motivo. Ao liberar, você não pode pular a ordem das parcelas, e as datas previstas das parcelas futuras são recalculadas automaticamente, com prévia antes de confirmar.",
      previa: "parcela-status",
    },
    {
      titulo: "Faturamento e recebimento em lote",
      descricao:
        "Na Liberação de Faturamento, para a conferência de fim de mês: \"Faturamento em lote\" lista as parcelas liberadas com um campo para a nota fiscal de cada uma; as que tiverem NF preenchida viram Faturado. \"Recebimento em lote\" lista só as parcelas faturadas — selecione as que foram recebidas, informe uma data para todas e confirme. Nada de entrar uma a uma.",
      previa: "lote-parcelas",
    },
    {
      titulo: "Faturamento Previsto x Realizado",
      descricao:
        "Por cliente e mês, pela data de liberação do faturamento: o que já foi liberado, faturado e recebido e o que ainda está previsto, com valor de venda, realizado e saldo. Clique num mês para ver o detalhe; exporte em PDF ou Excel.",
      previa: "kpis-financeiro",
    },
    {
      titulo: "Fechamentos com as parceiras",
      descricao:
        "Cada parceira segue o próprio fluxo: Rascunho → Em revisão (valores congelados) → Fechado → Faturamento liberado. Na revisão, cada terceiro confirma as horas no login dele; \"Fechar\" só libera quando todos confirmam (ou use \"Confirmar em nome\" para quem não tem acesso). Depois vêm a nota fiscal (validar ou rejeitar) e o registro do pagamento, com extrato por parceira.",
      previa: "etapas-fechamento",
    },
    {
      titulo: "Relatório do fechamento",
      descricao:
        "Relatório do mês na tela, em PDF ou Excel, com cada lançamento e seu horário de início e fim. Filtre por tipo de recurso (Todos, Próprios ou Terceiros), parceiro e recurso. Lançamentos com horário sobreposto ficam destacados, e no fim vem o resumo por recurso com o total geral. O vencimento é no dia 28 do mês seguinte, ajustado ao próximo dia útil.",
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
          descricao: "Ficam no menu lateral, em Cadastros. Tudo o que os projetos usam nasce aqui. As abas dos cadastros ficam fixas no topo ao rolar.",
          previa: "cadastros",
        },
        {
          titulo: "Recursos próprios ou de terceiros",
          descricao:
            "Cada recurso é BOX Próprio ou Terceiro (de uma empresa parceira). Isso separa as horas no Apontamento e alimenta o fechamento e o repasse às parceiras.",
          previa: "box",
        },
        {
          titulo: "Recurso ativo ou inativo",
          descricao:
            "No cadastro do recurso, a Situação pode ser Ativo ou Inativo. Ao inativar, informe a data: apontamentos até essa data (inclusive) continuam permitidos; depois dela, não.",
          previa: "recurso-inativo",
        },
        {
          titulo: "Usuários e perfis",
          descricao:
            "No menu com suas iniciais, em Ver usuários, você cria contas, define o perfil de cada pessoa e vincula o usuário ao recurso dele.",
          previa: "perfis",
        },
      ],
    },
    {
      id: "escopos",
      titulo: "Escopos",
      icone: ListChecks,
      resumo: "A lista padrão de atividades que serão entregues.",
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
    MOD_CALENDARIO,
    MOD_MAPA,
    MOD_APONTAMENTO_APROVACAO,
    MOD_FINANCEIRO,
    MOD_WORKSPACE_COMPARTILHADO,
  ],
};

const COORDENADOR: GuiaPerfil = {
  boasVindas:
    "Você é coordenador: conduz os projetos e valida as horas da equipe. Veja como o trabalho flui entre os perfis e depois explore cada módulo.",
  modulos: [
    MOD_PROJETOS,
    MOD_DASHBOARD,
    MOD_MARCACOES,
    MOD_CALENDARIO,
    MOD_MAPA,
    MOD_APONTAMENTO_APROVACAO,
    MOD_WORKSPACE,
    MOD_MEU_FECHAMENTO,
  ],
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
            "Previsto → Aguardando aprovação → Aprovado. Só horas aprovadas contam nos cálculos do projeto. Hora aprovada não pode mais ser alterada por você.",
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
          titulo: "Sua agenda do cronograma",
          descricao:
            "Em Horas previstas → Agenda do cronograma, veja as tarefas que os cronogramas alocaram para você, turno a turno, e aponte direto de lá.",
          previa: "mapa-alocacao",
        },
        OS_FUNC,
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
          titulo: "Cronograma e atividades feitas",
          descricao:
            "No painel do projeto, veja o cronograma com a hierarquia de atividades, quantas já foram concluídas e em quais datas cada uma foi feita. Você também pode importar uma nova versão do cronograma (com observação).",
          previa: "versao-cronograma",
        },
        {
          titulo: "Principais envolvidos do cliente",
          descricao:
            "Veja e edite nome, cargo, e-mail e telefone dos principais envolvidos do cliente, direto no painel do projeto.",
          previa: "contatos-cliente",
        },
        {
          titulo: "Documentos (MIT) do projeto",
          descricao:
            "Consulte quais documentos já foram entregues e em que situação está cada um: Kick-off, Diagrama de processos, Validações e os demais. O coordenador mantém o status atualizado.",
          previa: "documentos-mit",
        },
        {
          titulo: "Linha do tempo do projeto",
          descricao:
            "Registre atualizações, problemas e decisões, e marque com @ o coordenador ou o administrador. O último registro aparece no card: clique nele para registrar um novo.",
          previa: "marcacao",
        },
      ],
    },
    MOD_WORKSPACE,
    MOD_MEU_FECHAMENTO,
  ],
};

const FINANCEIRO: GuiaPerfil = {
  boasVindas:
    "Você é do financeiro: cuida do faturamento, do fechamento mensal com as parceiras e dos pagamentos. Veja como o trabalho flui entre os perfis e depois explore cada módulo.",
  modulos: [MOD_FINANCEIRO, MOD_WORKSPACE_COMPARTILHADO],
};

const RESPONSAVEL_PARCEIRA: GuiaPerfil = {
  boasVindas:
    "Você representa sua empresa no fechamento mensal: na tela Fechamento, acompanhe a confirmação das horas dos consultores da sua empresa e, depois que o faturamento é liberado, envie a nota fiscal e acompanhe a validação e o pagamento.",
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
