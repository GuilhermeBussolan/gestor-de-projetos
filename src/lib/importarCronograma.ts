import { pegarCampo, type LinhaImportada } from "@/lib/importarArquivo";
import { criarAtividadeId } from "@/lib/escopo";
import { normalizarUnidade, parseDuracao, type ErroDuracao } from "@/lib/importarEscopo";
import type { EscopoAtividade, PeriodoDia } from "@/types";

/** Atividade recém-lida do arquivo — o nome do recurso ainda é texto livre, não um id do sistema. */
export interface AtividadeCronogramaBruta extends Omit<EscopoAtividade, "recursoId"> {
  recursoNome?: string;
}

export interface ResultadoImportacaoCronograma {
  atividades: AtividadeCronogramaBruta[];
  erros: ErroDuracao[];
  linhasValidadas: number;
}

/** Aceita "21/09/2026" (Excel/BR) ou "2026-09-21" (ISO); retorna null se não reconhecer. */
export function parseDataCronograma(texto: string): string | null {
  const t = texto.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

export function parsePeriodoCronograma(texto: string): PeriodoDia | null {
  const t = texto.trim().toLowerCase();
  if (!t) return null;
  if (t.startsWith("m")) return "manha";
  if (t.startsWith("t")) return "tarde";
  return null;
}

/**
 * Igual a `converterLinhasEmAtividades` (escopo), mas cada tarefa-folha também recebe data de
 * início, período e o nome (ainda em texto) do recurso responsável — os três campos do
 * cronograma que o escopo comum não tem. O recurso é resolvido para um id real só depois, na
 * etapa de associação (a mesma pessoa pode aparecer com nomes ligeiramente diferentes no arquivo).
 */
export function converterLinhasEmCronograma(linhas: LinhaImportada[]): ResultadoImportacaoCronograma {
  const usaHierarquia = linhas.some(
    (l) => pegarCampo(l.valores, "Tarefa Pai", "Pai") || pegarCampo(l.valores, "Tarefa Filha", "Filha")
  );

  const atividades: AtividadeCronogramaBruta[] = [];
  const erros: ErroDuracao[] = [];
  const idsDoPai = new Map<string, string>();
  let linhasValidadas = 0;

  function lerCamposFolha(l: LinhaImportada) {
    const duracao = parseDuracao(pegarCampo(l.valores, "Duração", "Duracao", "Tempo Previsto", "Horas"));
    const unidadeDuracao = normalizarUnidade(pegarCampo(l.valores, "Unidade", "Unidade Duração", "Unidade Duracao"));
    const dataInicio = parseDataCronograma(pegarCampo(l.valores, "Data de Início", "Data Inicio", "Data"));
    const periodo = parsePeriodoCronograma(pegarCampo(l.valores, "Período", "Periodo", "Turno"));
    const recursoNome = pegarCampo(l.valores, "Recurso", "Recurso Responsável", "Recurso Responsavel").trim();
    return { duracao, unidadeDuracao, dataInicio, periodo, recursoNome: recursoNome || undefined };
  }

  function adicionarTarefa(descricao: string, nivel: number, l: LinhaImportada) {
    const { duracao, unidadeDuracao, dataInicio, periodo, recursoNome } = lerCamposFolha(l);
    linhasValidadas++;
    if (duracao === null) erros.push({ linha: l.linha, descricao });
    atividades.push({
      id: criarAtividadeId(),
      descricao,
      nivel,
      duracao: duracao ?? undefined,
      unidadeDuracao,
      dataInicio,
      periodo,
      recursoNome,
    });
  }

  for (const l of linhas) {
    if (!usaHierarquia) {
      const descricao = pegarCampo(l.valores, "Atividade", "Descrição", "Descricao", "Tarefa", "Item").trim();
      if (!descricao) continue;
      adicionarTarefa(descricao, 0, l);
      continue;
    }

    const pai = pegarCampo(l.valores, "Tarefa Pai", "Pai").trim();
    const filha = pegarCampo(l.valores, "Tarefa Filha", "Filha").trim();
    if (!pai && !filha) continue;

    if (pai && filha) {
      let idPai = idsDoPai.get(pai);
      if (!idPai) {
        idPai = criarAtividadeId();
        idsDoPai.set(pai, idPai);
        atividades.push({ id: idPai, descricao: pai, nivel: 0 });
      }
      adicionarTarefa(filha, 1, l);
    } else {
      adicionarTarefa(pai || filha, 0, l);
    }
  }

  return { atividades, erros, linhasValidadas };
}

/** Nomes de recurso distintos citados no arquivo, na ordem em que aparecem — para a tela de associação. */
export function nomesRecursosDoCronograma(atividades: AtividadeCronogramaBruta[]): string[] {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const a of atividades) {
    if (a.recursoNome && !vistos.has(a.recursoNome)) {
      vistos.add(a.recursoNome);
      nomes.push(a.recursoNome);
    }
  }
  return nomes;
}

/** Aplica a associação nome→recursoId escolhida pelo usuário, produzindo atividades prontas para salvar. */
export function aplicarAssociacaoRecursos(
  atividades: AtividadeCronogramaBruta[],
  associacao: Map<string, string>
): EscopoAtividade[] {
  return atividades.map(({ recursoNome, ...resto }) => ({
    ...resto,
    recursoId: recursoNome ? (associacao.get(recursoNome) ?? null) : null,
  }));
}
