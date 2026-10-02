"use client";

import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { antecedenciasDe, STATUS_ANOTACAO, PRIORIDADE_ANOTACAO, rotuloAntecedencias } from "@/lib/workspace";
import type { Anotacao, StatusAnotacao } from "@/types";

/**
 * Gravação do Workspace. Toda anotação pertence a quem a criou (usuarioId) e as regras do Firestore só deixam o dono ler
 * e gravar — ou, numa tarefa compartilhada (admin/financeiro), também os participantes marcados. Nada aqui toca em
 * projetos, atividades, cronograma ou apontamentos. Cada mudança registra uma linha no histórico (subcoleção "historico")
 * com quem fez.
 */

/** Quem está agindo (o dono ou um participante). */
export interface AtorWorkspace {
  uid: string;
  nome: string;
}

const COLECAO = "anotacoes";
const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export type DadosAnotacao = Pick<
  Anotacao,
  "titulo" | "descricao" | "status" | "prioridade" | "projetoId" | "faseId" | "atividadeId" | "dataLimite" | "tags" | "lembretesDiasAntes" | "participantesUids"
>;

/** Nomes legíveis do contexto, só para o texto do histórico (a anotação guarda os ids). */
export interface NomesContexto {
  projeto: string | null;
  fase: string | null;
  atividade: string | null;
}

function registrar(lote: WriteBatch, anotacaoId: string, ator: AtorWorkspace | string, acao: string, valorAnterior?: string | null, valorNovo?: string | null) {
  const quem = typeof ator === "string" ? { uid: ator, nome: null } : ator;
  lote.set(doc(collection(db, COLECAO, anotacaoId, "historico")), {
    usuarioId: quem.uid,
    usuarioNome: quem.nome,
    acao,
    valorAnterior: valorAnterior ?? null,
    valorNovo: valorNovo ?? null,
    criadoEm: Date.now(),
  });
}

const dataBR = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : null);

/** Cria a anotação (status inicial "A fazer" e prioridade "Normal" quando não vierem) no topo da coluna. */
export async function criarAnotacao(dono: AtorWorkspace, dados: Partial<DadosAnotacao> & { titulo: string }, ordem: number): Promise<string> {
  const ref = doc(collection(db, COLECAO));
  const agora = Date.now();
  const status = dados.status ?? "a_fazer";
  const participantes = (dados.participantesUids ?? []).filter((u) => u !== dono.uid);
  const lote = writeBatch(db);
  lote.set(
    ref,
    limpar({
      usuarioId: dono.uid,
      usuarioNome: dono.nome,
      participantesUids: participantes,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao?.trim() || null,
      status,
      prioridade: dados.prioridade ?? "normal",
      projetoId: dados.projetoId ?? null,
      faseId: dados.projetoId ? (dados.faseId ?? null) : null,
      atividadeId: dados.projetoId ? (dados.atividadeId ?? null) : null,
      dataLimite: dados.dataLimite || null,
      dataConclusao: status === "concluido" ? agora : null,
      tags: dados.tags ?? [],
      // Lembretes só com data limite (padrão: desligado = lista vazia).
      lembretesDiasAntes: dados.dataLimite ? antecedenciasDe({ lembretesDiasAntes: dados.lembretesDiasAntes ?? [] }) : [],
      lembreteDiasAntes: null,
      lembreteLidoEm: null,
      ordem,
      createdAt: agora,
      updatedAt: agora,
      deletedAt: null,
    })
  );
  registrar(lote, ref.id, dono, participantes.length > 0 ? "Tarefa criada e compartilhada" : "Anotação criada");
  await lote.commit();
  if (participantes.length > 0) {
    await avisarNaTarefa({ id: ref.id, titulo: dados.titulo.trim() }, dono, participantes, "marcou você numa tarefa");
  }
  return ref.id;
}

/**
 * Atualiza a anotação e registra no histórico o que mudou. Regras de contexto: sem projeto, fase e atividade ficam
 * vazias; trocar de projeto limpa fase e atividade (a tela já faz, aqui é a garantia). Ir para "Concluído" grava a data
 * da conclusão; sair de "Concluído" mantém a data (fica o registro de quando foi concluída).
 */
export async function atualizarAnotacao(
  atual: Anotacao,
  novo: Partial<DadosAnotacao> & { ordem?: number },
  nomes: { antes: NomesContexto; depois: NomesContexto },
  ator: AtorWorkspace
) {
  const dados: Partial<Anotacao> = { ...novo };
  if ("projetoId" in novo) {
    if (!novo.projetoId) {
      dados.projetoId = null;
      dados.faseId = null;
      dados.atividadeId = null;
    } else if (novo.projetoId !== atual.projetoId) {
      if (!("faseId" in novo)) dados.faseId = null;
      if (!("atividadeId" in novo)) dados.atividadeId = null;
    }
  }
  if (typeof dados.titulo === "string") dados.titulo = dados.titulo.trim();
  if ("descricao" in dados) dados.descricao = dados.descricao?.trim() || null;
  if ("dataLimite" in dados) dados.dataLimite = dados.dataLimite || null;
  if (dados.status === "concluido" && atual.status !== "concluido") dados.dataConclusao = Date.now();
  // Sem data limite não há lembrete. Mudou a data ou a antecedência: o lembrete "rearma" (volta a aparecer como não lido).
  if ("dataLimite" in dados && !dados.dataLimite) dados.lembretesDiasAntes = [];
  const lembreteAntes = antecedenciasDe(atual);
  const lembreteDepois = "lembretesDiasAntes" in dados ? antecedenciasDe({ lembretesDiasAntes: dados.lembretesDiasAntes ?? [] }) : lembreteAntes;
  if ("lembretesDiasAntes" in dados) {
    dados.lembretesDiasAntes = lembreteDepois;
    dados.lembreteDiasAntes = null; // o formato antigo deixa de ser usado
  }
  const lembreteMudou = lembreteDepois.join(",") !== lembreteAntes.join(",");
  const dataMudou = "dataLimite" in dados && (dados.dataLimite ?? null) !== (atual.dataLimite ?? null);
  if (lembreteMudou || dataMudou) dados.lembreteLidoEm = null;
  // Participantes: só o dono muda (a tela e as regras garantem); nunca inclui o próprio dono.
  const participantesAntes = atual.participantesUids ?? [];
  if ("participantesUids" in dados) dados.participantesUids = (dados.participantesUids ?? []).filter((x) => x !== atual.usuarioId);
  const participantesDepois = dados.participantesUids ?? participantesAntes;
  const adicionados = participantesDepois.filter((x) => !participantesAntes.includes(x));
  const participantesMudaram = participantesDepois.join("|") !== participantesAntes.join("|");

  const lote = writeBatch(db);
  lote.update(doc(db, COLECAO, atual.id), limpar({ ...dados, updatedAt: Date.now() }));

  const u = ator;
  if (dados.titulo !== undefined && dados.titulo !== atual.titulo) registrar(lote, atual.id, u, "Título alterado", atual.titulo, dados.titulo);
  if ("descricao" in dados && (dados.descricao ?? null) !== (atual.descricao ?? null)) registrar(lote, atual.id, u, "Descrição alterada");
  if (dados.status && dados.status !== atual.status) {
    registrar(lote, atual.id, u, `Status alterado para ${STATUS_ANOTACAO[dados.status].label}`, STATUS_ANOTACAO[atual.status].label, STATUS_ANOTACAO[dados.status].label);
  }
  if (dados.prioridade && dados.prioridade !== atual.prioridade) {
    registrar(lote, atual.id, u, "Prioridade alterada", PRIORIDADE_ANOTACAO[atual.prioridade].label, PRIORIDADE_ANOTACAO[dados.prioridade].label);
  }
  if ("projetoId" in dados && (dados.projetoId ?? null) !== (atual.projetoId ?? null)) {
    const acao = !dados.projetoId ? "Projeto removido" : !atual.projetoId ? `Projeto ${nomes.depois.projeto ?? ""} vinculado` : "Projeto alterado";
    registrar(lote, atual.id, u, acao.replace(/\s+/g, " ").trim(), nomes.antes.projeto, nomes.depois.projeto);
  }
  if ("faseId" in dados && (dados.faseId ?? null) !== (atual.faseId ?? null) && dados.projetoId !== null) {
    registrar(lote, atual.id, u, dados.faseId ? "Fase vinculada" : "Fase removida", nomes.antes.fase, nomes.depois.fase);
  }
  if ("atividadeId" in dados && (dados.atividadeId ?? null) !== (atual.atividadeId ?? null) && dados.projetoId !== null) {
    registrar(lote, atual.id, u, dados.atividadeId ? "Atividade vinculada" : "Atividade removida", nomes.antes.atividade, nomes.depois.atividade);
  }
  if ("dataLimite" in dados && (dados.dataLimite ?? null) !== (atual.dataLimite ?? null)) {
    registrar(lote, atual.id, u, dados.dataLimite ? "Data limite definida" : "Data limite removida", dataBR(atual.dataLimite), dataBR(dados.dataLimite));
  }
  if (lembreteMudou) {
    registrar(
      lote,
      atual.id,
      u,
      lembreteDepois.length === 0 ? "Lembrete desligado" : lembreteAntes.length === 0 ? "Lembrete ligado" : "Lembretes alterados",
      lembreteAntes.length === 0 ? null : rotuloAntecedencias(lembreteAntes),
      lembreteDepois.length === 0 ? null : rotuloAntecedencias(lembreteDepois)
    );
  }
  if (dados.tags && dados.tags.join("|") !== (atual.tags ?? []).join("|")) {
    registrar(lote, atual.id, u, "Tags alteradas", (atual.tags ?? []).map((t) => `#${t}`).join(" ") || null, dados.tags.map((t) => `#${t}`).join(" ") || null);
  }
  if (participantesMudaram) {
    registrar(lote, atual.id, u, participantesDepois.length === 0 ? "Tarefa deixou de ser compartilhada" : "Participantes alterados");
  }
  await lote.commit();

  // Avisos no sino de quem participa: quem foi marcado agora, e todos os outros quando o status muda.
  const titulo = dados.titulo ?? atual.titulo;
  if (adicionados.length > 0) await avisarNaTarefa({ id: atual.id, titulo }, ator, adicionados, "marcou você numa tarefa");
  if (dados.status && dados.status !== atual.status) {
    const outros = [atual.usuarioId, ...participantesDepois].filter((x) => x !== ator.uid && !adicionados.includes(x));
    if (outros.length > 0 && participantesDepois.length > 0) {
      await avisarNaTarefa({ id: atual.id, titulo }, ator, outros, `moveu para ${STATUS_ANOTACAO[dados.status].label}`);
    }
  }
}

/**
 * Aviso no sino (coleção "notificacoes") para quem participa de uma tarefa compartilhada. Falhar o aviso não desfaz a
 * gravação da tarefa (só registra no console).
 */
export async function avisarNaTarefa(anotacao: Pick<Anotacao, "id" | "titulo">, ator: AtorWorkspace, destinatarios: string[], texto: string) {
  const unicos = [...new Set(destinatarios)].filter((d) => d && d !== ator.uid);
  for (const destinatarioUid of unicos) {
    try {
      await addDoc(collection(db, "notificacoes"), {
        destinatarioUid,
        origem: "workspace",
        anotacaoId: anotacao.id,
        projetoId: "",
        projetoNome: anotacao.titulo.slice(0, 200),
        contatoId: "",
        autorUid: ator.uid,
        autorNome: ator.nome,
        tipo: "atualizacao",
        texto: texto.slice(0, 200),
        criadoEm: Date.now(),
        lida: false,
      });
    } catch (err) {
      console.warn("Não foi possível avisar o participante da tarefa:", err);
    }
  }
}

/** Registra uma atualização na conversa da tarefa compartilhada e avisa os demais participantes. */
export async function comentarNaTarefa(anotacao: Anotacao, ator: AtorWorkspace, texto: string) {
  const limpo = texto.trim().slice(0, 2000);
  if (!limpo) return;
  await addDoc(collection(db, COLECAO, anotacao.id, "comentarios"), {
    usuarioId: ator.uid,
    usuarioNome: ator.nome,
    texto: limpo,
    criadoEm: Date.now(),
  });
  await avisarNaTarefa(anotacao, ator, [anotacao.usuarioId, ...(anotacao.participantesUids ?? [])], `comentou: ${limpo}`);
}

const SEM_NOMES: NomesContexto = { projeto: null, fase: null, atividade: null };

/** Move no Kanban (arrastar): troca o status e/ou a posição. */
export async function moverAnotacao(atual: Anotacao, status: StatusAnotacao, ordem: number, ator: AtorWorkspace) {
  await atualizarAnotacao(atual, { status, ordem }, { antes: SEM_NOMES, depois: SEM_NOMES }, ator);
}

/** Arquiva a anotação (de qualquer status): ela sai do Kanban e fica em "Arquivadas". */
export async function arquivarAnotacao(atual: Anotacao, ator: AtorWorkspace) {
  if (atual.status === "arquivado") return;
  await atualizarAnotacao(atual, { status: "arquivado" }, { antes: SEM_NOMES, depois: SEM_NOMES }, ator);
}

/** RN009: arquivada volta para "A fazer" ou "Em andamento" (no topo da coluna). */
export async function restaurarAnotacao(atual: Anotacao, para: "a_fazer" | "em_andamento", ordem: number, ator: AtorWorkspace) {
  await atualizarAnotacao(atual, { status: para, ordem }, { antes: SEM_NOMES, depois: SEM_NOMES }, ator);
}

/**
 * Excluir manda para a lixeira (exclusão lógica: deletedAt). Lá ela fica DIAS_NA_LIXEIRA dias, pode ser restaurada,
 * e depois é apagada de vez.
 */
export async function excluirAnotacao(atual: Anotacao) {
  const lote = writeBatch(db);
  const agora = Date.now();
  lote.update(doc(db, COLECAO, atual.id), { deletedAt: agora, updatedAt: agora });
  registrar(lote, atual.id, atual.usuarioId, "Anotação movida para a lixeira");
  await lote.commit();
}

/** Tira da lixeira: volta exatamente como estava (mesmo status, projeto, tags...). */
export async function restaurarDaLixeira(atual: Anotacao) {
  const lote = writeBatch(db);
  lote.update(doc(db, COLECAO, atual.id), { deletedAt: null, updatedAt: Date.now() });
  registrar(lote, atual.id, atual.usuarioId, "Anotação restaurada da lixeira");
  await lote.commit();
}

/**
 * Apaga de vez uma anotação que está na lixeira, junto com o histórico dela (o Firestore não apaga subcoleções
 * sozinho). Primeiro o histórico, depois a anotação — as regras só permitem apagar o que está na lixeira.
 */
export async function excluirDefinitivamente(atual: Anotacao) {
  if (!atual.deletedAt) throw new Error("Só dá para apagar de vez o que está na lixeira.");
  for (const sub of ["historico", "comentarios"]) {
    const filhos = await getDocs(collection(db, COLECAO, atual.id, sub));
    for (let i = 0; i < filhos.docs.length; i += 400) {
      const lote = writeBatch(db);
      filhos.docs.slice(i, i + 400).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
  }
  await deleteDoc(doc(db, COLECAO, atual.id));
}

/** O dono marcou o lembrete como lido no sino de notificações (não entra no histórico). */
export async function marcarLembreteLido(atual: Pick<Anotacao, "id">) {
  await updateDoc(doc(db, COLECAO, atual.id), { lembreteLidoEm: Date.now() });
}
