"use client";

import { useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Upload, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { lerArquivoTabular, pegarCampo } from "@/lib/importarArquivo";
import { criarAtividadeId } from "@/lib/escopo";
import type { EscopoAtividade } from "@/types";

type Etapa = "form" | "processando" | "revisao" | "importando" | "concluido" | "erro";

function EscopoImportForm({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("form");
  const [atividades, setAtividades] = useState<EscopoAtividade[]>([]);
  const [erro, setErro] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
      const descricoes = linhas
        .map((l) => pegarCampo(l.valores, "Atividade", "Descrição", "Descricao", "Item"))
        .map((t) => t.trim())
        .filter(Boolean);
      if (descricoes.length === 0) {
        setErro('Nenhuma atividade encontrada. A primeira coluna do arquivo deve se chamar "Atividade" ou "Descrição".');
        setEtapa("erro");
        return;
      }
      setAtividades(descricoes.map((descricao) => ({ id: criarAtividadeId(), descricao })));
      setEtapa("revisao");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      setEtapa("erro");
    }
  }

  async function confirmar() {
    setEtapa("importando");
    try {
      await addDoc(collection(db, "escopos"), {
        nome: nome.trim(),
        atividades,
        createdAt: serverTimestamp(),
      });
      setEtapa("concluido");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar o escopo.");
      setEtapa("erro");
    }
  }

  function reiniciar() {
    setEtapa("form");
    setAtividades([]);
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {etapa === "form" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-brand-hover p-4 text-[13px] text-brand-muted">
            Envie um arquivo .csv ou .xlsx com uma coluna <strong>Atividade</strong> (ou{" "}
            <strong>Descrição</strong>), uma linha por atividade do escopo.
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

      {etapa === "revisao" && (
        <div className="space-y-4">
          <p className="text-sm text-brand-muted">
            Escopo <strong className="text-brand-navy-2">{nome}</strong> com{" "}
            <strong className="text-brand-navy-2">{atividades.length}</strong> atividade
            {atividades.length === 1 ? "" : "s"}:
          </p>
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12.5px]">
              <tbody>
                {atividades.map((a, i) => (
                  <tr key={a.id} className="border-t border-brand-border-soft first:border-t-0">
                    <td className="px-3 py-2 text-brand-faint">{i + 1}</td>
                    <td className="px-3 py-2 text-brand-navy-2">{a.descricao}</td>
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
