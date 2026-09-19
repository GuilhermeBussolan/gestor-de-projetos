"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ContatoModal } from "@/components/dashboard/ContatoModal";
import type { Cliente, Projeto } from "@/types";

/**
 * Abre a linha do tempo de um projeto a partir só do id — usado pelas
 * notificações, que podem ser clicadas em qualquer tela.
 */
export function LinhaDoTempoProjeto({
  projetoId,
  onClose,
}: {
  projetoId: string | null;
  onClose: () => void;
}) {
  const [dados, setDados] = useState<{ projeto: Projeto; cliente?: Cliente } | null>(null);

  useEffect(() => {
    if (!projetoId) return;
    let ativo = true;
    (async () => {
      const ps = await getDoc(doc(db, "projetos", projetoId));
      if (!ps.exists() || !ativo) return;
      const projeto = { id: ps.id, ...ps.data() } as Projeto;
      const cs = await getDoc(doc(db, "clientes", projeto.clienteId));
      if (!ativo) return;
      setDados({ projeto, cliente: cs.exists() ? ({ id: cs.id, ...cs.data() } as Cliente) : undefined });
    })().catch((err) => console.error("Erro ao abrir a linha do tempo:", err));
    return () => {
      ativo = false;
    };
  }, [projetoId]);

  const pronto = projetoId && dados?.projeto.id === projetoId ? dados : null;
  return <ContatoModal projeto={pronto?.projeto ?? null} cliente={pronto?.cliente} onClose={onClose} />;
}
