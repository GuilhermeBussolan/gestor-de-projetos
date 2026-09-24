"use client";

import { useRef, useState } from "react";
import { addDoc, collection, orderBy, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { ImportarCronogramaModal } from "@/components/importacao/ImportarCronogramaModal";
import { gravarVersaoInicialCronograma } from "@/lib/versaoCronogramaDb";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { ClienteCombobox } from "@/components/projetos/ClienteCombobox";
import { EnvolvidosFields } from "@/components/projetos/EnvolvidosFields";
import { EscopoSelector } from "@/components/projetos/EscopoSelector";
import { QrhFields } from "@/components/projetos/QrhFields";
import { FinanceiroFields, type FinanceiroFieldsHandle } from "@/components/projetos/FinanceiroFields";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { MODULOS, TIPOS_ATENDIMENTO, type Cliente, type DetalhesQRH, type EnvolvidoChave, type Escopo, type EscopoAtividade, type ExclusaoEscopo, type Modulo, type Projeto, type Recurso, type TipoAtendimento, type TipoDocumento } from "@/types";

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
  const [dataAssinaturaProposta, setDataAssinaturaProposta] = useState("");
  const [detalhesQRH, setDetalhesQRH] = useState<DetalhesQRH>({});
  const [contatoNome, setContatoNome] = useState("");
  const [contatoCnpj, setContatoCnpj] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");
  const [contatoEmailNF, setContatoEmailNF] = useState("");
  const [contatoMemo, setContatoMemo] = useState("");
  const [envolvidos, setEnvolvidos] = useState<EnvolvidoChave[]>([]);
  const [escopoId, setEscopoId] = useState<string | null>(null);
  const [escopoNome, setEscopoNome] = useState<string | null>(null);
  const [escopoAtividades, setEscopoAtividades] = useState<EscopoAtividade[]>([]);
  const [escopoExclusoes, setEscopoExclusoes] = useState<ExclusaoEscopo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const { usuario } = useAuth();
  // Cronograma importado já no cadastro (o projeto ainda não existe: a versão 1 é gravada junto com ele).
  const [cronogramaRascunho, setCronogramaRascunho] = useState<{ atividades: EscopoAtividade[]; arquivoNome: string; observacao: string } | null>(null);
  const [cronogramaAberto, setCronogramaAberto] = useState(false);
  const { data: todosProjetos } = useCollection<Projeto>("projetos", [orderBy("createdAt", "asc")], cronogramaAberto, [cronogramaAberto]);
  const financeiroRef = useRef<FinanceiroFieldsHandle>(null);
  // O coordenador não vê nada de financeiro: o projeto nasce com faturamento por apontamento e o financeiro ajusta depois.
  const veFinanceiro = usuario?.perfil !== "coordenador";

  function selecionarEscopo(escopo: Escopo, atividades: EscopoAtividade[], exclusoes: ExclusaoEscopo[]) {
    setEscopoId(escopo.id);
    setEscopoNome(escopo.nome);
    setEscopoAtividades(atividades);
    setEscopoExclusoes(exclusoes);
  }

  function usarCronograma(dados: { atividades: EscopoAtividade[]; arquivoNome: string; observacao: string }) {
    setCronogramaRascunho(dados);
    setEscopoId(null);
    setEscopoNome(null);
    setEscopoAtividades(dados.atividades);
    setEscopoExclusoes([]);
  }

  function removerCronograma() {
    setCronogramaRascunho(null);
    setEscopoAtividades([]);
  }

  function removerEscopo() {
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
    if (!clienteId || (veFinanceiro && !financeiroRef.current)) return;
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

      const ref = await addDoc(collection(db, "projetos"), {
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
        dataAssinaturaProposta: dataAssinaturaProposta || null,
        detalhesQRH:
          modulo === "QRH"
            ? {
                folha: detalhesQRH.folha ?? null,
                estoque: detalhesQRH.estoque ?? null,
                esocial: detalhesQRH.esocial ?? null,
              }
            : null,
        status: "ativo",
        escopoId,
        escopoNome,
        escopoAtividades: escopoAtividades.length > 0 ? escopoAtividades : null,
        cronogramaVersao: cronogramaRascunho ? 1 : null,
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
        financeiro: financeiroRef.current
          ? financeiroRef.current.obterFinanceiro()
          : { tipoFaturamento: "apontamento_horas", valorTotal: 0, numeroParcelas: 0, parcelas: [] },
        ultimoContato: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (cronogramaRascunho && usuario) {
        await gravarVersaoInicialCronograma({
          projetoId: ref.id,
          atividades: cronogramaRascunho.atividades,
          arquivoNome: cronogramaRascunho.arquivoNome,
          observacao: cronogramaRascunho.observacao,
          usuario,
        });
      }
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

      {modulo === "QRH" && <QrhFields valor={detalhesQRH} onChange={setDetalhesQRH} />}

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
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Cronograma do projeto (opcional)</p>
        {cronogramaRascunho ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#b9e2cb] bg-[#f1faf5] px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 text-[#15754c]">
              <CheckCircle2 size={16} />
              <span>
                <strong>Cronograma importado</strong> — {cronogramaRascunho.atividades.length} atividades
                <span className="text-[12px] text-brand-faint"> ({cronogramaRascunho.arquivoNome})</span>
              </span>
            </span>
            <span className="flex shrink-0 gap-3 text-[12.5px] font-semibold">
              <button type="button" onClick={() => setCronogramaAberto(true)} className="text-brand-accent hover:underline">
                Trocar
              </button>
              <button type="button" onClick={removerCronograma} className="text-red-600 hover:underline">
                Remover
              </button>
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {!escopoId && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => setCronogramaAberto(true)} className="h-9 px-3.5 text-[13px]">
                  <Upload size={15} />
                  Importar cronograma
                </Button>
                <span className="text-[12.5px] text-brand-faint">
                  A planilha traz as tarefas, durações e a agenda; vira a versão 1 do histórico do projeto.
                </span>
              </div>
            )}
            <div>
              <p className="mb-1 text-[12px] font-semibold text-brand-faint">
                {escopoId ? "Escopo-padrão vinculado" : "Ou parta de um escopo-padrão"}
              </p>
              <EscopoSelector
                escopos={escopos}
                escopoIdAtual={escopoId}
                escopoNomeAtual={escopoNome}
                onSelecionar={selecionarEscopo}
                onRemover={removerEscopo}
                persisteAoConfirmar={false}
                exclusoesAtuais={escopoExclusoes}
              />
            </div>
          </div>
        )}
        <ImportarCronogramaModal
          open={cronogramaAberto}
          rascunho
          projeto={
            {
              id: "novo-projeto",
              codigoProposta: codigoProposta || "Novo projeto",
              consultorIds,
              status: "ativo",
              escopoAtividades: null,
            } as unknown as Projeto
          }
          recursos={recursos}
          outrosProjetos={todosProjetos}
          onClose={() => setCronogramaAberto(false)}
          onImportado={() => {}}
          onRascunho={usarCronograma}
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
        <FormRow label="Data de assinatura da proposta (opcional)">
          <Input
            type="date"
            value={dataAssinaturaProposta}
            onChange={(e) => setDataAssinaturaProposta(e.target.value)}
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

      {veFinanceiro && (
        <>
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
        </>
      )}

      <EnvolvidosFields envolvidos={envolvidos} onChange={setEnvolvidos} />

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
