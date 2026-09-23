import { pegarCampo, type LinhaImportada } from "@/lib/importarArquivo";
import { criarAtividadeId } from "@/lib/escopo";
import type { EscopoAtividade, UnidadeDuracao } from "@/types";

export interface ErroDuracao {
  linha: number;
  descricao: string;
}

export interface ResultadoImportacaoEscopo {
  atividades: EscopoAtividade[];
  /** Linhas reais do arquivo sem duração válida (não conta linhas "pai" sintéticas). */
  erros: ErroDuracao[];
  linhasValidadas: number;
}

export function normalizarUnidade(texto: string): UnidadeDuracao {
  return texto.trim().toLowerCase().startsWith("min") ? "minutos" : "horas";
}

/** Aceita vírgula decimal; retorna null quando vazio, não numérico ou <= 0. */
export function parseDuracao(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Converte as linhas lidas do arquivo em atividades de escopo. Duas colunas suportadas:
 * - "Tarefa Pai" / "Tarefa Filha" (hierarquia de 2 níveis) — se nenhuma das duas existir no
 *   arquivo, cai para o formato antigo de uma coluna só ("Atividade"/"Descrição").
 * - "Duração" é obrigatória em toda linha real (uma linha "pai" sozinha, sem filha, também
 *   é uma tarefa real e precisa de duração); "Unidade" é opcional, padrão "horas".
 */
export function converterLinhasEmAtividades(linhas: LinhaImportada[]): ResultadoImportacaoEscopo {
  if (linhas.some((l) => pegarCampo(l.valores, "Nível", "Nivel").trim())) {
    return converterLinhasComNivel(linhas);
  }

  const usaHierarquia = linhas.some(
    (l) => pegarCampo(l.valores, "Tarefa Pai", "Pai") || pegarCampo(l.valores, "Tarefa Filha", "Filha")
  );

  const atividades: EscopoAtividade[] = [];
  const erros: ErroDuracao[] = [];
  const idsDoPai = new Map<string, string>();
  let linhasValidadas = 0;

  function lerDuracao(l: LinhaImportada) {
    const duracao = parseDuracao(pegarCampo(l.valores, "Duração", "Duracao", "Horas"));
    const unidadeDuracao = normalizarUnidade(pegarCampo(l.valores, "Unidade", "Unidade Duração", "Unidade Duracao"));
    return { duracao, unidadeDuracao };
  }

  function adicionarTarefa(descricao: string, nivel: number, l: LinhaImportada) {
    const { duracao, unidadeDuracao } = lerDuracao(l);
    linhasValidadas++;
    if (duracao === null) erros.push({ linha: l.linha, descricao });
    atividades.push({
      id: criarAtividadeId(),
      descricao,
      nivel,
      duracao: duracao ?? undefined,
      unidadeDuracao,
    });
  }

  for (const l of linhas) {
    if (!usaHierarquia) {
      const descricao = pegarCampo(l.valores, "Atividade", "Descrição", "Descricao", "Item").trim();
      if (!descricao) continue;
      adicionarTarefa(descricao, 0, l);
      continue;
    }

    const pai = pegarCampo(l.valores, "Tarefa Pai", "Pai").trim();
    const filha = pegarCampo(l.valores, "Tarefa Filha", "Filha", "Tarefa").trim();
    if (!pai && !filha) continue;

    if (pai && filha) {
      let idPai = idsDoPai.get(pai);
      if (!idPai) {
        // O pai é só um agrupador: não exige duração própria, não entra na contagem de erros.
        idPai = criarAtividadeId();
        idsDoPai.set(pai, idPai);
        atividades.push({ id: idPai, descricao: pai, nivel: 0 });
      }
      adicionarTarefa(filha, 1, l);
    } else {
      // Só uma das colunas preenchida: é uma tarefa raiz sem filhos, com duração própria.
      adicionarTarefa(pai || filha, 0, l);
    }
  }

  return { atividades, erros, linhasValidadas };
}

/**
 * Hierarquia de qualquer profundidade pela coluna "Nível" (0 ou 1 = raiz; aceita as duas bases).
 * A ordem das linhas é a ordem do escopo. Quem tem linhas mais fundas logo depois é agrupador e não
 * precisa de duração (ela é a soma dos filhos); as demais linhas exigem "Duração".
 */
function converterLinhasComNivel(linhas: LinhaImportada[]): ResultadoImportacaoEscopo {
  const lidas = linhas
    .map((l) => ({
      l,
      descricao: pegarCampo(l.valores, "Atividade", "Descrição", "Descricao", "Tarefa", "Item").trim(),
      nivel: Number(pegarCampo(l.valores, "Nível", "Nivel").trim().replace(",", ".")),
    }))
    .filter((x) => x.descricao);
  const validos = lidas.filter((x) => Number.isFinite(x.nivel) && x.nivel >= 0);
  const base = validos.length ? Math.min(...validos.map((x) => x.nivel)) : 0;

  const atividades: EscopoAtividade[] = [];
  const erros: ErroDuracao[] = [];
  let linhasValidadas = 0;
  let anterior = 0;
  lidas.forEach((x, i) => {
    const bruto = Number.isFinite(x.nivel) && x.nivel >= 0 ? Math.round(x.nivel - base) : anterior;
    const nivel = Math.min(bruto, anterior + 1);
    anterior = nivel;
    const proximo = lidas[i + 1];
    const proximoBruto = proximo && Number.isFinite(proximo.nivel) ? Math.round(proximo.nivel - base) : 0;
    const agrupador = proximo !== undefined && proximoBruto > bruto;
    if (agrupador) {
      atividades.push({ id: criarAtividadeId(), descricao: x.descricao, nivel });
      return;
    }
    const duracao = parseDuracao(pegarCampo(x.l.valores, "Duração", "Duracao", "Horas"));
    const unidadeDuracao = normalizarUnidade(pegarCampo(x.l.valores, "Unidade", "Unidade Duração", "Unidade Duracao"));
    linhasValidadas++;
    if (duracao === null) erros.push({ linha: x.l.linha, descricao: x.descricao });
    atividades.push({ id: criarAtividadeId(), descricao: x.descricao, nivel, duracao: duracao ?? undefined, unidadeDuracao });
  });
  return { atividades, erros, linhasValidadas };
}

/** Aplica na tela de pré-importação as durações que o usuário preencheu para corrigir os erros. */
export function aplicarCorrecoesDuracao(
  atividades: EscopoAtividade[],
  correcoes: Map<string, string>
): EscopoAtividade[] {
  return atividades.map((a) => {
    const texto = correcoes.get(a.id);
    if (texto === undefined) return a;
    const duracao = parseDuracao(texto);
    return duracao === null ? a : { ...a, duracao };
  });
}

/** Atividades reais sem duração (exclui as linhas "pai" que são só agrupadoras). */
export function atividadesSemDuracao(atividades: EscopoAtividade[]): EscopoAtividade[] {
  return atividades.filter((a, i, arr) => {
    const temFilhoDepois = i + 1 < arr.length && (arr[i + 1].nivel ?? 0) > (a.nivel ?? 0);
    return !temFilhoDepois && !a.duracao;
  });
}
