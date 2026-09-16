"use client";

import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import {
  STATUS_DOCUMENTO_CONFIG,
  STATUS_DOCUMENTO_ORDEM,
  TIPO_FATURAMENTO_CONFIG,
  TIPO_RECURSO_CONFIG,
} from "@/lib/constants";
import { calcularHorasRealizadas, calcularPercentualProjeto } from "@/lib/dashboardCalc";
import type { EventoCalendario, Projeto, Recurso, StatusDocumento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function BarraHorasDrawer({ label, realizado, previsto }: { label: string; realizado: number; previsto: number }) {
  const percentual = previsto > 0 ? Math.min(100, (realizado / previsto) * 100) : 0;
  const estourou = previsto > 0 && realizado > previsto;
  return (
    <div className="rounded-xl border border-brand-border bg-white p-3.5 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
      <div className="mb-1 text-[11.5px] text-brand-faint">{label}</div>
      <div className={`text-lg font-bold ${estourou ? "text-[#b5392a]" : "text-brand-navy-2"}`}>
        {realizado.toFixed(1)}h{previsto > 0 ? ` / ${previsto.toFixed(1)}h` : ""}
      </div>
      {previsto > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-brand-accent-soft">
          <div
            className={`h-full rounded-full ${estourou ? "bg-[#e0543c]" : "bg-[#8fa8dd]"}`}
            style={{ width: `${percentual}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ProjetoDrawerConteudo({
  projeto,
  cliente,
  coordenador,
  consultores,
  eventos,
  recursos,
  podeEditar,
  podeVerFinanceiro,
  souConsultor = false,
  onEditar,
  onExcluir,
  onClose,
  onRegistrarContato,
}: {
  projeto: Projeto;
  cliente: string;
  coordenador: Recurso | undefined;
  consultores: Recurso[];
  eventos: EventoCalendario[];
  recursos: Recurso[];
  podeEditar: boolean;
  podeVerFinanceiro: boolean;
  souConsultor?: boolean;
  onEditar: () => void;
  onExcluir: () => void;
  onClose: () => void;
  onRegistrarContato: () => void;
}) {
  const percentual = calcularPercentualProjeto(projeto.documentos);
  const horas = calcularHorasRealizadas(projeto.id, eventos, recursos);
  const previstoConsultor = projeto.horasPrevistasConsultor ?? 0;
  const previstoCoordenador = projeto.horasPrevistasCoordenador ?? 0;

  async function alterarStatus(tipoDocumentoId: string, status: StatusDocumento) {
    const documentos = projeto.documentos.map((d) =>
      d.tipoDocumentoId === tipoDocumentoId ? { ...d, status } : d
    );
    await updateDoc(doc(db, "projetos", projeto.id), { documentos, updatedAt: serverTimestamp() });
  }

  return (
    <div>
      <div className="relative overflow-hidden bg-brand-navy px-6 pt-6 pb-6 text-white">
        <div
          className="pointer-events-none absolute -top-[140px] -right-20 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(47,111,228,.45) 0%, rgba(47,111,228,0) 70%)" }}
        />
        <div className="relative mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-white/60">
              <span>
                {projeto.codigoProposta} · {projeto.modulo} · {projeto.tipoAtendimento}
              </span>
              <PeriodoBadge
                dataInicio={projeto.dataInicio}
                dataFim={projeto.dataFim}
                className="text-white/60"
              />
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em]">{cliente}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-[9px] border border-white/25 bg-white/8 px-3.5 py-2 text-[13px] font-semibold hover:bg-white/18"
          >
            Fechar
          </button>
        </div>
        <div className="relative mb-2.5 flex items-end justify-between">
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-white/55 uppercase">
              Andamento
            </div>
            <div className="text-[42px] leading-[.9] font-extrabold tracking-[-0.04em]">{percentual}%</div>
          </div>
          <div className="text-right text-xs leading-relaxed text-white/60">
            Coordenador
            <br />
            <strong className="text-white">{coordenador?.nomeCompleto ?? "Sem coordenador"}</strong>
          </div>
        </div>
        <div className="relative h-[9px] w-full overflow-hidden rounded-full bg-white/14">
          <div
            className="h-full rounded-full"
            style={{ width: `${percentual}%`, background: "linear-gradient(90deg,#63a0ff,#2f6fe4)" }}
          />
        </div>
      </div>

      <div className="px-6 pt-5.5 pb-8">
        <p className="mb-5 text-sm text-brand-muted">
          Consultores:{" "}
          {consultores.length > 0
            ? consultores
                .map((c) => `${c.nomeCompleto} (${c.codigo}) — ${TIPO_RECURSO_CONFIG[c.tipo].label}`)
                .join("; ")
            : "Sem consultor"}
        </p>

        {(previstoConsultor > 0 || horas.consultor > 0 || (!souConsultor && (previstoCoordenador > 0 || horas.coordenador > 0))) && (
          <div className={`mb-5.5 grid gap-3.5 ${souConsultor ? "grid-cols-1" : "grid-cols-2"}`}>
            <BarraHorasDrawer label="Consultor" realizado={horas.consultor} previsto={previstoConsultor} />
            {!souConsultor && (
              <BarraHorasDrawer
                label="Coordenador"
                realizado={horas.coordenador}
                previsto={previstoCoordenador}
              />
            )}
          </div>
        )}

        <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Documentos do projeto</p>
        <div className="mb-5.5 overflow-hidden rounded-xl border border-brand-border bg-white shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
          {projeto.documentos.map((d) => {
            const cfg = STATUS_DOCUMENTO_CONFIG[d.status];
            return (
              <div
                key={d.tipoDocumentoId}
                className="flex items-center gap-3 border-t border-brand-border-soft px-4 py-2.5 first:border-t-0"
              >
                <span className="w-[58px] shrink-0 text-[11px] font-bold text-brand-faint">{d.codigo}</span>
                <span className="flex-1 text-[12.5px] leading-tight text-brand-navy-2">{d.descricao}</span>
                {podeEditar ? (
                  <select
                    value={d.status}
                    onChange={(e) => alterarStatus(d.tipoDocumentoId, e.target.value as StatusDocumento)}
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                    className="shrink-0 rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold"
                  >
                    {STATUS_DOCUMENTO_ORDEM.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_DOCUMENTO_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap"
                  >
                    {cfg.label}
                  </span>
                )}
              </div>
            );
          })}
          {projeto.documentos.length === 0 && (
            <p className="px-4 py-4 text-sm text-brand-faint">Nenhum documento incluído neste projeto.</p>
          )}
        </div>

        {podeVerFinanceiro && (
          <>
            <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Financeiro</p>
            <div className="mb-5.5 rounded-xl border border-brand-border bg-white p-4 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-brand-faint">
                  {TIPO_FATURAMENTO_CONFIG[projeto.financeiro?.tipoFaturamento ?? "parcelado"].label}
                </span>
                <span className="text-lg font-extrabold text-brand-navy-2">
                  {projeto.financeiro?.tipoFaturamento === "apontamento_horas"
                    ? "Sem valor fixo"
                    : `${moeda(projeto.financeiro?.valorTotal ?? 0)} em ${projeto.financeiro?.numeroParcelas ?? 0}x`}
                </span>
              </div>
            </div>
          </>
        )}

        {projeto.observacoes && (
          <div className="mb-5.5">
            <p className="mb-1.5 text-sm font-extrabold text-brand-navy-2">Observações</p>
            <p className="text-sm text-brand-muted">{projeto.observacoes}</p>
          </div>
        )}

        <div className="flex gap-2.5">
          {podeEditar && <Button onClick={onEditar}>Editar projeto</Button>}
          <Button variant="secondary" onClick={onRegistrarContato}>
            Registrar contato
          </Button>
          {podeEditar && (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onExcluir}>
              Excluir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
