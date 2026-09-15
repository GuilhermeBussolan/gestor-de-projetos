"use client";

import { useState } from "react";
import { addDoc, collection, doc, orderBy, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { useAuth } from "@/contexts/AuthContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, ContatoProjeto, Projeto } from "@/types";

function formatarDataHora(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ContatoForm({ projeto, cliente }: { projeto: Projeto; cliente: Cliente | undefined }) {
  const { usuario } = useAuth();
  const { data: contatos, loading } = useCollection<ContatoProjeto>(
    `projetos/${projeto.id}/contatos`,
    [orderBy("criadoEm", "desc")]
  );
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !texto.trim()) return;
    setSalvando(true);
    try {
      const criadoEm = Date.now();
      await addDoc(collection(db, "projetos", projeto.id, "contatos"), {
        texto: texto.trim(),
        usuarioId: usuario.uid,
        usuarioNome: usuario.nomeCompleto,
        criadoEm,
      });
      await updateDoc(doc(db, "projetos", projeto.id), {
        ultimoContato: { texto: texto.trim(), usuarioNome: usuario.nomeCompleto, criadoEm },
      });
      setTexto("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="space-y-3">
        <Textarea
          rows={3}
          placeholder="O que foi conversado com o cliente?"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={salvando || !texto.trim()}>
            {salvando ? "Registrando..." : "Registrar contato"}
          </Button>
        </div>
      </form>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Histórico — {nomeExibicaoCliente(cliente)}
        </p>
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {contatos.map((c) => (
            <div key={c.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">{c.texto}</p>
              <p className="mt-1 text-xs text-slate-400">
                {c.usuarioNome} · {formatarDataHora(c.criadoEm)}
              </p>
            </div>
          ))}
          {!loading && contatos.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum contato registrado ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContatoModal({
  projeto,
  cliente,
  onClose,
}: {
  projeto: Projeto | null;
  cliente: Cliente | undefined;
  onClose: () => void;
}) {
  return (
    <Modal open={!!projeto} onClose={onClose} title="Último contato">
      {projeto && <ContatoForm key={projeto.id} projeto={projeto} cliente={cliente} />}
    </Modal>
  );
}
