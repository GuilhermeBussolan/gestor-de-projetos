"use client";

import { STATUS_ANOTACAO } from "@/lib/workspace";
import { ChipPrazo, ChipPrioridade, ICONE_STATUS } from "@/components/workspace/visual";
import { ThOrdenavel, useOrdenacao, type EstadoOrdenacao } from "@/components/ui/Ordenacao";
import type { Anotacao, PrioridadeAnotacao, StatusAnotacao } from "@/types";

type Contexto = { projeto: string | null; fase: string | null; atividade: string | null };
type Coluna = "titulo" | "status" | "prioridade" | "projeto" | "dataLimite";

const ORDEM_STATUS: Record<StatusAnotacao, number> = { a_fazer: 0, em_andamento: 1, concluido: 2, arquivado: 3 };
const ORDEM_PRIORIDADE: Record<PrioridadeAnotacao, number> = { alta: 0, normal: 1, baixa: 2 };

const ORDEM_INICIAL: EstadoOrdenacao<Coluna> = { chave: "status", asc: true };

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
  // Ordem "natural" (a do Kanban): desempate de qualquer coluna e o que volta no 3º clique.
  const porOrdem = [...anotacoes].sort((x, y) => x.ordem - y.ordem);
  const { ordenados: linhas, ordem, ordenar } = useOrdenacao(
    porOrdem,
    {
      titulo: (a: Anotacao) => a.titulo,
      status: (a: Anotacao) => ORDEM_STATUS[a.status],
      prioridade: (a: Anotacao) => ORDEM_PRIORIDADE[a.prioridade],
      // Sem projeto / sem prazo ficam sempre no fim.
      projeto: (a: Anotacao) => contextoDe(a).projeto,
      dataLimite: (a: Anotacao) => a.dataLimite,
    },
    ORDEM_INICIAL
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[10.5px] font-bold tracking-[.07em] whitespace-nowrap text-brand-faint">
              <ThOrdenavel chave="titulo" ordem={ordem} onOrdenar={ordenar} className="px-3 py-2.5 uppercase">
                Título
              </ThOrdenavel>
              <ThOrdenavel chave="status" ordem={ordem} onOrdenar={ordenar} className="px-3 py-2.5 uppercase">
                Status
              </ThOrdenavel>
              <ThOrdenavel chave="prioridade" ordem={ordem} onOrdenar={ordenar} className="px-3 py-2.5 uppercase">
                Prioridade
              </ThOrdenavel>
              <ThOrdenavel chave="projeto" ordem={ordem} onOrdenar={ordenar} className="px-3 py-2.5 uppercase">
                Projeto
              </ThOrdenavel>
              <ThOrdenavel chave="dataLimite" ordem={ordem} onOrdenar={ordenar} className="px-3 py-2.5 uppercase">
                Prazo
              </ThOrdenavel>
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
