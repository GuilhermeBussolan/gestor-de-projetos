"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FileText, UserPlus, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { VINCULOS_ENVOLVIDO, type EnvolvidoChave, type Projeto, type VinculoEnvolvido } from "@/types";

const ENVOLVIDO_VAZIO: EnvolvidoChave = { nome: "", cargo: "", vinculo: "", email: "", telefone: "" };

/**
 * Antes de gerar a OS: marca, entre os principais envolvidos do projeto, quem participou da agenda. Quem pode editar o
 * projeto também inclui uma pessoa nova aqui — ela é gravada nos principais envolvidos do projeto (a mesma lista do
 * acompanhamento do projeto) e já entra marcada na OS.
 */
export function ParticipantesOsModal({
  open,
  projeto,
  podeIncluir,
  gerando,
  onClose,
  onGerar,
}: {
  open: boolean;
  projeto: Projeto;
  /** Administrador, coordenador ou consultor alocado (as mesmas regras de editar os envolvidos no projeto). */
  podeIncluir: boolean;
  gerando: boolean;
  onClose: () => void;
  onGerar: (participantes: EnvolvidoChave[]) => void;
}) {
  const envolvidos = projeto.principaisEnvolvidos ?? [];
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [incluindo, setIncluindo] = useState(false);
  const [novo, setNovo] = useState<EnvolvidoChave>(ENVOLVIDO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const todos = marcados.size === envolvidos.length && envolvidos.length > 0;
  const alternar = (i: number) =>
    setMarcados((prev) => {
      const novoSet = new Set(prev);
      if (novoSet.has(i)) novoSet.delete(i);
      else novoSet.add(i);
      return novoSet;
    });

  async function incluir() {
    const nome = novo.nome.trim();
    if (!nome) {
      setErro("Informe o nome.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const pessoa: EnvolvidoChave = {
        nome,
        cargo: novo.cargo?.trim() ?? "",
        vinculo: novo.vinculo ?? "",
        email: novo.email?.trim() ?? "",
        telefone: novo.telefone?.trim() ?? "",
      };
      await updateDoc(doc(db, "projetos", projeto.id), {
        principaisEnvolvidos: [...envolvidos, pessoa],
        updatedAt: serverTimestamp(),
      });
      // A nova pessoa fica no fim da lista e já entra marcada como participante.
      setMarcados((prev) => new Set(prev).add(envolvidos.length));
      setNovo(ENVOLVIDO_VAZIO);
      setIncluindo(false);
    } catch (err) {
      console.error("Falha ao incluir envolvido:", err);
      setErro("Não foi possível incluir. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = (k: keyof EnvolvidoChave, v: string) => setNovo((n) => ({ ...n, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Ordem de Serviço — participantes">
      <div className="space-y-4">
        <p className="text-[13px] text-brand-muted">
          Marque quem participou desta agenda. Os nomes escolhidos entram numa lista na OS. É opcional: pode gerar sem marcar ninguém.
        </p>

        {envolvidos.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-brand-border">
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-brand-border bg-brand-hover px-3.5 py-2.5 text-[13px] font-semibold text-brand-navy-2">
              <input
                type="checkbox"
                checked={todos}
                onChange={() => setMarcados(todos ? new Set() : new Set(envolvidos.map((_, i) => i)))}
              />
              <Users size={15} className="text-brand-faint" />
              Selecionar todos ({envolvidos.length})
            </label>
            <div className="max-h-72 divide-y divide-brand-border-soft overflow-y-auto">
              {envolvidos.map((e, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-brand-hover">
                  <input type="checkbox" className="mt-0.5" checked={marcados.has(i)} onChange={() => alternar(i)} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-brand-navy-2">{e.nome}</span>
                    <span className="block text-[12px] text-brand-faint">
                      {[e.cargo, e.vinculo].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-brand-border px-4 py-3 text-[12.5px] text-brand-faint">
            Este projeto ainda não tem principais envolvidos cadastrados.
          </p>
        )}

        {podeIncluir &&
          (incluindo ? (
            <div className="space-y-2 rounded-xl border border-brand-border bg-brand-hover/50 p-3">
              <p className="text-[12.5px] font-semibold text-brand-navy-2">Novo envolvido — fica salvo nos principais envolvidos do projeto</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input placeholder="Nome" value={novo.nome} onChange={(e) => campo("nome", e.target.value)} autoFocus />
                <Input placeholder="Cargo" value={novo.cargo ?? ""} onChange={(e) => campo("cargo", e.target.value)} />
                <Select aria-label="Vínculo do envolvido" value={novo.vinculo ?? ""} onChange={(e) => campo("vinculo", e.target.value as VinculoEnvolvido | "")}>
                  <option value="">Vínculo...</option>
                  {VINCULOS_ENVOLVIDO.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
                <Input placeholder="E-mail" type="email" value={novo.email ?? ""} onChange={(e) => campo("email", e.target.value)} />
                <Input placeholder="Telefone" value={novo.telefone ?? ""} onChange={(e) => campo("telefone", e.target.value)} />
              </div>
              {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={salvando}
                  onClick={() => {
                    setIncluindo(false);
                    setNovo(ENVOLVIDO_VAZIO);
                    setErro("");
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" disabled={salvando || !novo.nome.trim()} onClick={incluir}>
                  {salvando ? "Salvando..." : "Incluir envolvido"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIncluindo(true)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
            >
              <UserPlus size={14} />
              Incluir envolvido
            </button>
          ))}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-brand-faint">
            {marcados.size === 0 ? "Nenhum participante marcado" : `${marcados.size} participante${marcados.size === 1 ? "" : "s"} na OS`}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={gerando || incluindo} onClick={() => onGerar(envolvidos.filter((_, i) => marcados.has(i)))}>
              <FileText size={15} />
              {gerando ? "Gerando..." : "Gerar OS"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
