import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function marcarNotificacaoLida(id: string) {
  await updateDoc(doc(db, "notificacoes", id), { lida: true });
}

export async function marcarTodasLidas(ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const lote = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => lote.update(doc(db, "notificacoes", id), { lida: true }));
    await lote.commit();
  }
}
