import { doc, updateDoc } from "firebase/firestore";
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
