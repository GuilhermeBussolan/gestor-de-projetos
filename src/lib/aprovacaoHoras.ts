import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Usuario } from "@/types";

export async function aprovarHora(eventoId: string, usuario: Usuario) {
  const aprovadoEm = Date.now();
  await updateDoc(doc(db, "eventosCalendario", eventoId), {
    status: "aprovado",
    motivoRejeicao: null,
    aprovadoPorNome: usuario.nomeCompleto,
    aprovadoEm,
  });
}

export async function rejeitarHora(eventoId: string, motivo: string, usuario: Usuario) {
  const aprovadoEm = Date.now();
  await updateDoc(doc(db, "eventosCalendario", eventoId), {
    status: "rejeitado",
    motivoRejeicao: motivo,
    aprovadoPorNome: usuario.nomeCompleto,
    aprovadoEm,
  });
}

export async function confirmarRealizado(eventoId: string) {
  await updateDoc(doc(db, "eventosCalendario", eventoId), { status: "aguardando_aprovacao" });
}

/** Confirma vários realizados de uma vez (lotes de até 400 escritas). */
export async function confirmarRealizadosEmLote(eventoIds: string[]) {
  for (let i = 0; i < eventoIds.length; i += 400) {
    const batch = writeBatch(db);
    eventoIds.slice(i, i + 400).forEach((id) => {
      batch.update(doc(db, "eventosCalendario", id), { status: "aguardando_aprovacao" });
    });
    await batch.commit();
  }
}
