import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Projeto, Termometro, Usuario } from "@/types";

export function termometroEfetivo(projeto: Pick<Projeto, "termometro">): Termometro {
  return projeto.termometro ?? "normal";
}

export async function alterarTermometro(
  projeto: Projeto,
  novoStatus: Termometro,
  observacao: string,
  usuario: Usuario
) {
  const texto = observacao.trim();
  if (!texto) throw new Error("Descreva o motivo dessa alteração.");
  await updateDoc(doc(db, "projetos", projeto.id), {
    termometro: novoStatus,
    termometroObservacao: {
      texto,
      usuarioNome: usuario.nomeCompleto,
      criadoEm: Date.now(),
    },
  });
}
