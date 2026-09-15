"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Select, Textarea } from "@/components/ui/Field";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import type { Projeto, Recurso, TipoDocumento } from "@/types";

function EditarProjetoForm({
  projeto,
  onClose,
  recursos,
  tiposDocumento,
}: {
  projeto: Projeto;
  onClose: () => void;
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
}) {
  const [coordenadorId, setCoordenadorId] = useState(projeto.coordenadorId ?? "");
  const [consultorIds, setConsultorIds] = useState<string[]>(projeto.consultorIds ?? []);
  const [documentoIds, setDocumentoIds] = useState<string[]>(
    projeto.documentos.map((d) => d.tipoDocumentoId)
  );
  const [observacoes, setObservacoes] = useState(projeto.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);

  const coordenadores = recursos.filter((r) => r.tipo === "coordenador");
  const consultoresDisponiveis = recursos.filter((r) => r.tipo !== "coordenador");

  function toggleConsultor(id: string) {
    setConsultorIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function toggleDocumento(id: string) {
    setDocumentoIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const documentos = documentoIds.map((tipoDocumentoId) => {
        const existente = projeto.documentos.find((d) => d.tipoDocumentoId === tipoDocumentoId);
        if (existente) return existente;
        const tipo = tiposDocumento.find((t) => t.id === tipoDocumentoId)!;
        return {
          tipoDocumentoId: tipo.id,
          codigo: tipo.codigo,
          descricao: tipo.descricao,
          pesoIndividual: tipo.pesoIndividual,
          status: "ANDAMENTO" as const,
        };
      });

      await updateDoc(doc(db, "projetos", projeto.id), {
        coordenadorId: coordenadorId || null,
        consultorIds,
        documentos,
        observacoes,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <FormRow label="Coordenador (opcional)">
        <Select value={coordenadorId} onChange={(e) => setCoordenadorId(e.target.value)}>
          <option value="">Nenhum</option>
          {coordenadores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nomeCompleto} ({c.codigo})
            </option>
          ))}
        </Select>
      </FormRow>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Consultores</p>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-300 p-2">
          {consultoresDisponiveis.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consultorIds.includes(c.id)}
                onChange={() => toggleConsultor(c.id)}
              />
              {c.nomeCompleto} ({c.codigo}) — {TIPO_RECURSO_CONFIG[c.tipo].label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">
          Documentos (documentos já existentes mantêm o status; novos entram como Andamento)
        </p>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-300 p-2">
          {tiposDocumento.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={documentoIds.includes(t.id)}
                onChange={() => toggleDocumento(t.id)}
              />
              {t.codigo} — {t.descricao}
            </label>
          ))}
        </div>
      </div>

      <FormRow label="Observações gerais">
        <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </FormRow>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

export function EditarProjetoModal({
  projeto,
  onClose,
  recursos,
  tiposDocumento,
}: {
  projeto: Projeto | null;
  onClose: () => void;
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
}) {
  return (
    <Modal open={!!projeto} onClose={onClose} title="Editar projeto" wide>
      {projeto && (
        <EditarProjetoForm
          key={projeto.id}
          projeto={projeto}
          onClose={onClose}
          recursos={recursos}
          tiposDocumento={tiposDocumento}
        />
      )}
    </Modal>
  );
}
