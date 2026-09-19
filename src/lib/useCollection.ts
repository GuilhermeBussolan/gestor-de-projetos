"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * `deps` são valores usados nos `constraints` (ex.: o recursoId do filtro) — quando
 * mudam, a escuta é refeita. Sem isso a consulta ficaria presa ao filtro do primeiro render.
 * `erro` fica true quando a leitura falha (ex.: regra do Firestore ainda não publicada).
 */
export function useCollection<T>(
  path: string,
  constraints: QueryConstraint[] = [orderBy("createdAt", "asc")],
  enabled = true,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setErro(false);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro lendo ${path}:`, err);
        setErro(true);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...deps]);

  return { data, loading, erro };
}
