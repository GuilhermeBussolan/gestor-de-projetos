import { criarAtividadeId, duracaoEmMinutos, fimDoBloco, formatarDataCurta, formatarMinutos, idsFolhas, nivelAtividade } from "@/lib/escopo";
import { PERIODO_LABEL } from "@/lib/cronograma";
import type { EscopoAtividade, MudancaCronograma, ResumoVersaoCronograma } from "@/types";

/**
 * O cronograma de um projeto é "vivo": a cada importação a ordem e o conteúdo podem mudar. O que
 * liga o realizado (apontamentos guardam IDs de atividade) ao previsto é o ID — por isso, ao
 * importar uma nova versão, cada atividade nova tenta reaproveitar o ID da atividade equivalente
 * da versão atual, e o resto (o que mudou) é apresentado para conferência antes de gravar.
 */

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Caminho legível ("Fase 3 › Riscos › Levantamento"), sem normalização. */
export function caminhosLegiveis(atividades: EscopoAtividade[]): string[] {
  const pilha: string[] = [];
  return atividades.map((a) => {
    const n = nivelAtividade(a);
    pilha.length = n;
    pilha[n] = a.descricao;
    return pilha.slice(0, n + 1).join(" › ");
  });
}

/** ID do pai de cada atividade (null para as raízes). */
function idsDosPais(atividades: EscopoAtividade[]): (string | null)[] {
  const pilha: string[] = [];
  return atividades.map((a) => {
    const n = nivelAtividade(a);
    pilha.length = n;
    const pai = n > 0 ? (pilha[n - 1] ?? null) : null;
    pilha[n] = a.id;
    return pai;
  });
}

/** Chave única de cada atividade: caminho normalizado + "#k" quando o mesmo caminho se repete. */
function chavesDeCaminho(atividades: EscopoAtividade[]): string[] {
  const pilha: string[] = [];
  const vistas = new Map<string, number>();
  return atividades.map((a) => {
    const n = nivelAtividade(a);
    pilha.length = n;
    pilha[n] = normalizar(a.descricao);
    const base = pilha.slice(0, n + 1).join(" › ");
    const k = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, k);
    return k === 1 ? base : `${base}#${k}`;
  });
}

export function totalMinutosFolhas(atividades: EscopoAtividade[]): number {
  const folhas = idsFolhas(atividades);
  return atividades.reduce((s, a) => s + (folhas.has(a.id) ? duracaoEmMinutos(a) : 0), 0);
}

export interface ResultadoCasamento {
  /** As atividades novas, já com o ID da equivalente da versão atual quando houve par. */
  atividades: EscopoAtividade[];
  /** Atividades da versão atual que não encontraram par no arquivo novo. */
  semParAntigas: EscopoAtividade[];
  /** Atividades do arquivo novo que não encontraram par na versão atual (ids originais do arquivo). */
  semParNovas: EscopoAtividade[];
}

/**
 * Liga as atividades do arquivo às da versão atual:
 * 1. vínculos manuais (o usuário disse que "A" antiga é a "B" nova);
 * 2. mesmo caminho hierárquico (Fase › Grupo › Tarefa) — ordem não importa;
 * 3. mesmo nome, único de cada lado — a tarefa mudou de lugar na hierarquia.
 * O resto fica sem par (nova / removida) e não é adivinhado: ligar horas à atividade errada é pior
 * do que pedir a confirmação do usuário.
 */
export function casarAtividades(
  antigas: EscopoAtividade[],
  novas: EscopoAtividade[],
  vinculosManuais: Map<string, string> = new Map()
): ResultadoCasamento {
  const parDeNova = new Map<number, number>();
  const antigaUsada = new Set<number>();

  const indiceAntigaPorId = new Map(antigas.map((a, i) => [a.id, i]));
  const indiceNovaPorId = new Map(novas.map((a, i) => [a.id, i]));
  vinculosManuais.forEach((idNova, idAntiga) => {
    const i = indiceAntigaPorId.get(idAntiga);
    const j = indiceNovaPorId.get(idNova);
    if (i === undefined || j === undefined || antigaUsada.has(i) || parDeNova.has(j)) return;
    parDeNova.set(j, i);
    antigaUsada.add(i);
  });

  const chavesAntigas = chavesDeCaminho(antigas);
  const chavesNovas = chavesDeCaminho(novas);
  const antigaPorChave = new Map<string, number>();
  chavesAntigas.forEach((c, i) => antigaPorChave.set(c, i));
  novas.forEach((_, j) => {
    if (parDeNova.has(j)) return;
    const i = antigaPorChave.get(chavesNovas[j]);
    if (i === undefined || antigaUsada.has(i)) return;
    parDeNova.set(j, i);
    antigaUsada.add(i);
  });

  const contar = (lista: EscopoAtividade[], livre: (i: number) => boolean) => {
    const m = new Map<string, number[]>();
    lista.forEach((a, i) => {
      if (!livre(i)) return;
      const k = normalizar(a.descricao);
      m.set(k, [...(m.get(k) ?? []), i]);
    });
    return m;
  };
  const antigasPorNome = contar(antigas, (i) => !antigaUsada.has(i));
  const novasPorNome = contar(novas, (j) => !parDeNova.has(j));
  novasPorNome.forEach((js, nome) => {
    const is = antigasPorNome.get(nome);
    if (js.length === 1 && is && is.length === 1) {
      parDeNova.set(js[0], is[0]);
      antigaUsada.add(is[0]);
    }
  });

  return {
    atividades: novas.map((a, j) => (parDeNova.has(j) ? { ...a, id: antigas[parDeNova.get(j)!].id } : a)),
    semParAntigas: antigas.filter((_, i) => !antigaUsada.has(i)),
    semParNovas: novas.filter((_, j) => !parDeNova.has(j)),
  };
}

export const GRUPO_REALIZADO_ANTERIOR = "Realizado em versões anteriores";

export interface ResultadoPreservacao {
  atividades: EscopoAtividade[];
  /** Tarefas que saíram do arquivo mas foram mantidas por já terem horas apontadas. */
  mantidas: EscopoAtividade[];
  /** Tarefas já concluídas cuja data/período/recurso do arquivo novo foram trocados pelos da versão anterior. */
  agendaPreservada: { caminho: string; detalhe: string }[];
}

function agendaIgual(a: EscopoAtividade, b: EscopoAtividade) {
  return (a.dataInicio ?? null) === (b.dataInicio ?? null) && (a.periodo ?? null) === (b.periodo ?? null) && (a.recursoId ?? null) === (b.recursoId ?? null);
}

/**
 * Não deixa uma nova versão apagar o histórico do que já foi feito:
 * - tarefa já CONCLUÍDA que continua no arquivo mantém a data, o período e o recurso em que foi
 *   realizada (o arquivo novo só remaneja o que ainda não aconteceu);
 * - tarefa com horas apontadas que SAIU do arquivo é mantida no cronograma (marcada como
 *   "realizada em versão anterior"), dentro do mesmo grupo quando ele ainda existe, ou num grupo
 *   "Realizado em versões anteriores" no fim.
 * `progresso` vem de calcularProgressoFolhas sobre o escopo atual (versão antiga).
 */
export function preservarRealizado(
  antigas: EscopoAtividade[],
  novas: EscopoAtividade[],
  progresso: Map<string, { horas: number; finalizada: boolean }>,
  nomeRecurso: (id: string) => string = () => "recurso"
): ResultadoPreservacao {
  const antigaPorId = new Map(antigas.map((a) => [a.id, a]));
  const folhasAntigas = idsFolhas(antigas);
  const caminhosNovos = caminhosLegiveis(novas);
  const agendaPreservada: { caminho: string; detalhe: string }[] = [];

  let resultado = novas.map((a, j) => {
    const antiga = antigaPorId.get(a.id);
    if (!antiga || !folhasAntigas.has(a.id) || !progresso.get(a.id)?.finalizada) return a;
    if (agendaIgual(antiga, a)) return a;
    agendaPreservada.push({
      caminho: caminhosNovos[j],
      detalhe: `arquivo novo: ${textoAgenda(a, nomeRecurso) || "sem agenda"} — mantido: ${textoAgenda(antiga, nomeRecurso) || "sem agenda"}`,
    });
    return { ...a, dataInicio: antiga.dataInicio ?? null, periodo: antiga.periodo ?? null, recursoId: antiga.recursoId ?? null };
  });

  const idsNovos = new Set(novas.map((a) => a.id));
  const paisAntigos = idsDosPais(antigas);
  const indiceAntiga = new Map(antigas.map((a, i) => [a.id, i]));
  const mantidas: EscopoAtividade[] = [];
  let idGrupoFinal: string | null = null;

  antigas.forEach((a) => {
    if (idsNovos.has(a.id) || !folhasAntigas.has(a.id)) return;
    if ((progresso.get(a.id)?.horas ?? 0) <= 0) return;
    const mantida: EscopoAtividade = { ...a, realizadaEmVersaoAnterior: true };
    mantidas.push(mantida);

    // Ancestral mais próximo que continua existindo na nova versão.
    let paiId = paisAntigos[indiceAntiga.get(a.id)!];
    while (paiId && !idsNovos.has(paiId)) paiId = paisAntigos[indiceAntiga.get(paiId)!];

    if (paiId) {
      const iPai = resultado.findIndex((x) => x.id === paiId);
      const fim = fimDoBloco(resultado, iPai);
      resultado = [...resultado.slice(0, fim), { ...mantida, nivel: nivelAtividade(resultado[iPai]) + 1 }, ...resultado.slice(fim)];
      return;
    }
    if (idGrupoFinal === null) {
      const existente = antigas.find((x) => nivelAtividade(x) === 0 && x.descricao === GRUPO_REALIZADO_ANTERIOR);
      idGrupoFinal = existente?.id ?? criarAtividadeId();
      if (!resultado.some((x) => x.id === idGrupoFinal)) {
        resultado = [...resultado, { id: idGrupoFinal, descricao: GRUPO_REALIZADO_ANTERIOR, nivel: 0 }];
      }
    }
    resultado = [...resultado, { ...mantida, nivel: 1 }];
  });

  return { atividades: resultado, mantidas, agendaPreservada };
}

/** Índices (em `seq`) que ficam de fora da maior subsequência crescente — o que "trocou de lugar". */
function foraDaMaiorSubsequenciaCrescente(seq: number[]): Set<number> {
  const n = seq.length;
  const comp = new Array<number>(n).fill(1);
  const ant = new Array<number>(n).fill(-1);
  let melhor = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (seq[j] < seq[i] && comp[j] + 1 > comp[i]) {
        comp[i] = comp[j] + 1;
        ant[i] = j;
      }
    }
    if (n > 0 && comp[i] > comp[melhor]) melhor = i;
  }
  const dentro = new Set<number>();
  for (let i = n > 0 ? melhor : -1; i >= 0; i = ant[i]) dentro.add(i);
  const fora = new Set<number>();
  for (let i = 0; i < n; i++) if (!dentro.has(i)) fora.add(i);
  return fora;
}

function textoAgenda(a: EscopoAtividade, nomeRecurso: (id: string) => string): string {
  const partes = [
    a.dataInicio ? formatarDataCurta(a.dataInicio) : "sem data",
    a.periodo ? PERIODO_LABEL[a.periodo] : null,
    a.recursoId ? nomeRecurso(a.recursoId) : null,
  ].filter(Boolean);
  return partes.join(" · ");
}

const RESUMO_ZERADO: ResumoVersaoCronograma = {
  mantidas: 0,
  novas: 0,
  removidas: 0,
  duracaoAlterada: 0,
  movidas: 0,
  renomeadas: 0,
  reordenadas: 0,
  agendaAlterada: 0,
  mantidasPorRealizado: 0,
  agendaPreservada: 0,
};

/**
 * Compara duas versões pelo ID (os IDs são preservados de uma versão para a outra pelo casamento).
 * `nomeRecurso` só serve para escrever "quem faz" nas mudanças de agenda.
 */
export function compararVersoes(
  antes: EscopoAtividade[],
  depois: EscopoAtividade[],
  nomeRecurso: (id: string) => string = () => "recurso"
): { resumo: ResumoVersaoCronograma; mudancas: MudancaCronograma[] } {
  const resumo = { ...RESUMO_ZERADO };
  const mudancas: MudancaCronograma[] = [];
  const folhasAntes = idsFolhas(antes);
  const folhasDepois = idsFolhas(depois);
  const caminhosAntes = caminhosLegiveis(antes);
  const caminhosDepois = caminhosLegiveis(depois);
  const paisAntes = idsDosPais(antes);
  const paisDepois = idsDosPais(depois);
  const indiceAntes = new Map(antes.map((a, i) => [a.id, i]));
  const idsDepois = new Set(depois.map((a) => a.id));

  // Ordem: só entre quem existe nos dois lados.
  const pares = depois
    .map((a, j) => ({ j, i: indiceAntes.get(a.id) }))
    .filter((p): p is { j: number; i: number } => p.i !== undefined);
  const trocaramDeLugar = foraDaMaiorSubsequenciaCrescente(pares.map((p) => p.i));
  const reordenadas = new Set<number>(); // índices em `depois`
  trocaramDeLugar.forEach((k) => reordenadas.add(pares[k].j));

  depois.forEach((a, j) => {
    const i = indiceAntes.get(a.id);
    if (i === undefined) {
      if (folhasDepois.has(a.id)) {
        resumo.novas++;
        mudancas.push({ tipo: "nova", caminho: caminhosDepois[j], detalhe: formatarMinutos(duracaoEmMinutos(a)) });
      }
      return;
    }
    const antiga = antes[i];
    if (a.realizadaEmVersaoAnterior) {
      if (!antiga.realizadaEmVersaoAnterior) {
        resumo.mantidasPorRealizado = (resumo.mantidasPorRealizado ?? 0) + 1;
        mudancas.push({ tipo: "mantida", caminho: caminhosDepois[j], detalhe: "saiu do arquivo, mas já tem horas apontadas" });
      }
      return;
    }
    let mudou = false;
    if (normalizar(antiga.descricao) !== normalizar(a.descricao)) {
      resumo.renomeadas++;
      mudou = true;
      mudancas.push({ tipo: "renomeada", caminho: caminhosDepois[j], detalhe: `${antiga.descricao} → ${a.descricao}` });
    }
    // Pelo ID do pai: renomear um grupo não faz os filhos parecerem "movidos".
    if (paisAntes[i] !== paisDepois[j]) {
      resumo.movidas++;
      mudou = true;
      mudancas.push({ tipo: "movida", caminho: caminhosDepois[j], detalhe: `estava em ${caminhosAntes[i].split(" › ").slice(0, -1).join(" › ") || "raiz"}` });
    } else if (reordenadas.has(j)) {
      resumo.reordenadas++;
      mudou = true;
      mudancas.push({ tipo: "reordenada", caminho: caminhosDepois[j] });
    }
    if (folhasDepois.has(a.id) && folhasAntes.has(a.id)) {
      const dAntes = duracaoEmMinutos(antiga);
      const dDepois = duracaoEmMinutos(a);
      if (dAntes !== dDepois) {
        resumo.duracaoAlterada++;
        mudou = true;
        mudancas.push({ tipo: "duracao", caminho: caminhosDepois[j], detalhe: `${formatarMinutos(dAntes)} → ${formatarMinutos(dDepois)}` });
      }
      const agAntes = textoAgenda(antiga, nomeRecurso);
      const agDepois = textoAgenda(a, nomeRecurso);
      if (agAntes !== agDepois) {
        resumo.agendaAlterada++;
        mudou = true;
        mudancas.push({ tipo: "agenda", caminho: caminhosDepois[j], detalhe: `${agAntes || "sem agenda"} → ${agDepois || "sem agenda"}` });
      }
    }
    if (!mudou && folhasDepois.has(a.id)) resumo.mantidas++;
  });

  antes.forEach((a, i) => {
    if (idsDepois.has(a.id) || !folhasAntes.has(a.id)) return;
    if (a.realizadaEmVersaoAnterior) return;
    resumo.removidas++;
    mudancas.push({ tipo: "removida", caminho: caminhosAntes[i], detalhe: formatarMinutos(duracaoEmMinutos(a)) });
  });

  return { resumo, mudancas };
}
