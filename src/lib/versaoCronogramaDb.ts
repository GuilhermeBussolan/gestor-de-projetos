import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { compararVersoes, totalMinutosFolhas } from "@/lib/versaoCronograma";
import { idsFolhas } from "@/lib/escopo";
import type { EscopoAtividade, MudancaCronograma, ResumoVersaoCronograma, VersaoCronograma } from "@/types";

const limpar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Grava uma nova versão do cronograma de um projeto existente: a foto completa na subcoleção
 * "versoesCronograma" + o escopo/versão atual no projeto, tudo num lote. Na primeira versão de um
 * projeto que já tinha escopo, o escopo anterior vira a versão 1 ("escopo inicial").
 * Devolve o número da versão gravada.
 */
export async function gravarNovaVersaoCronograma({
  projetoId,
  escopoAnterior,
  versoes,
  atividades,
  arquivoNome,
  observacao,
  usuario,
  comparacao,
}: {
  projetoId: string;
  escopoAnterior: EscopoAtividade[];
  versoes: Pick<VersaoCronograma, "numero">[];
  atividades: EscopoAtividade[];
  arquivoNome: string;
  observacao: string;
  usuario: { uid: string; nomeCompleto: string };
  comparacao: { resumo: ResumoVersaoCronograma; mudancas: MudancaCronograma[] };
}): Promise<number> {
  const col = collection(db, "projetos", projetoId, "versoesCronograma");
  const batch = writeBatch(db);
  const autor = { usuarioId: usuario.uid, usuarioNome: usuario.nomeCompleto };
  const atividadesSemUndefined = limpar(atividades);
  let numero = versoes.length > 0 ? versoes[versoes.length - 1].numero : 0;

  if (versoes.length === 0 && escopoAnterior.length > 0) {
    numero += 1;
    batch.set(
      doc(col),
      limpar({
        numero,
        criadoEm: Date.now() - 1,
        ...autor,
        origem: "escopo_inicial",
        arquivoNome: "",
        observacao: "Escopo do projeto antes da primeira importação de cronograma.",
        atividades: escopoAnterior,
        totalMinutos: totalMinutosFolhas(escopoAnterior),
        totalTarefas: idsFolhas(escopoAnterior).size,
        resumo: compararVersoes([], escopoAnterior).resumo,
        mudancas: [],
        horasSemVinculo: 0,
      })
    );
  }
  numero += 1;
  batch.set(
    doc(col),
    limpar({
      numero,
      criadoEm: Date.now(),
      ...autor,
      origem: "importacao",
      arquivoNome,
      observacao: observacao.trim(),
      atividades: atividadesSemUndefined,
      totalMinutos: totalMinutosFolhas(atividadesSemUndefined),
      totalTarefas: idsFolhas(atividadesSemUndefined).size,
      resumo: comparacao.resumo,
      mudancas: comparacao.mudancas.slice(0, 400),
      horasSemVinculo: 0,
    })
  );
  batch.update(doc(db, "projetos", projetoId), {
    escopoId: null,
    escopoNome: null,
    escopoAtividades: atividadesSemUndefined,
    escopoExclusoes: null,
    cronogramaVersao: numero,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return numero;
}

/** Versão 1 de um projeto recém-criado a partir de um cronograma importado no cadastro. */
export async function gravarVersaoInicialCronograma({
  projetoId,
  atividades,
  arquivoNome,
  observacao,
  usuario,
}: {
  projetoId: string;
  atividades: EscopoAtividade[];
  arquivoNome: string;
  observacao: string;
  usuario: { uid: string; nomeCompleto: string };
}): Promise<void> {
  const batch = writeBatch(db);
  const semUndefined = limpar(atividades);
  const comparacao = compararVersoes([], semUndefined);
  batch.set(
    doc(collection(db, "projetos", projetoId, "versoesCronograma")),
    limpar({
      numero: 1,
      criadoEm: Date.now(),
      usuarioId: usuario.uid,
      usuarioNome: usuario.nomeCompleto,
      origem: "importacao",
      arquivoNome,
      observacao: observacao.trim(),
      atividades: semUndefined,
      totalMinutos: totalMinutosFolhas(semUndefined),
      totalTarefas: idsFolhas(semUndefined).size,
      resumo: comparacao.resumo,
      mudancas: [],
      horasSemVinculo: 0,
    })
  );
  await batch.commit();
}
