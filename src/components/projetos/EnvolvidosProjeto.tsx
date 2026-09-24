"use client";

import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Pencil, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { EnvolvidosFields } from "@/components/projetos/EnvolvidosFields";
import { podeImportarCronograma } from "@/components/projetos/CronogramaAcoes";
import { useAuth } from "@/contexts/AuthContext";
import type { EnvolvidoChave, Projeto } from "@/types";

/**
 * Principais envolvidos (key users) no detalhe do projeto. Quem atualiza o projeto — administrador,
 * coordenador e o consultor alocado (em projeto não finalizado) — pode incluir, editar e excluir
 * direto aqui; os demais só visualizam.
 */
export function EnvolvidosProjeto({ projeto }: { projeto: Projeto }) {
  const { usuario } = useAuth();
  const podeEditar = podeImportarCronograma(usuario, projeto);
  const lista = projeto.principaisEnvolvidos ?? [];
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<EnvolvidoChave[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (lista.length === 0 && !podeEditar) return null;

  function abrirEdicao() {
    setRascunho(lista.length > 0 ? lista.map((e) => ({ ...e })) : [{ nome: "", cargo: "", vinculo: "", email: "", telefone: "" }]);
    setErro("");
    setEditando(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const validos = rascunho.filter((e) => e.nome.trim()).map((e) => ({ ...e, nome: e.nome.trim() }));
      await updateDoc(doc(db, "projetos", projeto.id), {
        principaisEnvolvidos: validos.length > 0 ? validos : null,
        updatedAt: serverTimestamp(),
      });
      setEditando(false);
    } catch (err) {
      console.error("Falha ao salvar principais envolvidos:", err);
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-5.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-brand-navy-2">Principais envolvidos</p>
        {podeEditar && !editando && (
          <button
            type="button"
            onClick={abrirEdicao}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            {lista.length > 0 ? <Pencil size={13} /> : <Plus size={14} />}
            {lista.length > 0 ? "Editar" : "Adicionar"}
          </button>
        )}
      </div>

      {editando ? (
        <div className="space-y-3">
          <EnvolvidosFields envolvidos={rascunho} onChange={setRascunho} />
          {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar envolvidos"}
            </Button>
          </div>
        </div>
      ) : lista.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
          {lista.map((env, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-x-3 border-t border-brand-border-soft px-4 py-2.5 first:border-t-0">
              <span className="text-[12.5px] font-semibold text-brand-navy-2">{env.nome}</span>
              {env.cargo && <span className="text-[12px] text-brand-muted">{env.cargo}</span>}
              {env.vinculo && (
                <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[10px] font-bold text-[#2456b8]">{env.vinculo}</span>
              )}
              {env.email && <span className="text-[12px] text-brand-muted">{env.email}</span>}
              {env.telefone && <span className="text-[12px] text-brand-muted">{env.telefone}</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-brand-border bg-white px-4 py-3 text-[12.5px] text-brand-faint">
          Nenhum envolvido cadastrado ainda.
        </p>
      )}
    </div>
  );
}
