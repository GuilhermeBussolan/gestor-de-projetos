"use client";

import { useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { ClienteCombobox } from "@/components/projetos/ClienteCombobox";
import { EscopoSelector } from "@/components/projetos/EscopoSelector";
import { FinanceiroFields, type FinanceiroFieldsHandle } from "@/components/projetos/FinanceiroFields";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { MODULOS, TIPOS_ATENDIMENTO, type Cliente, type Escopo, type EscopoAtividade, type Modulo, type Recurso, type TipoAtendimento, type TipoDocumento } from "@/types";

function ProjetoForm({
  onClose,
  clientes,
  recursos,
  tiposDocumento,
  escopos,
}: {
  onClose: () => void;
  clientes: Cliente[];
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
  escopos: Escopo[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [codigoProposta, setCodigoProposta] = useState("");
  const [modulo, setModulo] = useState<Modulo>(MODULOS[0]);
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>(TIPOS_ATENDIMENTO[0]);
  const [coordenadorId, setCoordenadorId] = useState("");
  const [consultorIds, setConsultorIds] = useState<string[]>([]);
  const [documentoIds, setDocumentoIds] = useState<string[]>(tiposDocumento.map((t) => t.id));
  const [observacoes, setObservacoes] = useState("");
  const [horasPrevistasConsultor, setHorasPrevistasConsultor] = useState("");
  const [horasPrevistasCoordenador, setHorasPrevistasCoordenador] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoCnpj, setContatoCnpj] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [contatoEmailNF, setContatoEmailNF] = useState("");
  const [contatoMemo, setContatoMemo] = useState("");
  const [escopoId, setEscopoId] = useState<string | null>(null);
  const [escopoNome, setEscopoNome] = useState<string | null>(null);
  const [escopoAtividades, setEscopoAtividades] = useState<EscopoAtividade[]>([]);
  const [salvando, setSalvando] = useState(false);
  const financeiroRef = useRef<FinanceiroFieldsHandle>(null);

  function selecionarEscopo(escopo: Escopo) {
    setEscopoId(escopo.id);
    setEscopoNome(escopo.nome);
    setEscopoAtividades(escopo.atividades);
  }

  function removerEscopo() {
    setEscopoId(null);
    setEscopoNome(null);
    setEscopoAtividades([]);
  }

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
    if (!clienteId || !financeiroRef.current) return;
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

      await addDoc(collection(db, "projetos"), {
        clienteId,
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
        status: "ativo",
        escopoId,
        escopoNome,
        escopoAtividades: escopoAtividades.length > 0 ? escopoAtividades : null,
        contatoFaturamento: {
          nome: contatoNome,
          cnpj: contatoCnpj,
          email: contatoEmail,
          telefone: contatoTelefone,
          emailNF: contatoEmailNF,
          memo: contatoMemo,
        },
        financeiro: financeiroRef.current.obterFinanceiro(),
        ultimoContato: null,
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
        <ClienteCombobox clientes={clientes} value={clienteId} onChange={setClienteId} required />
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
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Consultores (opcional, múltiplos)</p>
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
          {consultoresDisponiveis.length === 0 && (
            <p className="text-xs text-brand-faint">Nenhum consultor cadastrado.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Documentos do projeto</p>
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

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Escopo do projeto (opcional)</p>
        <EscopoSelector
          escopos={escopos}
          escopoIdAtual={escopoId}
          escopoNomeAtual={escopoNome}
          onSelecionar={selecionarEscopo}
          onRemover={removerEscopo}
          persisteAoConfirmar={false}
        />
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

      <FinanceiroFields ref={financeiroRef} tiposDocumento={tiposDocumento} />

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy-2">
          Contato de faturamento (opcional)
        </p>
        <div className="grid grid-cols-2 gap-4 rounded-md border border-brand-border p-3">
          <FormRow label="Contato (nome)">
            <Input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} />
          </FormRow>
          <FormRow label="CNPJ de faturamento">
            <Input value={contatoCnpj} onChange={(e) => setContatoCnpj(e.target.value)} />
          </FormRow>
          <FormRow label="E-mail">
            <Input type="email" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} />
          </FormRow>
          <FormRow label="Telefone">
            <Input value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} />
          </FormRow>
          <FormRow label="E-mail para envio da NF">
            <Input
              type="email"
              value={contatoEmailNF}
              onChange={(e) => setContatoEmailNF(e.target.value)}
            />
          </FormRow>
          <div className="col-span-2">
            <FormRow label="Observações sobre faturamento">
              <Textarea rows={2} value={contatoMemo} onChange={(e) => setContatoMemo(e.target.value)} />
            </FormRow>
          </div>
        </div>
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
  escopos,
}: {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
  escopos: Escopo[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo projeto" wide>
      {open && (
        <ProjetoForm
          onClose={onClose}
          clientes={clientes}
          recursos={recursos}
          tiposDocumento={tiposDocumento}
          escopos={escopos}
        />
      )}
    </Modal>
  );
}
