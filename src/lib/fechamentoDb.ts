import { collection, doc, updateDoc, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { idItemFechamento, type ItemBase, type ParceiroBase } from "@/lib/fechamento";
import type { ArquivoFechamento, FechamentoParceiro, StatusFechamento } from "@/types";

export interface Ator {
  uid: string;
  nomeCompleto: string;
}

const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Auditoria: cada mudança de etapa de uma parceira (o histórico fica no mês, com o nome da parceira). */
function registrar(
  lote: WriteBatch,
  mesAno: string,
  parceiraNome: string,
  de: StatusFechamento | null,
  para: StatusFechamento,
  acao: string,
  ator: Ator,
  motivo?: string
) {
  lote.set(
    doc(collection(db, "fechamentos", mesAno, "historico")),
    limpar({ de, para, acao, parceiraNome, usuarioId: ator.uid, usuarioNome: ator.nomeCompleto, em: Date.now(), motivo: motivo?.trim() || null })
  );
}

const CIENCIA_VAZIA = { em: null };
const CONFIRMACAO_PENDENTE = { status: "pendente" };

/** Ids dos itens (um por consultor) que já estão gravados para a parceira. */
const idsDosItens = (mesAno: string, f: FechamentoParceiro | null | undefined) => (f?.recursos ?? []).map((r) => idItemFechamento(mesAno, r.recursoId));

/**
 * Rascunho/em revisão -> em revisão, SÓ desta parceira: congela o que cada consultor dela tem a receber e o total da
 * parceira. Serve também para "atualizar" a revisão com as horas atuais.
 */
export async function enviarParceiraParaRevisao({
  mesAno,
  atual,
  parceiro,
  itens,
  ator,
  motivo,
}: {
  mesAno: string;
  /** O que já está gravado da parceira (ou null se ainda é rascunho). */
  atual: FechamentoParceiro | null;
  parceiro: ParceiroBase;
  itens: ItemBase[];
  ator: Ator;
  motivo?: string;
}) {
  const lote = writeBatch(db);
  idsDosItens(mesAno, atual).forEach((id) => lote.delete(doc(db, "fechamentoItens", id)));
  for (const item of itens) {
    // A conferência é da parceira (grupo), não de cada consultor: o item só guarda o detalhe.
    lote.set(doc(db, "fechamentoItens", item.id), limpar({ ...item, liberado: false, confirmacao: { status: "nao_aplicavel" } }));
  }
  const de: StatusFechamento | null = atual ? (atual.etapa ?? "em_revisao") : null;
  lote.set(
    doc(db, "fechamentoParceiros", parceiro.id),
    limpar({
      ...parceiro,
      etapa: "em_revisao",
      liberado: false,
      ciencia: CIENCIA_VAZIA,
      confirmacao: CONFIRMACAO_PENDENTE,
      fechadoEm: null,
      fechadoPorNome: null,
      justificativaDivergencias: null,
      liberadoEm: null,
      liberadoPorNome: null,
      observacaoLiberacao: null,
      anexos: [],
    })
  );
  registrar(lote, mesAno, parceiro.parceiraNome, de, "em_revisao", atual ? "Valores atualizados com as horas atuais" : "Enviado para revisão", ator, motivo);
  await lote.commit();
}

/** Em revisão -> rascunho (só desta parceira): descarta os valores congelados; volta a calcular ao vivo. */
export async function voltarParceiraParaRascunho({ mesAno, atual, ator, motivo }: { mesAno: string; atual: FechamentoParceiro; ator: Ator; motivo: string }) {
  const lote = writeBatch(db);
  idsDosItens(mesAno, atual).forEach((id) => lote.delete(doc(db, "fechamentoItens", id)));
  lote.delete(doc(db, "fechamentoParceiros", atual.id));
  registrar(lote, mesAno, atual.parceiraNome, "em_revisao", "rascunho", "Voltou para rascunho", ator, motivo);
  await lote.commit();
}

/** Em revisão -> fechado (só desta parceira). `justificativa` é obrigatória quando há divergências bloqueantes dela. */
export async function fecharParceira({ mesAno, atual, ator, justificativa }: { mesAno: string; atual: FechamentoParceiro; ator: Ator; justificativa?: string }) {
  const lote = writeBatch(db);
  lote.update(
    doc(db, "fechamentoParceiros", atual.id),
    limpar({
      etapa: "fechado",
      fechadoEm: Date.now(),
      fechadoPorNome: ator.nomeCompleto,
      justificativaDivergencias: justificativa?.trim() || null,
    })
  );
  registrar(lote, mesAno, atual.parceiraNome, "em_revisao", "fechado", justificativa?.trim() ? "Fechado com divergências justificadas" : "Fechado", ator, justificativa);
  await lote.commit();
}

/** Fechado/faturado -> em revisão (erro detectado), só desta parceira. A ciência e a confirmação dela recomeçam. */
export async function reabrirParceira({
  mesAno,
  atual,
  de,
  ator,
  motivo,
}: {
  mesAno: string;
  atual: FechamentoParceiro;
  de: StatusFechamento;
  ator: Ator;
  motivo: string;
}) {
  const lote = writeBatch(db);
  idsDosItens(mesAno, atual).forEach((id) => lote.set(doc(db, "fechamentoItens", id), { liberado: false }, { merge: true }));
  lote.update(
    doc(db, "fechamentoParceiros", atual.id),
    limpar({
      etapa: "em_revisao",
      liberado: false,
      ciencia: CIENCIA_VAZIA,
      confirmacao: CONFIRMACAO_PENDENTE,
      fechadoEm: null,
      fechadoPorNome: null,
      justificativaDivergencias: null,
      liberadoEm: null,
      liberadoPorNome: null,
      observacaoLiberacao: null,
    })
  );
  registrar(lote, mesAno, atual.parceiraNome, de, "em_revisao", "Reaberto", ator, motivo);
  await lote.commit();
}

/** Fechado -> faturado (só desta parceira): libera o faturamento para o responsável da parceira conferir. */
export async function liberarParceira({
  mesAno,
  atual,
  ator,
  observacao,
  anexos,
}: {
  mesAno: string;
  atual: FechamentoParceiro;
  ator: Ator;
  observacao?: string;
  /** Documentos complementares já enviados. */
  anexos?: ArquivoFechamento[];
}) {
  const lote = writeBatch(db);
  idsDosItens(mesAno, atual).forEach((id) => lote.set(doc(db, "fechamentoItens", id), { liberado: true }, { merge: true }));
  lote.update(
    doc(db, "fechamentoParceiros", atual.id),
    limpar({
      etapa: "faturado",
      liberado: true,
      liberadoEm: Date.now(),
      liberadoPorNome: ator.nomeCompleto,
      observacaoLiberacao: observacao?.trim() || null,
      anexos: anexos ?? [],
    })
  );
  registrar(lote, mesAno, atual.parceiraNome, "fechado", "faturado", "Faturamento liberado", ator, observacao);
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
