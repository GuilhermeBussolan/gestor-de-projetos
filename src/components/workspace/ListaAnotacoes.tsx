"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { STATUS_ANOTACAO } from "@/lib/workspace";
import { ChipPrazo, ChipPrioridade, ICONE_STATUS } from "@/components/workspace/visual";
import type { Anotacao, PrioridadeAnotacao, StatusAnotacao } from "@/types";

type Contexto = { projeto: string | null; fase: string | null; atividade: string | null };
type Coluna = "titulo" | "status" | "prioridade" | "projeto" | "dataLimite";

const ORDEM_STATUS: Record<StatusAnotacao, number> = { a_fazer: 0, em_andamento: 1, concluido: 2, arquivado: 3 };
const ORDEM_PRIORIDADE: Record<PrioridadeAnotacao, number> = { alta: 0, normal: 1, baixa: 2 };

type EstadoOrdem = { coluna: Coluna; asc: boolean };

/** Título de coluna clicável: ordena por ela (clicar de novo inverte). */
function Cabecalho({
  coluna,
  ordem,
  onOrdenar,
  children,
}: {
  coluna: Coluna;
  ordem: EstadoOrdem;
  onOrdenar: (c: Coluna) => void;
  children: React.ReactNode;
}) {
  const ativa = ordem.coluna === coluna;
  const Icone = !ativa ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2.5">
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className={`flex items-center gap-1 uppercase ${ativa ? "text-brand-navy-2" : "hover:text-brand-navy-2"}`}
      >
        {children}
        <Icone size={11} className={ativa ? "" : "opacity-50"} />
      </button>
    </th>
  );
}

/** Visualização em lista: uma linha por anotação, colunas ordenáveis (clique no título da coluna). */
export function ListaAnotacoes({
  anotacoes,
  contextoDe,
  hojeIso,
  onAbrir,
}: {
  anotacoes: Anotacao[];
  contextoDe: (a: Anotacao) => Contexto;
  hojeIso: string;
  onAbrir: (a: Anotacao) => void;
}) {
  const [ordem, setOrdem] = useState<EstadoOrdem>({ coluna: "status", asc: true });
  const ordenar = (coluna: Coluna) => setOrdem((o) => ({ coluna, asc: o.coluna === coluna ? !o.asc : true }));

  const valor = (a: Anotacao, c: Coluna): string | number => {
    if (c === "titulo") return a.titulo.toLowerCase();
    if (c === "status") return ORDEM_STATUS[a.status];
    if (c === "prioridade") return ORDEM_PRIORIDADE[a.prioridade];
    if (c === "projeto") return (contextoDe(a).projeto ?? "￿").toLowerCase();
    return a.dataLimite ?? "9999-12-31";
  };
  const linhas = [...anotacoes].sort((x, y) => {
    const a = valor(x, ordem.coluna);
    const b = valor(y, ordem.coluna);
    const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR");
    return (ordem.asc ? r : -r) || x.ordem - y.ordem;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[10.5px] font-bold tracking-[.07em] whitespace-nowrap text-brand-faint">
              <Cabecalho ordem={ordem} onOrdenar={ordenar} coluna="titulo">Título</Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={ordenar} coluna="status">Status</Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={ordenar} coluna="prioridade">Prioridade</Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={ordenar} coluna="projeto">Projeto</Cabecalho>
              <Cabecalho ordem={ordem} onOrdenar={ordenar} coluna="dataLimite">Prazo</Cabecalho>
              <th className="px-3 py-2.5 uppercase">Tags</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((a) => {
              const ctx = contextoDe(a);
              const st = STATUS_ANOTACAO[a.status];
              const IconeStatus = ICONE_STATUS[a.status];
              return (
                <tr
                  key={a.id}
                  onClick={() => onAbrir(a)}
                  className="cursor-pointer border-t border-brand-border-soft hover:bg-brand-hover/60"
                >
                  <td className="max-w-[320px] px-3 py-2.5">
                    <p className={`truncate font-semibold ${a.status === "concluido" || a.status === "arquivado" ? "text-brand-muted" : "text-brand-navy-2"}`} title={a.titulo}>
                      {a.titulo}
                    </p>
                    {a.descricao && <p className="truncate text-[11.5px] text-brand-faint">{a.descricao}</p>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: st.bg, color: st.cor }}>
                      <IconeStatus size={11} />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <ChipPrioridade a={a} sempre />
                  </td>
                  <td className="max-w-[300px] px-3 py-2.5 text-brand-muted">
                    {ctx.projeto ? (
                      <span className="block truncate" title={[ctx.projeto, ctx.fase, ctx.atividade].filter(Boolean).join(" › ")}>
                        {ctx.projeto}
                      </span>
                    ) : (
                      <span className="text-brand-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{a.dataLimite ? <ChipPrazo a={a} hojeIso={hojeIso} /> : <span className="text-brand-faint">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(a.tags ?? []).map((t) => (
                        <span key={t} className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-accent">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-faint">
                  Nenhuma anotação com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
