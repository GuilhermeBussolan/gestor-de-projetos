"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Acompanha em tempo real alguns documentos pelo id (quando a regra do Firestore libera a leitura documento a
 * documento, mas não uma consulta na coleção). Documento inexistente ou sem permissão simplesmente não aparece.
 */
export function useDocumentos<T extends { id: string }>(colecao: string, ids: string[]): T[] {
  const chave = [...new Set(ids)].sort().join("|");
  const [porId, setPorId] = useState<Record<string, T>>({});

  useEffect(() => {
    const lista = chave ? chave.split("|") : [];
    const cancelar = lista.map((id) =>
      onSnapshot(
        doc(db, colecao, id),
        (snap) =>
          setPorId((atual) => {
            const novo = { ...atual };
            if (snap.exists()) novo[id] = { ...(snap.data() as Omit<T, "id">), id } as T;
            else delete novo[id];
            return novo;
          }),
        () =>
          setPorId((atual) => {
            const novo = { ...atual };
            delete novo[id];
            return novo;
          })
      )
    );
    return () => cancelar.forEach((c) => c());
  }, [colecao, chave]);

  const ativos = new Set(chave ? chave.split("|") : []);
  return Object.values(porId).filter((d) => ativos.has(d.id));
}
