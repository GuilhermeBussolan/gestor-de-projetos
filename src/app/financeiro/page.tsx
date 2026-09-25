"use client";

import { useMemo, useState } from "react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { FinanceiroTabs } from "@/components/layout/FinanceiroTabs";
import { AlterarStatusParcelaModal } from "@/components/financeiro/AlterarStatusParcelaModal";
import { CartaoParcelasProjeto } from "@/components/financeiro/CartaoParcelasProjeto";
import { GraficoPizzaLiotNg } from "@/components/financeiro/GraficoPizzaLiotNg";
import { gerarParcelaBancoDeHoras, horasApontadasNoMes, horasDoProjetoPorMesEStatus } from "@/lib/bancoHoras";
import { segmentarLiotNg } from "@/lib/segmentacaoLiotNg";
import { Input } from "@/components/ui/Field";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { alterarStatusParcela, type DadosStatusParcela } from "@/lib/parcela";
import { statusEfetivo } from "@/lib/statusHora";
import { useAuth } from "@/contexts/AuthContext";
import type { Cliente, EventoCalendario, Projeto, Recurso, StatusParcela, TipoRecurso } from "@/types";

const PRECISA_DADOS: StatusParcela[] = ["LIBERADO", "FATURADO", "RECEBIDO", "CANCELADO"];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPageContent() {
  const { usuario } = useAuth();
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  // Mês de referência do banco de horas (padrão: o mês anterior, que é o que se fatura agora).
  const [mesBanco, setMesBanco] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const segmentacao = useMemo(() => segmentarLiotNg(projetos), [projetos]);
  // Cards de projeto recolhidos por padrão (a tela fica compacta); o usuário abre o que precisa.
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const todosAbertos = projetos.length > 0 && abertos.size >= projetos.length;
  function alternarCartao(id: string) {
    setAbertos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }
  const [alterando, setAlterando] = useState<{
    projeto: Projeto;
    numero: number;
    status: StatusParcela;
  } | null>(null);

  function aoMudarStatus(projeto: Projeto, numero: number, novoStatus: StatusParcela) {
    if (PRECISA_DADOS.includes(novoStatus)) {
      setAlterando({ projeto, numero, status: novoStatus });
    } else {
      alterarStatusParcela(projeto, numero, novoStatus, {}, usuario ?? undefined);
    }
  }

  async function confirmarAlteracao(dados: DadosStatusParcela) {
    if (!alterando) return;
    await alterarStatusParcela(alterando.projeto, alterando.numero, alterando.status, dados, usuario ?? undefined);
    setAlterando(null);
  }

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

      <GraficoPizzaLiotNg dados={segmentacao} />

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-[15px] font-extrabold text-brand-navy-2">Parcelas por projeto</div>
          {projetos.some((p) => p.financeiro?.tipoFaturamento === "banco_horas") && (
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-muted">
              Mês do banco de horas
              <Input type="month" value={mesBanco} onChange={(e) => e.target.value && setMesBanco(e.target.value)} className="w-40" />
            </label>
          )}
        </div>
        {projetos.length > 0 && (
          <button
            type="button"
            onClick={() => setAbertos(todosAbertos ? new Set() : new Set(projetos.map((p) => p.id)))}
            className="text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            {todosAbertos ? "Recolher todos" : "Expandir todos"}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {projetos.map((p) => (
          <CartaoParcelasProjeto
            key={p.id}
            projeto={p}
            cliente={clientes.find((c) => c.id === p.clienteId)}
            aberto={abertos.has(p.id)}
            banco={
              p.financeiro?.tipoFaturamento === "banco_horas"
                ? {
                    mes: mesBanco,
                    horas: horasApontadasNoMes(eventos, p.id, mesBanco),
                    outrasHoras: horasDoProjetoPorMesEStatus(eventos, p.id),
                    onGerarParcela: (valor) =>
                      gerarParcelaBancoDeHoras({
                        projeto: p,
                        mes: mesBanco,
                        horas: horasApontadasNoMes(eventos, p.id, mesBanco),
                        valorHora: p.financeiro?.valorHora ?? 0,
                        valor,
                      }),
                  }
                : undefined
            }
            onAlternar={() => alternarCartao(p.id)}
            onMudarStatus={aoMudarStatus}
          />
        ))}
        {projetos.length === 0 && (
          <p className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
            Nenhum projeto cadastrado ainda.
          </p>
        )}
      </div>

      <AlterarStatusParcelaModal
        statusAlvo={alterando?.status ?? null}
        parcelas={alterando?.projeto.financeiro.parcelas ?? []}
        numero={alterando?.numero ?? 0}
        onCancelar={() => setAlterando(null)}
        onConfirmar={confirmarAlteracao}
      />
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
