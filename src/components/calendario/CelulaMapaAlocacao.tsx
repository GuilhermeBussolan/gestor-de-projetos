"use client";

import { Lock } from "lucide-react";
import { HORAS_POR_TURNO, PERIODO_LABEL, type CelulaTurno, type StatusTurno } from "@/lib/cronograma";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { formatarHoras } from "@/lib/horas";
import { formatarMinutos } from "@/lib/escopo";
import type { Cliente, Projeto } from "@/types";

export const COR_TURNO: Record<StatusTurno, { fundo: string; borda: string; barra: string }> = {
  livre: { fundo: "bg-white", borda: "border-brand-border-soft", barra: "" },
  parcial: { fundo: "bg-[#eef3ff]", borda: "border-[#c3d4f7]", barra: "bg-[#7ea2ee]" },
  cheio: { fundo: "bg-[#dbe6fd]", borda: "border-[#a9c1f5]", barra: "bg-[#2f6fe4]" },
  sobreposicao: { fundo: "bg-[#fdeceb]", borda: "border-[#f3b8b0]", barra: "bg-[#d9503f]" },
  realizado: { fundo: "bg-[#e3f5ea]", borda: "border-[#b9e2cb]", barra: "bg-[#1f9a63]" },
};

export const ROTULO_STATUS: Record<StatusTurno, string> = {
  livre: "Livre",
  parcial: "Parcialmente previsto",
  cheio: "Turno cheio (4h previstas)",
  sobreposicao: "Sobreposição (mais de 4h previstas)",
  realizado: "Realizado",
};

/** Fundo listrado usado em tudo que é "agenda bloqueada". */
export const FUNDO_BLOQUEIO = "repeating-linear-gradient(135deg, #eef0f5 0 6px, #e2e6ef 6px 12px)";

/** Bloqueio que atinge o turno: horas tomadas (até 4) e os motivos. */
export type BloqueioTurno = { horas: number; motivos: string[] };

export function tituloProjeto(projetoId: string, projetos: Projeto[], clientes: Cliente[]): string {
  const projeto = projetos.find((p) => p.id === projetoId);
  if (!projeto) return "Projeto removido";
  return nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId));
}

function horasCurtas(horas: number): string {
  return formatarMinutos(Math.round(horas * 60));
}

/** Uma célula (um turno de um dia) do Mapa de Alocação. Clicável quando há algo previsto ou realizado. */
export function CelulaMapaAlocacao({
  celula,
  compacto,
  projetos,
  clientes,
  onAbrir,
  bloqueio,
}: {
  celula: CelulaTurno;
  compacto: boolean;
  projetos: Projeto[];
  clientes: Cliente[];
  onAbrir: () => void;
  bloqueio?: BloqueioTurno | null;
}) {
  const cor = COR_TURNO[celula.status];
  const ocupacao = Math.min(1, Math.max(celula.horasPrevistas, celula.horasRealizadas) / HORAS_POR_TURNO);
  const tituloBloqueio = bloqueio
    ? `Agenda bloqueada${bloqueio.horas < HORAS_POR_TURNO ? ` (${horasCurtas(bloqueio.horas)} do turno)` : ""}: ${bloqueio.motivos.join(", ")}`
    : "";

  if (celula.status === "livre") {
    if (bloqueio) {
      return (
        <div
          className="flex h-full min-h-[46px] w-full items-center justify-center gap-1 overflow-hidden rounded-md border border-[#c9cfdd] px-1 text-[10px] font-bold text-[#4d5670]"
          style={{ background: FUNDO_BLOQUEIO }}
          title={tituloBloqueio}
        >
          <Lock size={11} className="shrink-0" />
          {!compacto && <span className="truncate">{bloqueio.horas < HORAS_POR_TURNO ? horasCurtas(bloqueio.horas) : "Bloqueado"}</span>}
        </div>
      );
    }
    return <div className={`h-full min-h-[46px] w-full rounded-md border ${cor.borda} ${cor.fundo}`} title="Livre" />;
  }

  // Previsto/realizado num turno bloqueado: cadeado vermelho (conflito a corrigir no cronograma ou no bloqueio).
  const seloBloqueio = bloqueio && (
    <span className="absolute top-0.5 right-0.5 rounded bg-[#b5392a] p-[2px] text-white" title={tituloBloqueio}>
      <Lock size={8} />
    </span>
  );

  const projetosDoTurno = Array.from(new Set(celula.itens.map((i) => tituloProjeto(i.alocacao.projetoId, projetos, clientes))));
  const rotulo = `${ROTULO_STATUS[celula.status]} · ${formatarHoras(celula.horasPrevistas)} previstas${
    celula.horasRealizadas > 0 ? ` · ${formatarHoras(celula.horasRealizadas)} realizadas` : ""
  }`;

  if (compacto) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        title={`${projetosDoTurno.join(", ")} — ${rotulo}${bloqueio ? ` — ${tituloBloqueio}` : ""}`}
        className={`relative flex h-full min-h-[46px] w-full items-center justify-center overflow-hidden rounded-md border text-[10px] font-bold text-brand-navy-2 ${cor.borda} ${cor.fundo}`}
      >
        {horasCurtas(Math.max(celula.horasPrevistas, celula.horasRealizadas))}
        {seloBloqueio}
        <span className={`absolute right-0 bottom-0 left-0 h-[3px] ${cor.barra}`} style={{ width: `${ocupacao * 100}%` }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onAbrir}
      title={bloqueio ? `${rotulo} — ${tituloBloqueio}` : rotulo}
      className={`relative flex h-full min-h-[46px] w-full flex-col items-start justify-center gap-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left ${cor.borda} ${cor.fundo}`}
    >
      {celula.itens.length > 0 ? (
        <>
          <span className="w-full truncate text-[10.5px] leading-tight font-bold text-brand-navy-2">{projetosDoTurno[0]}</span>
          <span className="w-full truncate text-[9.5px] leading-tight text-brand-muted">
            {celula.itens.length === 1
              ? celula.itens[0].alocacao.atividadeDescricao
              : `${celula.itens.length} tarefas${projetosDoTurno.length > 1 ? ` · +${projetosDoTurno.length - 1} projeto` : ""}`}
          </span>
        </>
      ) : (
        <span className="text-[10.5px] font-bold text-[#15754c]">Realizado</span>
      )}
      <span className="flex items-center gap-1 text-[9.5px] font-semibold text-brand-muted">
        {celula.horasPrevistas > 0 ? `${horasCurtas(celula.horasPrevistas)}/${HORAS_POR_TURNO}h` : ""}
        {celula.horasRealizadas > 0 && (
          <span className="text-[#15754c]">✔ {horasCurtas(celula.horasRealizadas)}</span>
        )}
        {celula.status === "sobreposicao" && (
          <span className="rounded-full bg-[#b5392a] px-1 text-[8.5px] font-bold text-white">excesso</span>
        )}
      </span>
      <span className={`absolute right-0 bottom-0 left-0 h-[3px] ${cor.barra}`} style={{ width: `${ocupacao * 100}%` }} />
      {seloBloqueio}
    </button>
  );
}

/** Conteúdo do modal de detalhes de um turno. */
export function DetalhesTurno({
  celula,
  periodo,
  data,
  recursoNome,
  projetos,
  clientes,
  bloqueio,
}: {
  celula: CelulaTurno;
  periodo: "manha" | "tarde";
  data: string;
  recursoNome: string;
  projetos: Projeto[];
  clientes: Cliente[];
  bloqueio?: BloqueioTurno | null;
}) {
  const [ano, mes, dia] = data.split("-");
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-brand-muted">
        <strong className="text-brand-navy-2">{recursoNome}</strong> · {dia}/{mes}/{ano} · {PERIODO_LABEL[periodo]}
      </p>
      <div className="flex flex-wrap gap-2 text-[12px]">
        <span className="rounded-full bg-brand-accent-soft px-2.5 py-1 font-bold text-brand-accent">
          {formatarHoras(celula.horasPrevistas)} previstas de {HORAS_POR_TURNO}h
        </span>
        {celula.horasRealizadas > 0 && (
          <span className="rounded-full bg-[#e3f5ea] px-2.5 py-1 font-bold text-[#15754c]">
            {formatarHoras(celula.horasRealizadas)} realizadas
          </span>
        )}
        {celula.status === "sobreposicao" && (
          <span className="rounded-full bg-[#fdeceb] px-2.5 py-1 font-bold text-[#b5392a]">Turno com excesso de horas</span>
        )}
      </div>
      {bloqueio && (
        <p className="flex items-center gap-2 rounded-md border border-[#c9cfdd] px-3 py-2 text-[12.5px] text-[#4d5670]" style={{ background: FUNDO_BLOQUEIO }}>
          <Lock size={13} className="shrink-0" />
          <span>
            <strong>Agenda bloqueada</strong>
            {bloqueio.horas < HORAS_POR_TURNO ? ` (${formatarHoras(bloqueio.horas)} do turno)` : ""}: {bloqueio.motivos.join(", ")}
            {celula.itens.length > 0 ? " — há tarefa prevista neste turno; ajuste o cronograma ou o bloqueio." : ""}
          </span>
        </p>
      )}
      {celula.itens.length === 0 && <p className="text-[13px] text-brand-faint">Sem tarefas previstas neste turno.</p>}
      <div className="divide-y divide-brand-border-soft rounded-xl border border-brand-border">
        {celula.itens.map((item, i) => (
          <div key={`${item.alocacao.atividadeId}-${i}`} className="px-3.5 py-2.5">
            <p className="text-[13px] font-bold text-brand-navy-2">{item.alocacao.atividadeDescricao}</p>
            <p className="text-[12px] text-brand-muted">
              {tituloProjeto(item.alocacao.projetoId, projetos, clientes)} — {item.alocacao.projetoNome}
            </p>
            <p className="text-[11.5px] text-brand-faint">
              {formatarHoras(item.horas)} neste turno
              {item.alocacao.horasPrevistas > item.horas ? ` (tarefa de ${formatarHoras(item.alocacao.horasPrevistas)} no total)` : ""} ·
              Grupo: {item.alocacao.grupoDescricao}
              {item.alocacao.periodoAssumido ? " · período não informado (assumido manhã)" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
