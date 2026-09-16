"use client";

import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  STATUS_DOCUMENTO_CONFIG,
  STATUS_DOCUMENTO_ORDEM,
  TIPO_FATURAMENTO_CONFIG,
  TIPO_RECURSO_CONFIG,
} from "@/lib/constants";
import { calcularHorasRealizadas, calcularPercentualProjeto, corFaixaProgresso } from "@/lib/dashboardCalc";
import type { EventoCalendario, Projeto, Recurso, StatusDocumento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProjetoDrawerConteudo({
  projeto,
  coordenador,
  consultores,
  eventos,
  recursos,
  podeEditar,
  onEditar,
  onExcluir,
}: {
  projeto: Projeto;
  coordenador: Recurso | undefined;
  consultores: Recurso[];
  eventos: EventoCalendario[];
  recursos: Recurso[];
  podeEditar: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const percentual = calcularPercentualProjeto(projeto.documentos);
  const cor = corFaixaProgresso(percentual);
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
    <div className="space-y-5">
      <div>
        <p className="text-sm text-slate-500">
          {projeto.codigoProposta} · {projeto.modulo} · {projeto.tipoAtendimento}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Coordenador:{" "}
          {coordenador ? `${coordenador.nomeCompleto} (${coordenador.codigo})` : "Sem coordenador"}
        </p>
        <p className="text-sm text-slate-700">
          Consultores:{" "}
          {consultores.length > 0
            ? consultores
                .map((c) => `${c.nomeCompleto} (${c.codigo}) — ${TIPO_RECURSO_CONFIG[c.tipo].label}`)
                .join("; ")
            : "Sem consultor"}
        </p>
        {podeEditar && (
          <div className="mt-3 flex gap-3 text-sm">
            <button onClick={onEditar} className="text-sky-600 hover:underline">
              Editar projeto
            </button>
            <button onClick={onExcluir} className="text-red-600 hover:underline">
              Excluir projeto
            </button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Andamento</p>
          <span className="text-lg font-semibold" style={{ color: cor }}>
            {percentual}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full" style={{ width: `${percentual}%`, backgroundColor: cor }} />
        </div>
      </div>

      {(previstoConsultor > 0 || previstoCoordenador > 0 || horas.consultor > 0 || horas.coordenador > 0) && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">Horas previstas x realizadas</p>
          <div className="space-y-1 text-sm text-slate-600">
            <p>
              Consultor: <strong>{horas.consultor.toFixed(1)}h</strong>
              {previstoConsultor > 0 && ` de ${previstoConsultor.toFixed(1)}h previstas`}
            </p>
            <p>
              Coordenador: <strong>{horas.coordenador.toFixed(1)}h</strong>
              {previstoCoordenador > 0 && ` de ${previstoCoordenador.toFixed(1)}h previstas`}
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Documentos</p>
        <div className="space-y-1.5">
          {projeto.documentos.map((d) => (
            <div key={d.tipoDocumentoId} className="flex items-center gap-3 text-sm">
              <select
                value={d.status}
                disabled={!podeEditar}
                onChange={(e) => alterarStatus(d.tipoDocumentoId, e.target.value as StatusDocumento)}
                style={{ backgroundColor: STATUS_DOCUMENTO_CONFIG[d.status].color }}
                className="w-36 shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900 disabled:opacity-80"
              >
                {STATUS_DOCUMENTO_ORDEM.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_DOCUMENTO_CONFIG[s].label}
                  </option>
                ))}
              </select>
              <span className="text-slate-700">
                {d.codigo} — {d.descricao}
              </span>
            </div>
          ))}
          {projeto.documentos.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum documento incluído neste projeto.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Financeiro — {TIPO_FATURAMENTO_CONFIG[projeto.financeiro?.tipoFaturamento ?? "parcelado"].label}
        </p>
        {projeto.financeiro?.tipoFaturamento === "apontamento_horas" ? (
          <p className="text-sm text-slate-400">Faturamento por apontamento de horas.</p>
        ) : (
          <p className="text-sm text-slate-600">
            {moeda(projeto.financeiro?.valorTotal ?? 0)} em {projeto.financeiro?.numeroParcelas ?? 0}x
          </p>
        )}
      </div>

      {projeto.observacoes && (
        <div>
          <p className="mb-1 text-sm font-semibold text-slate-700">Observações</p>
          <p className="text-sm text-slate-600">{projeto.observacoes}</p>
        </div>
      )}
    </div>
  );
}
