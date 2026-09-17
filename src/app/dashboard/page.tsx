"use client";

import { useMemo, useState } from "react";
import { deleteDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageCircle, SlidersHorizontal, X } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { ContatoModal } from "@/components/dashboard/ContatoModal";
import { Drawer } from "@/components/ui/Drawer";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { KpiCard, PainelVazio } from "@/components/ui/KpiCard";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { ProjetoDrawerConteudo } from "@/components/projetos/ProjetoDrawer";
import { EditarProjetoModal } from "@/components/projetos/EditarProjetoModal";
import { useAuth } from "@/contexts/AuthContext";
import { calcularHorasRealizadas, calcularPercentualProjeto } from "@/lib/dashboardCalc";
import { STATUS_DOCUMENTO_CONFIG } from "@/lib/constants";
import { formatarHoras } from "@/lib/horas";
import { statusEfetivo } from "@/lib/statusHora";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { TIPOS_ATENDIMENTO } from "@/types";
import type { Cliente, Escopo, EventoCalendario, Projeto, Recurso, TipoDocumento } from "@/types";

function formatarDataHora(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DashboardPageContent() {
  const { usuario } = useAuth();
  const souConsultor = usuario?.perfil === "consultor";
  const podeVerFinanceiro = !souConsultor;
  const meuRecursoId = usuario?.recursoId ?? null;

  const { data: projetosTodos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: eventos } = useCollection<EventoCalendario>(
    "eventosCalendario",
    souConsultor ? [where("recursoId", "==", meuRecursoId ?? "")] : [],
    !souConsultor || !!meuRecursoId
  );
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: tiposDocumento } = useCollection<TipoDocumento>("tiposDocumento", []);
  const { data: escopos } = useCollection<Escopo>("escopos", []);

  const [contatoProjeto, setContatoProjeto] = useState<Projeto | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroRecursoId, setFiltroRecursoId] = useState("");
  const [filtroProjetoId, setFiltroProjetoId] = useState("");
  const [kpiAberto, setKpiAberto] = useState<"projetos" | "andamento" | "horas" | "documentos" | null>(
    null
  );

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";

  const projetos = souConsultor
    ? projetosTodos.filter((p) => p.consultorIds?.includes(meuRecursoId ?? ""))
    : projetosTodos;

  // Visão individual (admin/coordenador): recorta o dashboard inteiro para um
  // consultor/coordenador e/ou um projeto específico.
  const projetosVisao = useMemo(() => {
    return projetos.filter((p) => {
      if (filtroRecursoId && !(p.consultorIds?.includes(filtroRecursoId) || p.coordenadorId === filtroRecursoId))
        return false;
      if (filtroProjetoId && p.id !== filtroProjetoId) return false;
      return true;
    });
  }, [projetos, filtroRecursoId, filtroProjetoId]);

  const eventosVisao = useMemo(() => {
    return eventos.filter((e) => {
      if (filtroRecursoId && e.recursoId !== filtroRecursoId) return false;
      if (filtroProjetoId && e.projetoId !== filtroProjetoId) return false;
      return true;
    });
  }, [eventos, filtroRecursoId, filtroProjetoId]);

  const recursoFiltrado = recursos.find((r) => r.id === filtroRecursoId);
  const projetoFiltradoInfo = projetosTodos.find((p) => p.id === filtroProjetoId);

  // Com um único projeto selecionado (e nenhum consultor), o detalhe de horas
  // quebra por consultor; com um único consultor (e nenhum projeto), quebra
  // por projeto; sem recorte (ou com os dois juntos), quebra por cliente.
  const modoDetalheHoras: "cliente" | "consultor" | "projeto" =
    filtroProjetoId && !filtroRecursoId ? "consultor" : filtroRecursoId && !filtroProjetoId ? "projeto" : "cliente";

  const percentuais = projetosVisao.map((p) => calcularPercentualProjeto(p.documentos));
  const andamentoMedio =
    percentuais.length > 0 ? percentuais.reduce((a, b) => a + b, 0) / percentuais.length : 0;

  const mesAtual = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const eventosDoMes = useMemo(
    () => eventosVisao.filter((e) => e.data.startsWith(mesAtual) && statusEfetivo(e) === "aprovado"),
    [eventosVisao, mesAtual]
  );
  const horasNoMes = eventosDoMes.reduce((acc, e) => acc + e.totalHoras, 0);

  const documentosPendentesLista = useMemo(() => {
    return projetosVisao.flatMap((p) => {
      const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId));
      return p.documentos
        .filter((d) => d.status !== "ASSINADO" && d.status !== "CANCELADO")
        .map((d) => ({
          projetoId: p.id,
          cliente,
          codigo: d.codigo,
          descricao: d.descricao,
          statusLabel: STATUS_DOCUMENTO_CONFIG[d.status].label,
        }));
    });
  }, [projetosVisao, clientes]);
  const documentosPendentes = documentosPendentesLista.length;

  const horasPorClienteNoMes = useMemo(() => {
    const mapa = new Map<string, number>();
    eventosDoMes.forEach((e) => {
      const projeto = projetos.find((p) => p.id === e.projetoId);
      if (!projeto) return;
      mapa.set(projeto.clienteId, (mapa.get(projeto.clienteId) ?? 0) + e.totalHoras);
    });
    return [...mapa.entries()]
      .map(([clienteId, horas]) => ({
        clienteId,
        nome: nomeExibicaoCliente(clientes.find((c) => c.id === clienteId)),
        horas,
      }))
      .sort((a, b) => b.horas - a.horas);
  }, [eventosDoMes, projetos, clientes]);

  const horasPorConsultorNoMes = useMemo(() => {
    const mapa = new Map<string, number>();
    eventosDoMes.forEach((e) => {
      mapa.set(e.recursoId, (mapa.get(e.recursoId) ?? 0) + e.totalHoras);
    });
    return [...mapa.entries()]
      .map(([recursoId, horas]) => ({
        recursoId,
        nome: recursos.find((r) => r.id === recursoId)?.nomeCompleto ?? "—",
        horas,
      }))
      .sort((a, b) => b.horas - a.horas);
  }, [eventosDoMes, recursos]);

  const horasPorProjetoNoMes = useMemo(() => {
    const mapa = new Map<string, number>();
    eventosDoMes.forEach((e) => {
      mapa.set(e.projetoId, (mapa.get(e.projetoId) ?? 0) + e.totalHoras);
    });
    return [...mapa.entries()]
      .map(([projetoId, horas]) => {
        const projeto = projetosTodos.find((p) => p.id === projetoId);
        return {
          projetoId,
          nome: nomeExibicaoCliente(clientes.find((c) => c.id === projeto?.clienteId)),
          codigoProposta: projeto?.codigoProposta ?? "",
          horas,
        };
      })
      .sort((a, b) => b.horas - a.horas);
  }, [eventosDoMes, projetosTodos, clientes]);

  const filtroAtivo = !!filtroTipo || !!filtroDataInicio || !!filtroDataFim;
  const filtroVisaoAtivo = !!filtroRecursoId || !!filtroProjetoId;

  function abrirProjetoNoPainel(id: string) {
    setDetalheId(id);
    setKpiAberto(null);
  }

  const projetosFiltrados = useMemo(() => {
    return projetosVisao.filter((p) => {
      if (filtroTipo && p.tipoAtendimento !== filtroTipo) return false;
      if (filtroDataInicio && (!p.dataInicio || p.dataInicio < filtroDataInicio)) return false;
      if (filtroDataFim && (!p.dataInicio || p.dataInicio > filtroDataFim)) return false;
      return true;
    });
  }, [projetosVisao, filtroTipo, filtroDataInicio, filtroDataFim]);

  function limparFiltros() {
    setFiltroTipo("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  function limparFiltroVisao() {
    setFiltroRecursoId("");
    setFiltroProjetoId("");
  }

  const projetoDetalhe = projetos.find((p) => p.id === detalheId) ?? null;

  async function excluir(projeto: Projeto) {
    const cliente = clientes.find((c) => c.id === projeto.clienteId);
    if (!confirm(`Excluir o projeto de "${nomeExibicaoCliente(cliente)}"?`)) return;
    await deleteDoc(doc(db, "projetos", projeto.id));
    setDetalheId(null);
  }

  if (souConsultor && !meuRecursoId) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-border bg-white p-6 text-sm text-brand-muted">
        Seu usuário ainda não está vinculado a um recurso. Peça a um administrador para vincular seu
        usuário a um recurso em Cadastros → Usuários.
      </p>
    );
  }

  return (
    <div>
      {!souConsultor && (
        <div className="mb-5 flex flex-wrap items-end gap-2.5">
          <FormRow label="Ver por consultor/coordenador">
            <Select
              value={filtroRecursoId}
              onChange={(e) => setFiltroRecursoId(e.target.value)}
              className="w-56"
            >
              <option value="">Todos (visão geral)</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomeCompleto} ({r.codigo})
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Ver por projeto">
            <Select
              value={filtroProjetoId}
              onChange={(e) => setFiltroProjetoId(e.target.value)}
              className="w-56"
            >
              <option value="">Todos os projetos</option>
              {projetosTodos.map((p) => {
                const cliente = clientes.find((c) => c.id === p.clienteId);
                return (
                  <option key={p.id} value={p.id}>
                    {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
                  </option>
                );
              })}
            </Select>
          </FormRow>
          {filtroVisaoAtivo && (
            <button
              type="button"
              onClick={limparFiltroVisao}
              className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Projetos ativos"
          valor={String(projetosVisao.length)}
          nota={
            souConsultor
              ? "em que você participa"
              : recursoFiltrado
                ? `de ${recursoFiltrado.nomeCompleto}`
                : "em acompanhamento"
          }
          aberto={kpiAberto === "projetos"}
          onToggle={() => setKpiAberto((v) => (v === "projetos" ? null : "projetos"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            {souConsultor ? "Projetos em que você participa" : "Projetos nesta visão"}
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {projetosVisao.map((p) => {
              const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId));
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => abrirProjetoNoPainel(p.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-brand-navy-2 hover:bg-brand-hover"
                >
                  <span className="truncate">{cliente}</span>
                  <span className="shrink-0 text-[11px] text-brand-faint">{p.codigoProposta}</span>
                </button>
              );
            })}
            {projetosVisao.length === 0 && <PainelVazio />}
          </div>
        </KpiCard>

        <KpiCard
          label="Andamento médio"
          valor={`${andamentoMedio.toFixed(0)}%`}
          nota={
            projetoFiltradoInfo
              ? "deste projeto"
              : recursoFiltrado
                ? `de ${recursoFiltrado.nomeCompleto}`
                : "entre todos os projetos"
          }
          aberto={kpiAberto === "andamento"}
          onToggle={() => setKpiAberto((v) => (v === "andamento" ? null : "andamento"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            Andamento por projeto
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {projetosVisao.map((p) => {
              const cliente = nomeExibicaoCliente(clientes.find((c) => c.id === p.clienteId));
              const percentual = calcularPercentualProjeto(p.documentos);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => abrirProjetoNoPainel(p.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-brand-navy-2 hover:bg-brand-hover"
                >
                  <span className="truncate">{cliente}</span>
                  <span
                    className="shrink-0 font-bold"
                    style={{ color: percentual >= 100 ? "#15754c" : "#2f6fe4" }}
                  >
                    {percentual.toFixed(0)}%
                  </span>
                </button>
              );
            })}
            {projetosVisao.length === 0 && <PainelVazio />}
          </div>
        </KpiCard>

        <KpiCard
          label="Horas no mês"
          valor={formatarHoras(horasNoMes)}
          nota={
            recursoFiltrado && projetoFiltradoInfo
              ? `${recursoFiltrado.nomeCompleto} · ${nomeExibicaoCliente(clientes.find((c) => c.id === projetoFiltradoInfo.clienteId))}`
              : recursoFiltrado
                ? `de ${recursoFiltrado.nomeCompleto}`
                : projetoFiltradoInfo
                  ? `em ${nomeExibicaoCliente(clientes.find((c) => c.id === projetoFiltradoInfo.clienteId))}`
                  : "lançadas neste mês"
          }
          aberto={kpiAberto === "horas"}
          onToggle={() => setKpiAberto((v) => (v === "horas" ? null : "horas"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            {modoDetalheHoras === "consultor" && "Horas aprovadas no mês, por consultor"}
            {modoDetalheHoras === "projeto" && "Horas aprovadas no mês, por projeto"}
            {modoDetalheHoras === "cliente" && "Horas aprovadas no mês, por cliente"}
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {modoDetalheHoras === "cliente" &&
              horasPorClienteNoMes.map((h) => (
                <div
                  key={h.clienteId}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12.5px] text-brand-navy-2"
                >
                  <span className="truncate">{h.nome}</span>
                  <span className="shrink-0 font-bold">{formatarHoras(h.horas)}</span>
                </div>
              ))}
            {modoDetalheHoras === "consultor" &&
              horasPorConsultorNoMes.map((h) => (
                <div
                  key={h.recursoId}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-[12.5px] text-brand-navy-2"
                >
                  <span className="truncate">{h.nome}</span>
                  <span className="shrink-0 font-bold">{formatarHoras(h.horas)}</span>
                </div>
              ))}
            {modoDetalheHoras === "projeto" &&
              horasPorProjetoNoMes.map((h) => (
                <button
                  key={h.projetoId}
                  type="button"
                  onClick={() => abrirProjetoNoPainel(h.projetoId)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-brand-navy-2 hover:bg-brand-hover"
                >
                  <span className="truncate">
                    {h.nome} <span className="text-brand-faint">· {h.codigoProposta}</span>
                  </span>
                  <span className="shrink-0 font-bold">{formatarHoras(h.horas)}</span>
                </button>
              ))}
            {((modoDetalheHoras === "cliente" && horasPorClienteNoMes.length === 0) ||
              (modoDetalheHoras === "consultor" && horasPorConsultorNoMes.length === 0) ||
              (modoDetalheHoras === "projeto" && horasPorProjetoNoMes.length === 0)) && <PainelVazio />}
          </div>
        </KpiCard>

        <KpiCard
          label="Documentos pendentes"
          valor={String(documentosPendentes)}
          nota={
            projetoFiltradoInfo
              ? "deste projeto"
              : recursoFiltrado
                ? `de ${recursoFiltrado.nomeCompleto}`
                : "aguardando conclusão"
          }
          aberto={kpiAberto === "documentos"}
          onToggle={() => setKpiAberto((v) => (v === "documentos" ? null : "documentos"))}
        >
          <p className="mb-2 px-1 text-[11px] font-bold tracking-[.08em] text-brand-faint uppercase">
            Documentos pendentes
          </p>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {documentosPendentesLista.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => abrirProjetoNoPainel(d.projetoId)}
                className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-brand-hover"
              >
                <p className="truncate text-[12.5px] font-semibold text-brand-navy-2">
                  {d.codigo} — {d.descricao}
                </p>
                <p className="truncate text-[11px] text-brand-faint">
                  {d.cliente} · {d.statusLabel}
                </p>
              </button>
            ))}
            {documentosPendentesLista.length === 0 && <PainelVazio />}
          </div>
        </KpiCard>
      </div>

      <div className="relative mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[15px] font-extrabold tracking-[-0.01em] text-brand-navy-2">
            {souConsultor ? "Meus projetos" : "Projetos em andamento"}
          </span>
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
              filtroAtivo
                ? "border-brand-accent bg-brand-accent-soft text-[#2456b8]"
                : "border-brand-border text-brand-faint hover:bg-brand-hover"
            }`}
          >
            <SlidersHorizontal size={12} />
            Filtros
            {filtroAtivo && <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />}
          </button>
        </div>
        <span className="text-xs text-brand-faint">
          {projetosFiltrados.length} projeto{projetosFiltrados.length === 1 ? "" : "s"} · clique para ver o
          detalhe
        </span>

        {filtrosAbertos && (
          <div className="absolute top-8 left-0 z-30 w-[340px] rounded-2xl border border-brand-border bg-white p-4 shadow-card-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-brand-navy-2">Filtrar projetos</span>
              <button
                onClick={() => setFiltrosAbertos(false)}
                className="rounded p-0.5 text-brand-faint hover:bg-brand-hover"
              >
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                  Tipo de atendimento
                </label>
                <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {TIPOS_ATENDIMENTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                    Início a partir de
                  </label>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                    Início até
                  </label>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                  />
                </div>
              </div>
              {filtroAtivo && (
                <button
                  onClick={limparFiltros}
                  className="text-[12.5px] font-semibold text-brand-accent hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,208px)]">
        {projetosFiltrados.map((p) => {
          const cliente = clientes.find((c) => c.id === p.clienteId);
          const percentual = calcularPercentualProjeto(p.documentos);
          const emAlta = percentual >= 100;
          const cor = emAlta ? "#15754c" : "#2f6fe4";
          const horas = calcularHorasRealizadas(p.id, eventos, recursos);
          const previstoConsultor = p.horasPrevistasConsultor ?? 0;
          const previstoCoordenador = p.horasPrevistasCoordenador ?? 0;
          const mostrarHorasConsultor = previstoConsultor > 0 || horas.consultor > 0;
          const mostrarHorasCoordenador =
            !souConsultor && (previstoCoordenador > 0 || horas.coordenador > 0);

          return (
            <div
              key={p.id}
              onClick={() => setDetalheId(p.id)}
              className="flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-brand-border border-l-4 border-l-brand-accent bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[14px] leading-tight font-extrabold tracking-[-0.01em] text-brand-navy-2">
                    {nomeExibicaoCliente(cliente)}
                  </p>
                  {p.status === "finalizado" && (
                    <span className="shrink-0 rounded-full bg-brand-hover px-1.5 py-[1px] text-[9px] font-bold text-brand-faint">
                      Finalizado
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-brand-faint">
                  {p.codigoProposta} · {p.modulo}
                </p>
                <PeriodoBadge
                  dataInicio={p.dataInicio}
                  dataFim={p.dataFim}
                  className="text-[10px] text-brand-faint"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-lg leading-none font-extrabold tracking-[-0.02em]" style={{ color: cor }}>
                    {percentual.toFixed(0)}%
                  </span>
                  <span className="text-[10.5px] font-semibold text-brand-muted">
                    {p.documentos.filter((d) => d.status === "ASSINADO").length}/{p.documentos.length}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-accent-soft">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percentual}%`,
                      background: emAlta
                        ? "linear-gradient(90deg,#1f9a63,#15754c)"
                        : "linear-gradient(90deg,#4d8bf5,#2f6fe4)",
                    }}
                  />
                </div>
              </div>

              {(mostrarHorasConsultor || mostrarHorasCoordenador) && (
                <div className="flex items-center gap-3 text-[10.5px] text-brand-faint">
                  {mostrarHorasConsultor && (
                    <span>
                      C <strong className="text-brand-navy-2">{horas.consultor.toFixed(0)}h</strong>
                      {previstoConsultor > 0 ? `/${previstoConsultor.toFixed(0)}h` : ""}
                    </span>
                  )}
                  {mostrarHorasCoordenador && (
                    <span>
                      Co <strong className="text-brand-navy-2">{horas.coordenador.toFixed(0)}h</strong>
                      {previstoCoordenador > 0 ? `/${previstoCoordenador.toFixed(0)}h` : ""}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContatoProjeto(p);
                }}
                title={p.ultimoContato?.texto}
                className="flex items-center gap-1.5 truncate rounded-[8px] bg-brand-hover px-2.5 py-1.5 text-left text-[10.5px] text-brand-muted hover:bg-brand-accent-soft"
              >
                <MessageCircle size={12} className="shrink-0" />
                <span className="truncate">
                  {p.ultimoContato
                    ? `${formatarDataHora(p.ultimoContato.criadoEm)} · ${p.ultimoContato.texto}`
                    : "Registrar contato"}
                </span>
              </button>
            </div>
          );
        })}
        {projetosFiltrados.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-brand-faint">
            {projetos.length === 0
              ? souConsultor
                ? "Você ainda não está alocado em nenhum projeto."
                : "Nenhum projeto cadastrado ainda."
              : "Nenhum projeto encontrado para esse filtro."}
          </p>
        )}
      </div>

      <Drawer open={!!projetoDetalhe} onClose={() => setDetalheId(null)} flush>
        {projetoDetalhe && (
          <ProjetoDrawerConteudo
            projeto={projetoDetalhe}
            cliente={nomeExibicaoCliente(clientes.find((c) => c.id === projetoDetalhe.clienteId))}
            coordenador={recursos.find((r) => r.id === projetoDetalhe.coordenadorId)}
            consultores={recursos.filter((r) => projetoDetalhe.consultorIds?.includes(r.id))}
            eventos={eventos}
            recursos={recursos}
            podeEditar={!!podeEditar}
            podeVerFinanceiro={podeVerFinanceiro}
            souConsultor={souConsultor}
            onEditar={() => setEditando(projetoDetalhe)}
            onExcluir={() => excluir(projetoDetalhe)}
            onClose={() => setDetalheId(null)}
            onRegistrarContato={() => setContatoProjeto(projetoDetalhe)}
          />
        )}
      </Drawer>

      {podeEditar && (
        <EditarProjetoModal
          projeto={editando}
          onClose={() => setEditando(null)}
          recursos={recursos}
          tiposDocumento={tiposDocumento}
          escopos={escopos}
        />
      )}

      <ContatoModal
        projeto={contatoProjeto}
        cliente={clientes.find((c) => c.id === contatoProjeto?.clienteId)}
        onClose={() => setContatoProjeto(null)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador", "consultor"]}>
      <DashboardPageContent />
    </ProtectedPage>
  );
}
