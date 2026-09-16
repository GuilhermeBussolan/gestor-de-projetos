"use client";

import { useMemo, useState } from "react";
import { deleteDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageCircle, SlidersHorizontal, X } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { ContatoModal } from "@/components/dashboard/ContatoModal";
import { Drawer } from "@/components/ui/Drawer";
import { Input, Select } from "@/components/ui/Field";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { ProjetoDrawerConteudo } from "@/components/projetos/ProjetoDrawer";
import { EditarProjetoModal } from "@/components/projetos/EditarProjetoModal";
import { useAuth } from "@/contexts/AuthContext";
import { calcularHorasRealizadas, calcularPercentualProjeto } from "@/lib/dashboardCalc";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { TIPOS_ATENDIMENTO } from "@/types";
import type { Cliente, EventoCalendario, Projeto, Recurso, TipoDocumento } from "@/types";

function formatarDataHora(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KpiCard({ label, valor, nota }: { label: string; valor: string; nota: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-card">
      <div
        className="pointer-events-none absolute -top-[60px] -right-10 h-[150px] w-[150px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(47,111,228,.12) 0%, rgba(47,111,228,0) 70%)" }}
      />
      <div className="relative mb-2.5 text-[11px] font-bold tracking-[.1em] text-brand-faint uppercase">
        {label}
      </div>
      <div className="relative text-[30px] leading-none font-extrabold tracking-[-0.03em] text-brand-navy-2">
        {valor}
      </div>
      <div className="relative mt-1.5 text-xs text-brand-faint">{nota}</div>
    </div>
  );
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

  const [contatoProjeto, setContatoProjeto] = useState<Projeto | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";

  const projetos = souConsultor
    ? projetosTodos.filter((p) => p.consultorIds?.includes(meuRecursoId ?? ""))
    : projetosTodos;

  const percentuais = projetos.map((p) => calcularPercentualProjeto(p.documentos));
  const andamentoMedio =
    percentuais.length > 0 ? percentuais.reduce((a, b) => a + b, 0) / percentuais.length : 0;

  const mesAtual = new Date().toISOString().slice(0, 7);
  const horasNoMes = eventos
    .filter((e) => e.data.startsWith(mesAtual) && !(e.origem === "recorrencia" && e.status !== "realizada"))
    .reduce((acc, e) => acc + e.totalHoras, 0);

  const documentos = projetos.flatMap((p) => p.documentos);
  const documentosPendentes = documentos.filter(
    (d) => d.status !== "ASSINADO" && d.status !== "CANCELADO"
  ).length;

  const filtroAtivo = !!filtroTipo || !!filtroDataInicio || !!filtroDataFim;

  const projetosFiltrados = useMemo(() => {
    return projetos.filter((p) => {
      if (filtroTipo && p.tipoAtendimento !== filtroTipo) return false;
      if (filtroDataInicio && (!p.dataInicio || p.dataInicio < filtroDataInicio)) return false;
      if (filtroDataFim && (!p.dataInicio || p.dataInicio > filtroDataFim)) return false;
      return true;
    });
  }, [projetos, filtroTipo, filtroDataInicio, filtroDataFim]);

  function limparFiltros() {
    setFiltroTipo("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
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
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Projetos ativos"
          valor={String(projetos.length)}
          nota={souConsultor ? "em que você participa" : "em acompanhamento"}
        />
        <KpiCard
          label="Andamento médio"
          valor={`${andamentoMedio.toFixed(0)}%`}
          nota="entre todos os projetos"
        />
        <KpiCard label="Horas no mês" valor={formatarHoras(horasNoMes)} nota="lançadas neste mês" />
        <KpiCard
          label="Documentos pendentes"
          valor={String(documentosPendentes)}
          nota="aguardando conclusão"
        />
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
                <p className="truncate text-[14px] leading-tight font-extrabold tracking-[-0.01em] text-brand-navy-2">
                  {nomeExibicaoCliente(cliente)}
                </p>
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
