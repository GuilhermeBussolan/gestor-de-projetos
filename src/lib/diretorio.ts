import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Usuario } from "@/types";

/**
 * "usuarios" só pode ser listado por administradores; "diretorio" é um espelho
 * enxuto (nome, perfil, recurso) que todos leem, usado na lista de @ da linha do
 * tempo. Cada pessoa mantém a própria entrada ao entrar; o administrador,
 * ao entrar (ou mexer em Usuários), sincroniza a de todos.
 */
export async function sincronizarDiretorio(usuario: Usuario) {
  await setDoc(
    doc(db, "diretorio", usuario.uid),
    { nomeCompleto: usuario.nomeCompleto, perfil: usuario.perfil, recursoId: usuario.recursoId ?? null },
    { merge: true }
  );
  if (usuario.perfil !== "administrador") return;

  const [usuarios, diretorio] = await Promise.all([
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "diretorio")),
  ]);
  const atual = new Map(diretorio.docs.map((d) => [d.id, d.data()]));
  const lote = writeBatch(db);
  let alteracoes = 0;

  for (const d of usuarios.docs) {
    const u = d.data();
    const novo = { nomeCompleto: u.nomeCompleto, perfil: u.perfil, recursoId: u.recursoId ?? null };
    const a = atual.get(d.id);
    if (
      !a ||
      a.nomeCompleto !== novo.nomeCompleto ||
      a.perfil !== novo.perfil ||
      (a.recursoId ?? null) !== novo.recursoId
    ) {
      lote.set(doc(db, "diretorio", d.id), novo);
      alteracoes++;
    }
  }
  const idsUsuarios = new Set(usuarios.docs.map((d) => d.id));
  for (const id of atual.keys()) {
    if (!idsUsuarios.has(id)) {
      lote.delete(doc(db, "diretorio", id));
      alteracoes++;
    }
  }
  if (alteracoes > 0) await lote.commit();
}
