import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Projeto, StatusParcela } from "@/types";

export async function alterarStatusParcela(projeto: Projeto, numero: number, status: StatusParcela) {
  const parcelas = projeto.financeiro.parcelas.map((p) =>
    p.numero === numero
      ? { ...p, status, ...(status === "LIBERADO" ? { dataLiberacao: Date.now() } : {}) }
      : p
  );
  await updateDoc(doc(db, "projetos", projeto.id), {
    financeiro: { ...projeto.financeiro, parcelas },
  });
}
