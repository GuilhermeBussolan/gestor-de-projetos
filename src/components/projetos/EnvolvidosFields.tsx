"use client";

import { Input, Select } from "@/components/ui/Field";
import { VINCULOS_ENVOLVIDO, type EnvolvidoChave, type VinculoEnvolvido } from "@/types";

export function EnvolvidosFields({
  envolvidos,
  onChange,
}: {
  envolvidos: EnvolvidoChave[];
  onChange: (envolvidos: EnvolvidoChave[]) => void;
}) {
  function adicionar() {
    onChange([...envolvidos, { nome: "", cargo: "", vinculo: "", email: "", telefone: "" }]);
  }

  function remover(index: number) {
    onChange(envolvidos.filter((_, i) => i !== index));
  }

  function atualizar(index: number, campo: keyof EnvolvidoChave, valor: string) {
    onChange(envolvidos.map((e, i) => (i === index ? { ...e, [campo]: valor } : e)));
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-brand-navy-2">Principais envolvidos (key users, opcional)</p>
      <div className="space-y-2 rounded-md border border-brand-border p-3">
        {envolvidos.map((env, i) => (
          <div key={i} className="space-y-2 rounded-md border border-brand-border-soft bg-brand-hover/50 p-2.5">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Nome"
                  value={env.nome}
                  onChange={(e) => atualizar(i, "nome", e.target.value)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Cargo"
                  value={env.cargo ?? ""}
                  onChange={(e) => atualizar(i, "cargo", e.target.value)}
                />
              </div>
              <div className="w-36 shrink-0">
                <Select
                  aria-label="Vínculo do envolvido"
                  value={env.vinculo ?? ""}
                  onChange={(e) => atualizar(i, "vinculo", e.target.value as VinculoEnvolvido | "")}
                >
                  <option value="">Vínculo...</option>
                  {VINCULOS_ENVOLVIDO.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                onClick={() => remover(i)}
                className="shrink-0 text-brand-faint hover:text-red-600"
                aria-label="Remover envolvido"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  type="email"
                  placeholder="E-mail"
                  value={env.email ?? ""}
                  onChange={(e) => atualizar(i, "email", e.target.value)}
                />
              </div>
              <div className="w-40 shrink-0">
                <Input
                  placeholder="Celular"
                  value={env.telefone ?? ""}
                  onChange={(e) => atualizar(i, "telefone", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={adicionar}
          className="text-sm font-medium text-brand-accent hover:underline"
        >
          + Adicionar envolvido
        </button>
        {envolvidos.length === 0 && (
          <p className="text-xs text-brand-faint">Nenhum envolvido adicionado ainda.</p>
        )}
      </div>
    </div>
  );
}
