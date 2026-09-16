"use client";

import { useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { FinanceiroFields, type FinanceiroFieldsHandle } from "@/components/projetos/FinanceiroFields";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { MODULOS, TIPOS_ATENDIMENTO, type Financeiro, type Modulo, type Projeto, type Recurso, type TipoAtendimento, type TipoDocumento } from "@/types";

function financeiroComStatusPreservado(anterior: Financeiro, novo: Financeiro): Financeiro {
  if (
    anterior.tipoFaturamento === novo.tipoFaturamento &&
    anterior.parcelas.length === novo.parcelas.length
  ) {
    return {
      ...novo,
      parcelas: novo.parcelas.map((p, i) => ({ ...p, status: anterior.parcelas[i].status })),
    };
  }
  return novo;
}

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
  const [codigoProposta, setCodigoProposta] = useState(projeto.codigoProposta ?? "");
  const [modulo, setModulo] = useState<Modulo>(projeto.modulo ?? MODULOS[0]);
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>(
    projeto.tipoAtendimento ?? TIPOS_ATENDIMENTO[0]
  );
  const [coordenadorId, setCoordenadorId] = useState(projeto.coordenadorId ?? "");
  const [consultorIds, setConsultorIds] = useState<string[]>(projeto.consultorIds ?? []);
  const [documentoIds, setDocumentoIds] = useState<string[]>(
    projeto.documentos.map((d) => d.tipoDocumentoId)
  );
  const [observacoes, setObservacoes] = useState(projeto.observacoes ?? "");
  const [horasPrevistasConsultor, setHorasPrevistasConsultor] = useState(
    projeto.horasPrevistasConsultor ? String(projeto.horasPrevistasConsultor) : ""
  );
  const [horasPrevistasCoordenador, setHorasPrevistasCoordenador] = useState(
    projeto.horasPrevistasCoordenador ? String(projeto.horasPrevistasCoordenador) : ""
  );
  const [dataInicio, setDataInicio] = useState(projeto.dataInicio ?? "");
  const [dataFim, setDataFim] = useState(projeto.dataFim ?? "");
  const [salvando, setSalvando] = useState(false);
  const financeiroRef = useRef<FinanceiroFieldsHandle>(null);

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
    if (!financeiroRef.current) return;
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
          status: "A_INICIAR" as const,
        };
      });

      const financeiro = financeiroComStatusPreservado(
        projeto.financeiro,
        financeiroRef.current.obterFinanceiro()
      );

      await updateDoc(doc(db, "projetos", projeto.id), {
        codigoProposta,
        modulo,
        tipoAtendimento,
        coordenadorId: coordenadorId || null,
        consultorIds,
        documentos,
        observacoes,
        horasPrevistasConsultor: Number(horasPrevistasConsultor) || 0,
        horasPrevistasCoordenador: Number(horasPrevistasCoordenador) || 0,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        financeiro,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="Código da proposta">
          <Input
            value={codigoProposta}
            onChange={(e) => setCodigoProposta(e.target.value)}
            required
          />
        </FormRow>
        <FormRow label="Módulo de atendimento">
          <Select value={modulo} onChange={(e) => setModulo(e.target.value as Modulo)}>
            {MODULOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Tipo de atendimento">
          <Select
            value={tipoAtendimento}
            onChange={(e) => setTipoAtendimento(e.target.value as TipoAtendimento)}
          >
            {TIPOS_ATENDIMENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>

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
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Consultores</p>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-brand-border p-2">
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
        <p className="mb-1 text-sm font-medium text-brand-navy-2">
          Documentos (documentos já existentes mantêm o status; novos entram como A iniciar)
        </p>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-brand-border p-2">
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

      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Horas estimadas de consultor">
          <Input
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            value={horasPrevistasConsultor}
            onChange={(e) => setHorasPrevistasConsultor(e.target.value)}
          />
        </FormRow>
        <FormRow label="Horas estimadas de coordenador">
          <Input
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            value={horasPrevistasCoordenador}
            onChange={(e) => setHorasPrevistasCoordenador(e.target.value)}
          />
        </FormRow>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Data de início">
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
          />
        </FormRow>
        <FormRow label="Data de término (opcional, enquanto o projeto não finaliza)">
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </FormRow>
      </div>

      <FinanceiroFields
        ref={financeiroRef}
        financeiroInicial={projeto.financeiro}
        tiposDocumento={tiposDocumento}
      />

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
