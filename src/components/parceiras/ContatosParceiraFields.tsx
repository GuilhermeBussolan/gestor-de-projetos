"use client";

import { Input } from "@/components/ui/Field";
import type { ContatoParceira } from "@/types";

const MAX_CONTATOS = 2;

export function ContatosParceiraFields({
  contatos,
  onChange,
}: {
  contatos: ContatoParceira[];
  onChange: (contatos: ContatoParceira[]) => void;
}) {
  function adicionar() {
    if (contatos.length >= MAX_CONTATOS) return;
    onChange([...contatos, { nome: "", email: "", telefone: "" }]);
  }

  function remover(index: number) {
    onChange(contatos.filter((_, i) => i !== index));
  }

  function atualizar(index: number, campo: keyof ContatoParceira, valor: string) {
    onChange(contatos.map((c, i) => (i === index ? { ...c, [campo]: valor } : c)));
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-brand-navy-2">
        Dados de contato (até {MAX_CONTATOS} contatos, opcional)
      </p>
      <div className="space-y-3 rounded-md border border-brand-border p-3">
        {contatos.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-semibold text-brand-faint">Contato {i + 1}</span>
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Nome"
                value={c.nome}
                onChange={(e) => atualizar(i, "nome", e.target.value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                type="email"
                placeholder="E-mail"
                value={c.email ?? ""}
                onChange={(e) => atualizar(i, "email", e.target.value)}
              />
            </div>
            <div className="w-40 shrink-0">
              <Input
                placeholder="Telefone"
                value={c.telefone ?? ""}
                onChange={(e) => atualizar(i, "telefone", e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => remover(i)}
              className="shrink-0 text-brand-faint hover:text-red-600"
              aria-label="Remover contato"
            >
              ✕
            </button>
          </div>
        ))}
        {contatos.length < MAX_CONTATOS && (
          <button
            type="button"
            onClick={adicionar}
            className="text-sm font-medium text-brand-accent hover:underline"
          >
            + Adicionar contato
          </button>
        )}
        {contatos.length === 0 && (
          <p className="text-xs text-brand-faint">Nenhum contato adicionado ainda.</p>
        )}
      </div>
    </div>
  );
}
