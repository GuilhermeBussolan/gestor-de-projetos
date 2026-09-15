"use client";

import { useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import {
  STATUS_PARCELA_CONFIG,
  STATUS_PARCELA_ORDEM,
  TIPO_FATURAMENTO_CONFIG,
  TIPO_RECURSO_CONFIG,
} from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Apontamento, Cliente, Projeto, Recurso, StatusParcela, TipoRecurso } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: apontamentos } = useCollection<Apontamento>("apontamentos", []);

  const resumoGeral = useMemo(() => {
    let totalContratado = 0;
    let totalRecebido = 0;
    let totalAReceber = 0;
    for (const p of projetos) {
      totalContratado += p.financeiro?.valorTotal ?? 0;
      for (const parc of p.financeiro?.parcelas ?? []) {
        if (parc.status === "RECEBIDO") totalRecebido += parc.valor;
        else totalAReceber += parc.valor;
      }
    }
    return { totalContratado, totalRecebido, totalAReceber };
  }, [projetos]);

  const pagoPorTipoRecurso = useMemo(() => {
    const totais: Record<TipoRecurso, number> = {
      coordenador: 0,
      consultor_funcional: 0,
      consultor_tecnico: 0,
    };
    for (const a of apontamentos) {
      const recurso = recursos.find((r) => r.id === a.recursoId);
      if (!recurso) continue;
      totais[recurso.tipo] += a.totalHoras * recurso.valorHora;
    }
    return totais;
  }, [apontamentos, recursos]);

  const totalPagoRecursos = Object.values(pagoPorTipoRecurso).reduce((a, b) => a + b, 0);

  async function alterarStatusParcela(projeto: Projeto, numero: number, status: StatusParcela) {
    const parcelas = projeto.financeiro.parcelas.map((p) =>
      p.numero === numero ? { ...p, status } : p
    );
    await updateDoc(doc(db, "projetos", projeto.id), {
      financeiro: { ...projeto.financeiro, parcelas },
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Financeiro</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Total contratado</p>
          <p className="text-xl font-semibold text-slate-900">{moeda(resumoGeral.totalContratado)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Total recebido</p>
          <p className="text-xl font-semibold text-green-600">{moeda(resumoGeral.totalRecebido)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-400">Total a receber</p>
          <p className="text-xl font-semibold text-amber-600">{moeda(resumoGeral.totalAReceber)}</p>
        </div>
      </div>

      <div className="mb-10 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
          Recebido x pago aos recursos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Total recebido</p>
            <p className="text-lg font-semibold text-green-600">{moeda(resumoGeral.totalRecebido)}</p>
          </div>
          {(Object.keys(pagoPorTipoRecurso) as TipoRecurso[]).map((tipo) => (
            <div key={tipo}>
              <p className="text-xs text-slate-400">Pago — {TIPO_RECURSO_CONFIG[tipo].label}</p>
              <p className="text-lg font-semibold text-slate-800">{moeda(pagoPorTipoRecurso[tipo])}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Total pago aos recursos: <strong>{moeda(totalPagoRecursos)}</strong> · Saldo:{" "}
          <strong>{moeda(resumoGeral.totalRecebido - totalPagoRecursos)}</strong>
        </p>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-slate-900">Parcelas por projeto</h2>
      <div className="space-y-4">
        {projetos.map((p) => {
          const cliente = clientes.find((c) => c.id === p.clienteId);
          return (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{nomeExibicaoCliente(cliente)}</p>
                  <p className="text-xs text-slate-400">
                    {TIPO_FATURAMENTO_CONFIG[p.financeiro?.tipoFaturamento ?? "parcelado"].label}
                  </p>
                </div>
                {p.financeiro?.tipoFaturamento !== "apontamento_horas" && (
                  <p className="text-sm text-slate-500">
                    {moeda(p.financeiro?.valorTotal ?? 0)} em {p.financeiro?.numeroParcelas ?? 0}x
                  </p>
                )}
              </div>
              {p.financeiro?.tipoFaturamento === "apontamento_horas" ? (
                <p className="text-sm text-slate-400">
                  Faturamento por apontamento de horas — sem parcelas fixas.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {(p.financeiro?.parcelas ?? []).map((parc) => (
                    <div
                      key={parc.numero}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-500">
                        {parc.descricao ? parc.descricao : `#${parc.numero}`}
                      </span>
                      <span className="font-medium">{moeda(parc.valor)}</span>
                      <select
                        value={parc.status}
                        onChange={(e) =>
                          alterarStatusParcela(p, parc.numero, e.target.value as StatusParcela)
                        }
                        style={{ backgroundColor: STATUS_PARCELA_CONFIG[parc.status].color }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900"
                      >
                        {STATUS_PARCELA_ORDEM.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_PARCELA_CONFIG[s].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {(p.financeiro?.parcelas ?? []).length === 0 && (
                    <p className="text-sm text-slate-400">Nenhuma parcela cadastrada.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {projetos.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
            Nenhum projeto cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}

export default function FinanceiroPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <FinanceiroPageContent />
    </ProtectedPage>
  );
}
