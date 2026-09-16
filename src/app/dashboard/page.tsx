"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { ContatoModal } from "@/components/dashboard/ContatoModal";
import { calcularHorasRealizadas, calcularPercentualProjeto, corFaixaProgresso } from "@/lib/dashboardCalc";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

function formatarDataHora(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BarraHoras({ label, realizado, previsto }: { label: string; realizado: number; previsto: number }) {
  const percentual = previsto > 0 ? Math.min(100, (realizado / previsto) * 100) : realizado > 0 ? 100 : 0;
  const estourou = previsto > 0 && realizado > previsto;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span className={estourou ? "font-semibold text-red-600" : ""}>
          {realizado.toFixed(1)}h{previsto > 0 ? ` / ${previsto.toFixed(1)}h` : ""}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${estourou ? "bg-red-500" : "bg-sky-500"}`}
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

function DashboardPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: recursos } = useCollection<Recurso>("recursos");
  const router = useRouter();
  const [contatoProjeto, setContatoProjeto] = useState<Projeto | null>(null);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projetos.map((p) => {
          const cliente = clientes.find((c) => c.id === p.clienteId);
          const percentual = calcularPercentualProjeto(p.documentos);
          const cor = corFaixaProgresso(percentual);
          const horas = calcularHorasRealizadas(p.id, eventos, recursos);
          const previstoConsultor = p.horasPrevistasConsultor ?? 0;
          const previstoCoordenador = p.horasPrevistasCoordenador ?? 0;
          const mostrarHoras =
            previstoConsultor > 0 || previstoCoordenador > 0 || horas.consultor > 0 || horas.coordenador > 0;
          return (
            <div
              key={p.id}
              onClick={() => router.push(`/projetos?projetoId=${p.id}`)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="mb-1 font-semibold text-slate-900">{nomeExibicaoCliente(cliente)}</p>
              <p className="mb-3 text-xs text-slate-500">
                {p.codigoProposta} · {p.modulo} · {p.tipoAtendimento} · {p.documentos.length}{" "}
                documento(s)
              </p>
              <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percentual}%`, backgroundColor: cor }}
                />
              </div>
              <p className="mb-3 text-sm font-semibold" style={{ color: cor }}>
                {percentual}%
              </p>

              {mostrarHoras && (
                <div className="mb-3 space-y-2 border-t border-slate-100 pt-3">
                  <BarraHoras label="Consultor" realizado={horas.consultor} previsto={previstoConsultor} />
                  <BarraHoras
                    label="Coordenador"
                    realizado={horas.coordenador}
                    previsto={previstoCoordenador}
                  />
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setContatoProjeto(p);
                }}
                title={p.ultimoContato?.texto}
                className="flex w-full items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <MessageCircle size={14} className="shrink-0" />
                {p.ultimoContato
                  ? `Último contato: ${formatarDataHora(p.ultimoContato.criadoEm)} — ${p.ultimoContato.usuarioNome}`
                  : "Registrar contato"}
              </button>
            </div>
          );
        })}
        {projetos.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
            Nenhum projeto cadastrado ainda.
          </p>
        )}
      </div>

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
    <ProtectedPage perfis={["administrador", "coordenador"]}>
      <DashboardPageContent />
    </ProtectedPage>
  );
}
