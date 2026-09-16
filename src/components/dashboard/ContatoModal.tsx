"use client";

import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import { useAuth } from "@/contexts/AuthContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { registrarContato } from "@/lib/contato";
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
      await registrarContato(projeto.id, texto.trim(), usuario);
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

      <div className="border-t border-brand-border-soft pt-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.08em] text-brand-faint">
          Histórico — {nomeExibicaoCliente(cliente)}
        </p>
        <div className="max-h-72 space-y-4 overflow-y-auto border-l-2 border-brand-border pl-4">
          {contatos.map((c) => (
            <div key={c.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full border-2 border-white bg-brand-accent" />
              <p className="text-[11.5px] font-semibold text-brand-faint">
                {formatarDataHora(c.criadoEm)} · {c.usuarioNome}
              </p>
              <p className="text-[13px] leading-relaxed text-brand-navy-2">{c.texto}</p>
            </div>
          ))}
          {!loading && contatos.length === 0 && (
            <p className="text-sm text-brand-faint">Nenhum contato registrado ainda.</p>
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
