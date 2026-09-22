"use client";

import { useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { EnvolvidosFields } from "@/components/projetos/EnvolvidosFields";
import { EscopoSelector } from "@/components/projetos/EscopoSelector";
import { FinanceiroFields, type FinanceiroFieldsHandle } from "@/components/projetos/FinanceiroFields";
import { useAuth } from "@/contexts/AuthContext";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { MODULOS, TIPOS_ATENDIMENTO, type EnvolvidoChave, type Escopo, type EscopoAtividade, type ExclusaoEscopo, type Financeiro, type Modulo, type Projeto, type Recurso, type TipoAtendimento, type TipoDocumento } from "@/types";

function formatarDataHoraCurta(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CancelarProjetoSecao({ projeto, onCancelado }: { projeto: Projeto; onCancelado: () => void }) {
  const { usuario } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (projeto.status === "cancelado") {
    return (
      <div className="rounded-xl border border-[#f5c6bd] bg-[#fdeceb] p-4">
        <p className="text-sm font-bold text-[#b5392a]">Projeto cancelado</p>
        {projeto.cancelamento && (
          <p className="mt-1 text-[12.5px] text-[#b5392a]">
            <span className="opacity-75">
              {formatarDataHoraCurta(projeto.cancelamento.criadoEm)} · {projeto.cancelamento.usuarioNome}:
            </span>{" "}
            {projeto.cancelamento.motivo}
          </p>
        )}
      </div>
    );
  }

  async function confirmarCancelamento() {
    if (!usuario) return;
    if (!motivo.trim()) {
      setErro("Informe o motivo do cancelamento.");
      return;
    }
    setSalvando(true);
    try {
      await updateDoc(doc(db, "projetos", projeto.id), {
        status: "cancelado",
        cancelamento: {
          motivo: motivo.trim(),
          usuarioNome: usuario.nomeCompleto,
          criadoEm: Date.now(),
        },
        updatedAt: serverTimestamp(),
      });
      onCancelado();
    } catch (err) {
      console.error("Falha ao cancelar projeto:", err);
      setErro("Não foi possível cancelar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
      <p className="mb-2 text-sm font-bold text-[#b5392a]">Cancelar projeto</p>
      {!confirmando ? (
        <Button type="button" variant="danger" onClick={() => setConfirmando(true)}>
          Cancelar projeto
        </Button>
      ) : (
        <div className="space-y-3">
          <FormRow label="Motivo do cancelamento (obrigatório)">
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              required
              autoFocus
            />
          </FormRow>
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setConfirmando(false);
                setMotivo("");
                setErro("");
              }}
            >
              Voltar
            </Button>
            <Button type="button" variant="danger" onClick={confirmarCancelamento} disabled={salvando}>
              {salvando ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reeditar valor/descrição não pode apagar o que já aconteceu com a parcela (status, nota
 * fiscal, datas de liberação/recebimento/previsão etc.) — só quando o número de parcelas muda
 * é que a lista é mesmo recriada do zero.
 */
function financeiroComStatusPreservado(anterior: Financeiro, novo: Financeiro): Financeiro {
  if (
    anterior.tipoFaturamento === novo.tipoFaturamento &&
    anterior.parcelas.length === novo.parcelas.length
  ) {
    return {
      ...novo,
      parcelas: novo.parcelas.map((p, i) => ({ ...anterior.parcelas[i], valor: p.valor, descricao: p.descricao, tipoDocumentoId: p.tipoDocumentoId })),
    };
  }
  return novo;
}

function EditarProjetoForm({
  projeto,
  onClose,
  recursos,
  tiposDocumento,
  escopos,
}: {
  projeto: Projeto;
  onClose: () => void;
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
  escopos: Escopo[];
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
  const [contatoNome, setContatoNome] = useState(projeto.contatoFaturamento?.nome ?? "");
  const [contatoCnpj, setContatoCnpj] = useState(projeto.contatoFaturamento?.cnpj ?? "");
  const [contatoEmail, setContatoEmail] = useState(projeto.contatoFaturamento?.email ?? "");
  const [contatoTelefone, setContatoTelefone] = useState(projeto.contatoFaturamento?.telefone ?? "");
  const [contatoEmailNF, setContatoEmailNF] = useState(projeto.contatoFaturamento?.emailNF ?? "");
  const [contatoMemo, setContatoMemo] = useState(projeto.contatoFaturamento?.memo ?? "");
  const [envolvidos, setEnvolvidos] = useState<EnvolvidoChave[]>(projeto.principaisEnvolvidos ?? []);
  const [escopoId, setEscopoId] = useState<string | null>(projeto.escopoId ?? null);
  const [escopoNome, setEscopoNome] = useState<string | null>(projeto.escopoNome ?? null);
  const [escopoAtividades, setEscopoAtividades] = useState<EscopoAtividade[]>(
    projeto.escopoAtividades ?? []
  );
  const [escopoExclusoes, setEscopoExclusoes] = useState<ExclusaoEscopo[]>(
    projeto.escopoExclusoes ?? []
  );
  const [salvando, setSalvando] = useState(false);
  const financeiroRef = useRef<FinanceiroFieldsHandle>(null);

  async function selecionarEscopo(escopo: Escopo, atividades: EscopoAtividade[], exclusoes: ExclusaoEscopo[]) {
    await updateDoc(doc(db, "projetos", projeto.id), {
      escopoId: escopo.id,
      escopoNome: escopo.nome,
      escopoAtividades: atividades,
      escopoExclusoes: exclusoes.length > 0 ? exclusoes : null,
      updatedAt: serverTimestamp(),
    });
    setEscopoId(escopo.id);
    setEscopoNome(escopo.nome);
    setEscopoAtividades(atividades);
    setEscopoExclusoes(exclusoes);
  }

  async function removerEscopo() {
    await updateDoc(doc(db, "projetos", projeto.id), {
      escopoId: null,
      escopoNome: null,
      escopoAtividades: null,
      escopoExclusoes: null,
      updatedAt: serverTimestamp(),
    });
    setEscopoId(null);
    setEscopoNome(null);
    setEscopoAtividades([]);
    setEscopoExclusoes([]);
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
        escopoId,
        escopoNome,
        escopoAtividades: escopoAtividades.length > 0 ? escopoAtividades : null,
        escopoExclusoes: escopoExclusoes.length > 0 ? escopoExclusoes : null,
        principaisEnvolvidos:
          envolvidos.filter((e) => e.nome.trim()).length > 0
            ? envolvidos.filter((e) => e.nome.trim())
            : null,
        contatoFaturamento: {
          nome: contatoNome,
          cnpj: contatoCnpj,
          email: contatoEmail,
          telefone: contatoTelefone,
          emailNF: contatoEmailNF,
          memo: contatoMemo,
        },
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

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Escopo do projeto (opcional)</p>
        <EscopoSelector
          escopos={escopos}
          escopoIdAtual={escopoId}
          escopoNomeAtual={escopoNome}
          exclusoesAtuais={escopoExclusoes}
          onSelecionar={selecionarEscopo}
          onRemover={removerEscopo}
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

      <FinanceiroFields
        ref={financeiroRef}
        financeiroInicial={projeto.financeiro}
        tiposDocumento={tiposDocumento}
      />

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

      <EnvolvidosFields envolvidos={envolvidos} onChange={setEnvolvidos} />

      <CancelarProjetoSecao projeto={projeto} onCancelado={onClose} />

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
  escopos,
}: {
  projeto: Projeto | null;
  onClose: () => void;
  recursos: Recurso[];
  tiposDocumento: TipoDocumento[];
  escopos: Escopo[];
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
          escopos={escopos}
        />
      )}
    </Modal>
  );
}
