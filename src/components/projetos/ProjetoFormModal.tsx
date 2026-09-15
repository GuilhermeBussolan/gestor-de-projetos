"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { MODULOS, TIPOS_ATENDIMENTO, type Cliente, type Modulo, type Recurso, type TipoAtendimento, type TipoDocumento } from "@/types";

function ProjetoForm({
  onClose,
  clientes,
  recursos,
  tiposDocumento,
}: {
  onClose: () => void;
  clientes: Cliente[];
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [codigoProposta, setCodigoProposta] = useState("");
  const [modulo, setModulo] = useState<Modulo>(MODULOS[0]);
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>(TIPOS_ATENDIMENTO[0]);
  const [coordenadorId, setCoordenadorId] = useState("");
  const [consultorIds, setConsultorIds] = useState<string[]>([]);
  const [documentoIds, setDocumentoIds] = useState<string[]>(tiposDocumento.map((t) => t.id));
  const [observacoes, setObservacoes] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState("");
  const [salvando, setSalvando] = useState(false);

  const coordenadores = recursos.filter((r) => r.tipo === "coordenador");
  const consultoresDisponiveis = recursos.filter((r) => r.tipo !== "coordenador");

  function toggleConsultor(id: string) {
    setConsultorIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function toggleDocumento(id: string) {
    setDocumentoIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }

  const valorTotalNumero = Number(valorTotal) || 0;
  const numeroParcelasNumero = Math.max(1, Number(numeroParcelas) || 1);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return;
    setSalvando(true);
    try {
      const documentos = tiposDocumento
        .filter((t) => documentoIds.includes(t.id))
        .map((t) => ({
          tipoDocumentoId: t.id,
          codigo: t.codigo,
          descricao: t.descricao,
          pesoIndividual: t.pesoIndividual,
          status: "A_INICIAR" as const,
        }));

      const valorParcela =
        Math.round((valorTotalNumero / numeroParcelasNumero) * 100) / 100;
      const parcelas = Array.from({ length: numeroParcelasNumero }, (_, i) => ({
        numero: i + 1,
        valor: valorParcela,
        status: "LIBERADO" as const,
      }));

      await addDoc(collection(db, "projetos"), {
        clienteId,
        codigoProposta,
        modulo,
        tipoAtendimento,
        coordenadorId: coordenadorId || null,
        consultorIds,
        documentos,
        observacoes,
        financeiro: { valorTotal: valorTotalNumero, numeroParcelas: numeroParcelasNumero, parcelas },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <FormRow label="Cliente">
        <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
          <option value="">Selecione...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {nomeExibicaoCliente(c)}
              {c.cnpj ? ` — ${c.cnpj}` : ""}
            </option>
          ))}
        </Select>
      </FormRow>

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
        <p className="mb-1 text-sm font-medium text-slate-700">Consultores (opcional, múltiplos)</p>
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
          {consultoresDisponiveis.length === 0 && (
            <p className="text-xs text-slate-400">Nenhum consultor cadastrado.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Documentos do projeto</p>
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

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Financeiro</p>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Valor total do projeto (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              required
            />
          </FormRow>
          <FormRow label="Número de parcelas">
            <Input
              type="number"
              min="1"
              placeholder="1"
              value={numeroParcelas}
              onChange={(e) => setNumeroParcelas(e.target.value)}
              required
            />
          </FormRow>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {numeroParcelasNumero}x de{" "}
          {(valorTotalNumero / numeroParcelasNumero).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Criar projeto"}
        </Button>
      </div>
    </form>
  );
}

export function ProjetoFormModal({
  open,
  onClose,
  clientes,
  recursos,
  tiposDocumento,
}: {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo projeto" wide>
      {open && (
        <ProjetoForm onClose={onClose} clientes={clientes} recursos={recursos} tiposDocumento={tiposDocumento} />
      )}
    </Modal>
  );
}
