"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/Field";
import { detectarToken, filtrarPessoas, inserirMencao, mencionadosPresentes } from "@/lib/mencoes";
import type { Mencionado, PessoaDiretorio, Perfil } from "@/types";

const PERFIL_LABEL: Record<Perfil, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
  financeiro: "Financeiro",
};

/** Caixa de texto que abre uma lista de pessoas ao digitar "@". */
export function CampoMencao({
  value,
  onChange,
  pessoas,
  erroLista = false,
  mencionados,
  onMencionadosChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (valor: string) => void;
  pessoas: PessoaDiretorio[];
  /** A lista de pessoas não pôde ser lida (ex.: regras do Firestore não publicadas). */
  erroLista?: boolean;
  mencionados: Mencionado[];
  onMencionadosChange: (lista: Mencionado[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [ativo, setAtivo] = useState(0);
  const [oculto, setOculto] = useState(false);

  const token = oculto ? null : detectarToken(value, cursor);
  const opcoes = token ? filtrarPessoas(pessoas, token.termo).slice(0, 6) : [];
  const indiceAtivo = Math.min(ativo, Math.max(opcoes.length - 1, 0));
  const avisados = mencionadosPresentes(value, mencionados);

  function escolher(p: PessoaDiretorio) {
    if (!token) return;
    const novo = inserirMencao(value, token, cursor, p.nomeCompleto);
    onChange(novo.texto);
    onMencionadosChange([
      ...mencionados.filter((m) => m.uid !== p.id),
      { uid: p.id, nome: p.nomeCompleto },
    ]);
    setCursor(novo.cursor);
    setAtivo(0);
    setOculto(true); // fecha a lista já; volta a abrir na próxima digitação
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(novo.cursor, novo.cursor);
    });
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!token) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOculto(true);
      return;
    }
    if (opcoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((indiceAtivo + 1) % opcoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((indiceAtivo - 1 + opcoes.length) % opcoes.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      escolher(opcoes[indiceAtivo]);
    }
  }

  return (
    <div>
      <div className="relative">
        <Textarea
          ref={ref}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCursor(e.target.selectionStart);
            setAtivo(0);
            setOculto(false);
          }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
          onKeyDown={aoTeclar}
        />
        {token && (
          <div className="absolute top-full left-0 z-30 mt-1 w-72 overflow-hidden rounded-xl border border-brand-border bg-white shadow-card-lg">
            {opcoes.length > 0 ? (
              opcoes.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(p);
                  }}
                  onMouseEnter={() => setAtivo(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] ${
                    i === indiceAtivo ? "bg-brand-accent-soft" : ""
                  }`}
                >
                  <span className="truncate font-semibold text-brand-navy-2">{p.nomeCompleto}</span>
                  <span className="shrink-0 text-[10.5px] font-bold text-brand-faint">
                    {PERFIL_LABEL[p.perfil]}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-[12.5px] text-brand-faint">
                {pessoas.length > 0
                  ? "Nenhuma pessoa encontrada."
                  : erroLista
                    ? "Não foi possível carregar a lista de pessoas. Confirme se as regras do Firestore foram publicadas e recarregue a página."
                    : "Ninguém para marcar neste projeto."}
              </p>
            )}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] text-brand-faint">
        {avisados.length > 0 ? (
          <>
            Será avisado(a):{" "}
            <strong className="text-brand-accent">{avisados.map((m) => m.nome).join(", ")}</strong>
          </>
        ) : (
          "Digite @ para marcar alguém do projeto ou um administrador."
        )}
      </p>
    </div>
  );
}
