import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ContatoProjeto, Mencionado, TipoRegistro, Usuario } from "@/types";

export interface OpcoesRegistro {
  tipo?: TipoRegistro;
  mencionados?: Mencionado[];
  /** "Cliente — proposta", mostrado na notificação de quem foi marcado. */
  projetoNome?: string;
}

function trecho(texto: string) {
  return texto.length > 160 ? `${texto.slice(0, 157)}...` : texto;
}

/**
 * Registra uma entrada no histórico de contato de um projeto (subcoleção
 * projetos/{id}/contatos) e atualiza o resumo denormalizado ultimoContato.
 * Usado tanto pelo modal de contato do Dashboard quanto pela confirmação de
 * ocorrências recorrentes no Calendário — as duas telas compartilham o mesmo
 * histórico, então uma atualiza a outra.
 *
 * Quem for marcado (@) recebe uma notificação. Tudo é gravado num único lote:
 * o registro e os avisos entram juntos ou não entram.
 */
export async function registrarContato(
  projetoId: string,
  texto: string,
  usuario: Usuario,
  opcoes: OpcoesRegistro = {}
) {
  const criadoEm = Date.now();
  const tipo = opcoes.tipo ?? "atualizacao";
  const mencionados = (opcoes.mencionados ?? []).filter((m) => m.uid !== usuario.uid);

  const contatoRef = doc(collection(db, "projetos", projetoId, "contatos"));
  const lote = writeBatch(db);
  lote.set(contatoRef, {
    texto,
    usuarioId: usuario.uid,
    usuarioNome: usuario.nomeCompleto,
    criadoEm,
    tipo,
    mencionados,
  });
  lote.update(doc(db, "projetos", projetoId), {
    ultimoContato: { texto, usuarioNome: usuario.nomeCompleto, criadoEm },
  });
  for (const m of mencionados) {
    lote.set(doc(collection(db, "notificacoes")), {
      destinatarioUid: m.uid,
      projetoId,
      projetoNome: opcoes.projetoNome ?? "",
      contatoId: contatoRef.id,
      autorUid: usuario.uid,
      autorNome: usuario.nomeCompleto,
      tipo,
      texto: trecho(texto),
      criadoEm,
      lida: false,
    });
  }
  await lote.commit();
}

/**
 * Quem foi marcado confirma que leu. Vira uma nova entrada na linha do tempo
 * (com nome e horário) e avisa quem fez a marcação.
 */
export async function darCiencia(
  projetoId: string,
  projetoNome: string,
  registro: ContatoProjeto,
  usuario: Usuario
) {
  const criadoEm = Date.now();
  const contatoRef = doc(collection(db, "projetos", projetoId, "contatos"));
  const lote = writeBatch(db);
  lote.set(contatoRef, {
    texto: `Deu ciência do registro de ${registro.usuarioNome}.`,
    usuarioId: usuario.uid,
    usuarioNome: usuario.nomeCompleto,
    criadoEm,
    tipo: "ciencia" satisfies TipoRegistro,
    mencionados: [{ uid: registro.usuarioId, nome: registro.usuarioNome }],
    respondeAId: registro.id,
  });
  if (registro.usuarioId !== usuario.uid) {
    lote.set(doc(collection(db, "notificacoes")), {
      destinatarioUid: registro.usuarioId,
      projetoId,
      projetoNome,
      contatoId: contatoRef.id,
      autorUid: usuario.uid,
      autorNome: usuario.nomeCompleto,
      tipo: "ciencia" satisfies TipoRegistro,
      texto: trecho(registro.texto),
      criadoEm,
      lida: false,
    });
  }
  await lote.commit();
}
