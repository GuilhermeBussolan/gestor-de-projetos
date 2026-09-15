"use client";

import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STATUS_DOCUMENTO_CONFIG, STATUS_DOCUMENTO_ORDEM, TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { calcularPercentualProjeto } from "@/lib/dashboardCalc";
import type { Cliente, Projeto, Recurso, StatusDocumento } from "@/types";

export function ProjetoCard({
  projeto,
  cliente,
  coordenador,
  consultores,
  destacado,
  podeEditar,
  onEditar,
  onExcluir,
}: {
  projeto: Projeto;
  cliente: Cliente | undefined;
  coordenador: Recurso | undefined;
  consultores: Recurso[];
  destacado: boolean;
  podeEditar: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const percentual = calcularPercentualProjeto(projeto.documentos);

  async function alterarStatus(tipoDocumentoId: string, status: StatusDocumento) {
    const documentos = projeto.documentos.map((d) =>
      d.tipoDocumentoId === tipoDocumentoId ? { ...d, status } : d
    );
    await updateDoc(doc(db, "projetos", projeto.id), { documentos, updatedAt: serverTimestamp() });
  }

  return (
    <div
      id={`projeto-${projeto.id}`}
      className={`rounded-lg border bg-white p-5 shadow-sm transition-shadow ${
        destacado ? "border-sky-500 ring-2 ring-sky-300" : "border-slate-200"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="space-y-1 text-sm">
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">{cliente?.nomeFantasia ?? "—"}</span>
            {" · "}
            {cliente?.modulo} · {cliente?.tipoAtendimento} ·{" "}
            {coordenador ? (
              <>
                Coordenador: {coordenador.nomeCompleto} ({coordenador.codigo})
              </>
            ) : (
              "Sem coordenador"
            )}
          </p>
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">{cliente?.nomeFantasia ?? "—"}</span>
            {" · "}
            {cliente?.modulo} · {cliente?.tipoAtendimento} ·{" "}
            {consultores.length > 0
              ? consultores
                  .map((c) => `${c.nomeCompleto} (${c.codigo}) — ${TIPO_RECURSO_CONFIG[c.tipo].label}`)
                  .join("; ")
              : "Sem consultor"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-lg font-semibold text-slate-900">{percentual}%</span>
          {podeEditar && (
            <div className="flex gap-2 text-sm">
              <button onClick={onEditar} className="text-sky-600 hover:underline">
                Editar
              </button>
              <button onClick={onExcluir} className="text-red-600 hover:underline">
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        {projeto.documentos.map((d) => (
          <div key={d.tipoDocumentoId} className="flex items-center gap-3 text-sm">
            <select
              value={d.status}
              disabled={!podeEditar}
              onChange={(e) => alterarStatus(d.tipoDocumentoId, e.target.value as StatusDocumento)}
              style={{
                backgroundColor: STATUS_DOCUMENTO_CONFIG[d.status].color,
              }}
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

      {projeto.observacoes && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
          {projeto.observacoes}
        </p>
      )}
    </div>
  );
}
