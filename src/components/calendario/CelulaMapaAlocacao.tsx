"use client";

import { useState } from "react";
import { PERIODO_LABEL, type AlocacaoAtividade, type StatusCelulaMapa } from "@/lib/cronograma";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto } from "@/types";

const COR_CELULA: Record<StatusCelulaMapa, string> = {
  livre: "bg-white border-brand-border-soft",
  alocado: "bg-[#e8efff] border-[#c3d4f7]",
  sobreposicao: "bg-[#fdeceb] border-[#f3b8b0]",
};

function tituloProjeto(projetoId: string, projetos: Projeto[], clientes: Cliente[]): string {
  const projeto = projetos.find((p) => p.id === projetoId);
  if (!projeto) return "Projeto removido";
  return `${nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId))} — ${projeto.codigoProposta}`;
}

export function CelulaMapaAlocacao({
  status,
  alocacoes,
  projetos,
  clientes,
}: {
  status: StatusCelulaMapa;
  alocacoes: AlocacaoAtividade[];
  projetos: Projeto[];
  clientes: Cliente[];
}) {
  const [aberto, setAberto] = useState(false);

  if (status === "livre") {
    return (
      <div className={`h-full min-h-[54px] w-full rounded-md border ${COR_CELULA.livre}`} title="Livre" />
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex h-full min-h-[54px] w-full flex-col items-start justify-center gap-0.5 rounded-md border p-1.5 text-left ${COR_CELULA[status]}`}
      >
        {alocacoes.slice(0, 2).map((a) => (
          <span key={a.atividadeId} className="w-full truncate text-[10px] font-semibold text-brand-navy-2">
            {a.horaInicio} · {tituloProjeto(a.projetoId, projetos, clientes)}
          </span>
        ))}
        {alocacoes.length > 2 && (
          <span className="text-[10px] text-brand-muted">+{alocacoes.length - 2} mais</span>
        )}
        {status === "sobreposicao" && (
          <span className="rounded-full bg-[#b5392a] px-1.5 py-0.5 text-[9px] font-bold text-white">
            Sobreposição
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 space-y-2 rounded-xl border border-brand-border bg-white p-3 text-left shadow-card-lg">
          {status === "sobreposicao" && (
            <p className="rounded-md bg-[#fdeceb] px-2 py-1.5 text-[11px] font-semibold text-[#b5392a]">
              Sobreposição de agenda — mais de uma atividade no mesmo horário.
            </p>
          )}
          {alocacoes.map((a) => (
            <div key={a.atividadeId} className="border-t border-brand-border-soft pt-2 first:border-t-0 first:pt-0">
              <p className="text-[12px] font-bold text-brand-navy-2">{a.atividadeDescricao}</p>
              <p className="text-[11px] text-brand-muted">{tituloProjeto(a.projetoId, projetos, clientes)}</p>
              <p className="text-[11px] text-brand-muted">
                {a.horaInicio}–{a.horaFim} ({PERIODO_LABEL[a.periodo]}) · {a.horasPrevistas}h previstas
              </p>
              <p className="text-[10.5px] text-brand-faint">Grupo: {a.grupoDescricao}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
