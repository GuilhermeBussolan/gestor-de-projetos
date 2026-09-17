"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import {
  STATUS_PARCELA_CONFIG,
  STATUS_PARCELA_ORDEM,
  TIPO_FATURAMENTO_CONFIG,
  TIPO_RECURSO_CONFIG,
} from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { alterarStatusParcela } from "@/lib/parcela";
import { statusEfetivo } from "@/lib/statusHora";
import type { Cliente, EventoCalendario, Projeto, Recurso, StatusParcela, TipoRecurso } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);

  const resumoGeral = useMemo(() => {
    let totalContratado = 0;
    let totalRecebido = 0;
    let totalAReceber = 0;
    for (const p of projetos) {
      totalContratado += p.financeiro?.valorTotal ?? 0;
      for (const parc of p.financeiro?.parcelas ?? []) {
        if (parc.status === "RECEBIDO") totalRecebido += parc.valor;
        else if (parc.status === "LIBERADO" || parc.status === "FATURADO") totalAReceber += parc.valor;
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
    for (const ev of eventos) {
      if (statusEfetivo(ev) !== "aprovado") continue;
      const recurso = recursos.find((r) => r.id === ev.recursoId);
      if (!recurso) continue;
      totais[recurso.tipo] += ev.totalHoras * recurso.valorHora;
    }
    return totais;
  }, [eventos, recursos]);

  const totalPagoRecursos = Object.values(pagoPorTipoRecurso).reduce((a, b) => a + b, 0);

  return (
    <div>
      <FinanceiroTabs />
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-card">
          <div
            className="pointer-events-none absolute -top-[70px] -right-[50px] h-[170px] w-[170px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(47,111,228,.12) 0%, rgba(47,111,228,0) 70%)" }}
          />
          <p className="relative mb-2.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
            Total contratado
          </p>
          <p className="relative text-[27px] leading-none font-extrabold tracking-[-0.03em] text-brand-navy-2">
            {moeda(resumoGeral.totalContratado)}
          </p>
          <p className="relative mt-1.5 text-xs text-brand-faint">{projetos.length} projetos</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-card">
          <div
            className="pointer-events-none absolute -top-[70px] -right-[50px] h-[170px] w-[170px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(21,117,76,.14) 0%, rgba(21,117,76,0) 70%)" }}
          />
          <p className="relative mb-2.5 text-[11px] font-bold tracking-[.1em] text-[#15754c] uppercase opacity-75">
            Recebido
          </p>
          <p className="relative text-[27px] leading-none font-extrabold tracking-[-0.03em] text-[#15754c]">
            {moeda(resumoGeral.totalRecebido)}
          </p>
          <p className="relative mt-1.5 text-xs text-[#15754c] opacity-60">parcelas quitadas</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-brand-navy p-5 text-white shadow-navy">
          <div
            className="pointer-events-none absolute -top-[70px] -right-[50px] h-[170px] w-[170px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(47,111,228,.55) 0%, rgba(47,111,228,0) 70%)" }}
          />
          <p className="relative mb-2.5 text-[11px] font-bold tracking-[.1em] text-white/75 uppercase">
            A receber
          </p>
          <p className="relative text-[27px] leading-none font-extrabold tracking-[-0.03em]">
            {moeda(resumoGeral.totalAReceber)}
          </p>
          <p className="relative mt-1.5 text-xs text-white/60">liberadas e faturadas</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-card">
          <div
            className="pointer-events-none absolute -top-[70px] -right-[50px] h-[170px] w-[170px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(47,111,228,.12) 0%, rgba(47,111,228,0) 70%)" }}
          />
          <p className="relative mb-2.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
            Pago aos recursos
          </p>
          <p className="relative text-[27px] leading-none font-extrabold tracking-[-0.03em] text-brand-navy-2">
            {moeda(totalPagoRecursos)}
          </p>
          <p className="relative mt-1.5 text-xs text-brand-faint">por horas apontadas</p>
        </div>
      </div>

      <div className="mb-4 text-[15px] font-extrabold text-brand-navy-2">Recebido × pago aos recursos</div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
          <p className="mb-1.5 text-xs text-brand-faint">Total recebido</p>
          <p className="text-xl font-extrabold tracking-[-0.02em] text-brand-navy-2">
            {moeda(resumoGeral.totalRecebido)}
          </p>
        </div>
        {(Object.keys(pagoPorTipoRecurso) as TipoRecurso[]).map((tipo) => (
          <div key={tipo} className="rounded-2xl border border-brand-border bg-white p-4 shadow-card">
            <p className="mb-1.5 text-xs text-brand-faint">Pago — {TIPO_RECURSO_CONFIG[tipo].label}</p>
            <p className="text-xl font-extrabold tracking-[-0.02em] text-brand-navy-2">
              {moeda(pagoPorTipoRecurso[tipo])}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 text-[15px] font-extrabold text-brand-navy-2">Parcelas por projeto</div>
      <div className="flex flex-col gap-4">
        {projetos.map((p) => {
          const cliente = clientes.find((c) => c.id === p.clienteId);
          return (
            <div key={p.id} className="rounded-2xl border border-brand-border bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <p className="text-base font-extrabold tracking-[-0.02em] text-brand-navy-2">
                    {nomeExibicaoCliente(cliente)}
                  </p>
                  <p className="text-[12.5px] text-brand-faint">
                    {TIPO_FATURAMENTO_CONFIG[p.financeiro?.tipoFaturamento ?? "parcelado"].label}
                  </p>
                  <PeriodoBadge
                    dataInicio={p.dataInicio}
                    dataFim={p.dataFim}
                    className="mt-1 text-[11px] text-brand-faint"
                  />
                </div>
                {p.financeiro?.tipoFaturamento !== "apontamento_horas" && (
                  <p className="text-[15px] font-extrabold text-brand-navy-2">
                    {moeda(p.financeiro?.valorTotal ?? 0)} · {p.financeiro?.numeroParcelas ?? 0}x
                  </p>
                )}
              </div>
              {p.financeiro?.tipoFaturamento === "apontamento_horas" ? (
                <p className="text-sm text-brand-faint">
                  Faturamento por apontamento de horas — sem parcelas fixas.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {(p.financeiro?.parcelas ?? []).map((parc) => (
                    <div
                      key={parc.numero}
                      className="flex min-w-[190px] flex-col gap-2 rounded-xl border border-brand-border-soft bg-brand-input px-3.5 py-3"
                    >
                      <span className="text-[11.5px] text-brand-faint">
                        {parc.descricao ? parc.descricao : `Parcela ${parc.numero}`}
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14.5px] font-extrabold text-brand-navy-2">
                          {moeda(parc.valor)}
                        </span>
                        <select
                          value={parc.status}
                          onChange={(e) =>
                            alterarStatusParcela(p, parc.numero, e.target.value as StatusParcela)
                          }
                          style={{
                            backgroundColor: STATUS_PARCELA_CONFIG[parc.status].bg,
                            color: STATUS_PARCELA_CONFIG[parc.status].text,
                          }}
                          className="rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold"
                        >
                          {STATUS_PARCELA_ORDEM.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_PARCELA_CONFIG[s].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {(p.financeiro?.parcelas ?? []).length === 0 && (
                    <p className="text-sm text-brand-faint">Nenhuma parcela cadastrada.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {projetos.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
            Nenhum projeto cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}

export default function FinanceiroPage() {
  return (
    <ProtectedPage perfis={["administrador", "financeiro"]}>
      <FinanceiroPageContent />
    </ProtectedPage>
  );
}
