import { collection, doc, getDocs, query, updateDoc, where, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { totaisPorTipo, type ItemBase, type ParceiroBase } from "@/lib/fechamento";
import type { ArquivoFechamento, Fechamento, StatusFechamento } from "@/types";

export interface Ator {
  uid: string;
  nomeCompleto: string;
}

const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function registrar(
  lote: WriteBatch,
  mesAno: string,
  de: StatusFechamento | null,
  para: StatusFechamento,
  acao: string,
  ator: Ator,
  motivo?: string
) {
  lote.set(
    doc(collection(db, "fechamentos", mesAno, "historico")),
    limpar({ de, para, acao, usuarioId: ator.uid, usuarioNome: ator.nomeCompleto, em: Date.now(), motivo: motivo?.trim() || null })
  );
}

async function itensDoMes(mesAno: string) {
  const snap = await getDocs(query(collection(db, "fechamentoItens"), where("mesAno", "==", mesAno)));
  return snap.docs;
}

async function parceirosDoMes(mesAno: string) {
  const snap = await getDocs(query(collection(db, "fechamentoParceiros"), where("mesAno", "==", mesAno)));
  return snap.docs;
}

const CIENCIA_VAZIA = { em: null };
const CONFIRMACAO_PENDENTE = { status: "pendente" };

/**
 * Rascunho/em revisão -> em revisão: congela o que cada consultor tem a receber (um item por recurso)
 * e os totais por tipo. Serve também para "atualizar" uma revisão com as horas atuais.
 */
export async function enviarParaRevisao({
  mesAno,
  atual,
  itens,
  parceiros,
  ator,
  motivo,
}: {
  mesAno: string;
  atual: Fechamento | null;
  itens: ItemBase[];
  parceiros: ParceiroBase[];
  ator: Ator;
  motivo?: string;
}) {
  const lote = writeBatch(db);
  (await itensDoMes(mesAno)).forEach((d) => lote.delete(d.ref));
  (await parceirosDoMes(mesAno)).forEach((d) => lote.delete(d.ref));
  for (const item of itens) {
    // A conferência é da parceira (grupo), não de cada consultor: o item só guarda o detalhe.
    lote.set(doc(db, "fechamentoItens", item.id), limpar({ ...item, liberado: false, confirmacao: { status: "nao_aplicavel" } }));
  }
  for (const parceiro of parceiros) {
    lote.set(
      doc(db, "fechamentoParceiros", parceiro.id),
      limpar({ ...parceiro, liberado: false, ciencia: CIENCIA_VAZIA, confirmacao: CONFIRMACAO_PENDENTE })
    );
  }
  const de = atual?.status ?? null;
  lote.set(
    doc(db, "fechamentos", mesAno),
    limpar({
      mesAno,
      status: "em_revisao",
      criadoEm: atual?.criadoEm ?? Date.now(),
      criadoPorNome: atual?.criadoPorNome ?? ator.nomeCompleto,
      atualizadoEm: Date.now(),
      totais: totaisPorTipo(itens),
      fechadoEm: null,
      fechadoPorNome: null,
      justificativaDivergencias: null,
      liberadoEm: null,
      liberadoPorId: null,
      liberadoPorNome: null,
      observacaoLiberacao: null,
    }),
    { merge: true }
  );
  registrar(lote, mesAno, de, "em_revisao", de === "em_revisao" ? "Valores atualizados com as horas atuais" : de ? "Reaberto para revisão" : "Enviado para revisão", ator, motivo);
  await lote.commit();
}

/** Em revisão -> rascunho: descarta os valores congelados (volta a calcular ao vivo). */
export async function voltarParaRascunho({ mesAno, ator, motivo }: { mesAno: string; ator: Ator; motivo: string }) {
  const lote = writeBatch(db);
  (await itensDoMes(mesAno)).forEach((d) => lote.delete(d.ref));
  (await parceirosDoMes(mesAno)).forEach((d) => lote.delete(d.ref));
  lote.set(doc(db, "fechamentos", mesAno), { status: "rascunho", totais: null, atualizadoEm: Date.now() }, { merge: true });
  registrar(lote, mesAno, "em_revisao", "rascunho", "Voltou para rascunho", ator, motivo);
  await lote.commit();
}

/** Em revisão -> fechado. `justificativa` é obrigatória quando há divergências bloqueantes. */
export async function fechar({ mesAno, ator, justificativa }: { mesAno: string; ator: Ator; justificativa?: string }) {
  const lote = writeBatch(db);
  lote.set(
    doc(db, "fechamentos", mesAno),
    limpar({
      status: "fechado",
      fechadoEm: Date.now(),
      fechadoPorNome: ator.nomeCompleto,
      justificativaDivergencias: justificativa?.trim() || null,
      atualizadoEm: Date.now(),
    }),
    { merge: true }
  );
  registrar(lote, mesAno, "em_revisao", "fechado", justificativa?.trim() ? "Fechado com divergências justificadas" : "Fechado", ator, justificativa);
  await lote.commit();
}

/** Fechado/faturado -> em revisão (erro detectado). Se já estava liberado, o consultor deixa de ver o item e a confirmação recomeça. */
export async function reabrir({ mesAno, de, ator, motivo }: { mesAno: string; de: StatusFechamento; ator: Ator; motivo: string }) {
  const lote = writeBatch(db);
  (await itensDoMes(mesAno)).forEach((d) => lote.update(d.ref, { liberado: false }));
  // Reabrir invalida o que o responsável da parceira já viu/confirmou: recomeça do zero.
  (await parceirosDoMes(mesAno)).forEach((d) => lote.update(d.ref, { liberado: false, ciencia: CIENCIA_VAZIA, confirmacao: CONFIRMACAO_PENDENTE }));
  lote.set(
    doc(db, "fechamentos", mesAno),
    limpar({
      status: "em_revisao",
      fechadoEm: null,
      fechadoPorNome: null,
      justificativaDivergencias: null,
      liberadoEm: null,
      liberadoPorId: null,
      liberadoPorNome: null,
      observacaoLiberacao: null,
      atualizadoEm: Date.now(),
    }),
    { merge: true }
  );
  registrar(lote, mesAno, de, "em_revisao", "Reaberto", ator, motivo);
  await lote.commit();
}

/** Fechado -> faturado: libera o faturamento e o item de cada terceiro para a conferência dele. */
export async function liberarFaturamento({
  mesAno,
  ator,
  observacao,
  anexos,
}: {
  mesAno: string;
  ator: Ator;
  observacao?: string;
  /** Documentos complementares já enviados ao Storage. */
  anexos?: ArquivoFechamento[];
}) {
  const lote = writeBatch(db);
  (await itensDoMes(mesAno)).forEach((d) => lote.update(d.ref, { liberado: true }));
  (await parceirosDoMes(mesAno)).forEach((d) => lote.update(d.ref, { liberado: true }));
  lote.set(
    doc(db, "fechamentos", mesAno),
    limpar({
      status: "faturado",
      liberadoEm: Date.now(),
      liberadoPorId: ator.uid,
      liberadoPorNome: ator.nomeCompleto,
      observacaoLiberacao: observacao?.trim() || null,
      anexos: anexos ?? [],
      atualizadoEm: Date.now(),
    }),
    { merge: true }
  );
  registrar(lote, mesAno, "fechado", "faturado", "Faturamento liberado", ator, observacao);
  await lote.commit();
}

/** O responsável da parceira confirma que recebeu e leu o fechamento (passo antes de confirmar os valores). */
export async function registrarCiencia({ id, nome }: { id: string; nome: string }) {
  await updateDoc(doc(db, "fechamentoParceiros", id), { ciencia: { em: Date.now(), porNome: nome } });
}

/** O responsável da parceira confirma ou contesta (com motivo) os valores do fechamento da empresa dele. */
export async function responderConfirmacao({
  id,
  decisao,
  nome,
  motivo,
}: {
  id: string;
  decisao: "confirmado" | "contestado";
  nome: string;
  motivo?: string;
}) {
  await updateDoc(doc(db, "fechamentoParceiros", id), {
    confirmacao: limpar({ status: decisao, porNome: nome, em: Date.now(), motivo: motivo?.trim() || null }),
  });
}
