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
 */
export function useCollection<T>(
  path: string,
  constraints: QueryConstraint[] = [orderBy("createdAt", "asc")],
  enabled = true,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (err) => {
        console.error(`Erro lendo ${path}:`, err);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, ...deps]);

  return { data, loading };
}
