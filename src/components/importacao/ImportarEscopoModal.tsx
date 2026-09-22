"use client";

import { useMemo, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { AlertTriangle, Upload, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { lerArquivoTabular } from "@/lib/importarArquivo";
import {
  aplicarCorrecoesDuracao,
  atividadesSemDuracao,
  converterLinhasEmAtividades,
} from "@/lib/importarEscopo";
import { normalizarNiveis, numerarAtividades } from "@/lib/escopo";
import { useAuth } from "@/contexts/AuthContext";
import type { EscopoAtividade } from "@/types";

type Etapa = "form" | "processando" | "corrigindo" | "revisao" | "importando" | "concluido" | "erro";

function EscopoImportForm({ onClose }: { onClose: () => void }) {
  const { usuario } = useAuth();
  const [nome, setNome] = useState("");
  const [arquivoNome, setArquivoNome] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("form");
  const [atividades, setAtividades] = useState<EscopoAtividade[]>([]);
  const [totalErrosOriginal, setTotalErrosOriginal] = useState(0);
  const [correcoes, setCorrecoes] = useState<Map<string, string>>(new Map());
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const faltando = useMemo(() => atividadesSemDuracao(atividades), [atividades]);
  const numeracao = useMemo(() => numerarAtividades(atividades), [atividades]);

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!nome.trim()) {
      setErro("Informe o nome do escopo antes de escolher o arquivo.");
      setEtapa("erro");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setEtapa("processando");
    setErro("");
    try {
      const linhas = await lerArquivoTabular(file);
      const resultado = converterLinhasEmAtividades(linhas);
      if (resultado.atividades.length === 0) {
        setErro(
          'Nenhuma atividade encontrada. Use uma coluna "Atividade"/"Descrição", ou "Tarefa Pai"/"Tarefa Filha", e uma coluna "Duração".'
        );
        setEtapa("erro");
        return;
      }
      setArquivoNome(file.name);
      setAtividades(resultado.atividades);
      setTotalErrosOriginal(resultado.erros.length);
      setCorrecoes(new Map());
      setEtapa(resultado.erros.length > 0 ? "corrigindo" : "revisao");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      setEtapa("erro");
    }
  }

  function aplicarCorrecoes() {
    const atualizado = aplicarCorrecoesDuracao(atividades, correcoes);
    setAtividades(atualizado);
    setCorrecoes(new Map());
    if (atividadesSemDuracao(atualizado).length === 0) setEtapa("revisao");
  }

  async function confirmar() {
    setEtapa("importando");
    try {
      const atividadesFinal = normalizarNiveis(atividades);
      const escopoRef = await addDoc(collection(db, "escopos"), {
        nome: nome.trim(),
        atividades: atividadesFinal,
        createdAt: serverTimestamp(),
      });
      if (usuario) {
        await addDoc(collection(db, "escoposImportados"), {
          escopoId: escopoRef.id,
          nomeEscopo: nome.trim(),
          arquivoNome,
          linhasValidadas: atividadesFinal.length,
          linhasComErro: totalErrosOriginal,
          usuarioId: usuario.uid,
          usuarioNome: usuario.nomeCompleto,
          criadoEm: Date.now(),
        });
      }
      setEtapa("concluido");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar o escopo.");
      setEtapa("erro");
    }
  }

  function reiniciar() {
    setEtapa("form");
    setAtividades([]);
    setCorrecoes(new Map());
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {etapa === "form" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-brand-hover p-4 text-[13px] text-brand-muted">
            Envie um arquivo .csv ou .xlsx com uma coluna <strong>Duração</strong> (obrigatória em
            toda linha) e <strong>Unidade</strong> (opcional, minutos ou horas). Para a lista de
            atividades, use <strong>Atividade</strong> (ou <strong>Descrição</strong>) numa única
            coluna, ou <strong>Tarefa Pai</strong> e <strong>Tarefa Filha</strong> para já importar
            com hierarquia.
          </div>
          <FormRow label="Nome do escopo">
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Escopo padrão de implantação QRH"
              required
            />
          </FormRow>
          <label className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-brand-border bg-white p-8 text-center hover:border-brand-accent hover:bg-brand-accent-soft/30">
            <Upload size={22} className="text-brand-faint" />
            <span className="text-sm font-semibold text-brand-navy-2">
              Clique para escolher o arquivo (.csv ou .xlsx)
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm"
              onChange={aoEscolherArquivo}
              className="hidden"
            />
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {etapa === "processando" && (
        <p className="py-10 text-center text-sm text-brand-muted">Lendo o arquivo...</p>
      )}

      {etapa === "erro" && (
        <div className="space-y-4">
          <p className="rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">{erro}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" onClick={reiniciar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {etapa === "corrigindo" && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Importação bloqueada: {faltando.length} tarefa{faltando.length === 1 ? "" : "s"} sem
            duração. Revise o arquivo ou preencha os campos faltantes abaixo.
          </p>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-brand-border-soft bg-brand-hover text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
                  <th className="px-3 py-2">Tarefa</th>
                  <th className="px-3 py-2">Duração (min ou horas)</th>
                </tr>
              </thead>
              <tbody>
                {faltando.map((a) => (
                  <tr key={a.id} className="border-t border-brand-border-soft">
                    <td className="px-3 py-2 text-brand-navy-2">{a.descricao}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className="w-28"
                        placeholder="0,0"
                        value={correcoes.get(a.id) ?? ""}
                        onChange={(e) =>
                          setCorrecoes((prev) => new Map(prev).set(a.id, e.target.value))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={aplicarCorrecoes} disabled={correcoes.size === 0}>
              Aplicar e continuar
            </Button>
          </div>
        </div>
      )}

      {etapa === "revisao" && (
        <div className="space-y-4">
          <p className="text-sm text-brand-muted">
            Escopo <strong className="text-brand-navy-2">{nome}</strong> com{" "}
            <strong className="text-brand-navy-2">{atividades.length}</strong> atividade
            {atividades.length === 1 ? "" : "s"}
            {totalErrosOriginal > 0 ? ` (${totalErrosOriginal} duração${totalErrosOriginal === 1 ? "" : "es"} completada${totalErrosOriginal === 1 ? "" : "s"} manualmente)` : ""}:
          </p>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12.5px]">
              <tbody>
                {atividades.map((a, i) => (
                  <tr key={a.id} className="border-t border-brand-border-soft first:border-t-0">
                    <td className="px-3 py-2 text-brand-faint">{numeracao[i]}</td>
                    <td
                      className="px-3 py-2 text-brand-navy-2"
                      style={{ paddingLeft: 12 + (a.nivel ?? 0) * 18 }}
                    >
                      {a.descricao}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-brand-faint">
                      {a.duracao ? `${a.duracao} ${a.unidadeDuracao === "minutos" ? "min" : "hora(s)"}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmar}>
              Importar escopo ({atividades.length})
            </Button>
          </div>
        </div>
      )}

      {etapa === "importando" && (
        <p className="py-10 text-center text-sm text-brand-muted">Importando...</p>
      )}

      {etapa === "concluido" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#92D050]/40 bg-[#e3f5ea] p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-[#15754c]" />
            <p className="font-bold text-[#15754c]">
              Escopo &quot;{nome}&quot; importado com {atividades.length} atividade
              {atividades.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImportarEscopoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Importar escopo" wide>
      {open && <EscopoImportForm onClose={onClose} />}
    </Modal>
  );
}
