import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Usuario } from "@/types";

/**
 * Registra uma entrada no histórico de contato de um projeto (subcoleção
 * projetos/{id}/contatos) e atualiza o resumo denormalizado ultimoContato.
 * Usado tanto pelo modal de contato do Dashboard quanto pela confirmação de
 * ocorrências recorrentes no Calendário — as duas telas compartilham o mesmo
 * histórico, então uma atualiza a outra.
 */
export async function registrarContato(projetoId: string, texto: string, usuario: Usuario) {
  const criadoEm = Date.now();
  await addDoc(collection(db, "projetos", projetoId, "contatos"), {
    texto,
    usuarioId: usuario.uid,
    usuarioNome: usuario.nomeCompleto,
    criadoEm,
  });
  await updateDoc(doc(db, "projetos", projetoId), {
    ultimoContato: { texto, usuarioNome: usuario.nomeCompleto, criadoEm },
  });
}
