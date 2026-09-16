"use client";

import { useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Select } from "@/components/ui/Field";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import type { Perfil, Recurso, Usuario } from "@/types";

const PERFIL_LABEL: Record<Perfil, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
};

// Documentos da coleção "usuarios" são indexados pelo uid do Firebase Auth como
// id do documento (não como um campo "uid" dentro dele) — por isso remapeamos aqui.
type UsuarioDoc = Omit<Usuario, "uid"> & { id: string };

function UsuariosPageContent() {
  const { data: usuariosDocs, loading } = useCollection<UsuarioDoc>("usuarios", []);
  const usuarios: Usuario[] = usuariosDocs.map(({ id, ...resto }) => ({ uid: id, ...resto }));
  const { data: recursos } = useCollection<Recurso>("recursos");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [perfil, setPerfil] = useState<Perfil>("consultor");
  const [recursoId, setRecursoId] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  function abrirEdicao(u: Usuario) {
    setEditando(u);
    setPerfil(u.perfil);
    setRecursoId(u.recursoId ?? "");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, "usuarios", editando.uid), {
        perfil,
        recursoId: recursoId || null,
      });
      setEditando(null);
    } finally {
      setSalvando(false);
    }
  }

  async function removerAcesso(u: Usuario) {
    if (
      !confirm(
        `Remover o acesso de "${u.nomeCompleto}"? Isso remove o perfil dele do sistema (a conta de login permanece existindo, mas sem acesso a nenhuma tela).`
      )
    )
      return;
    await deleteDoc(doc(db, "usuarios", u.uid));
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Usuários</h1>
      </div>
      <p className="mb-4 text-sm text-brand-muted">
        Novos usuários se cadastram pela tela de login. Aqui você ajusta o perfil e vincula o
        usuário a um recurso (necessário para Coordenador/Consultor aparecerem no calendário e
        apontamento).
      </p>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
              <th className="px-[18px] py-3.5">Nome</th>
              <th className="px-[18px] py-3.5">E-mail</th>
              <th className="px-[18px] py-3.5">Perfil</th>
              <th className="px-[18px] py-3.5">Recurso vinculado</th>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const recurso = recursos.find((r) => r.id === u.recursoId);
              return (
                <tr key={u.uid} className="border-t border-brand-border-soft hover:bg-brand-hover">
                  <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{u.nomeCompleto}</td>
                  <td className="px-[18px] py-[15px] text-brand-muted">{u.email}</td>
                  <td className="px-[18px] py-[15px]">
                    <span className="rounded-full bg-brand-accent-soft px-2.5 py-1 text-[11px] font-bold text-[#2456b8]">
                      {PERFIL_LABEL[u.perfil]}
                    </span>
                  </td>
                  <td className="px-[18px] py-[15px] text-brand-muted">
                    {recurso ? recurso.nomeCompleto : "—"}
                  </td>
                  <td className="px-[18px] py-[15px] text-right">
                    <button
                      onClick={() => abrirEdicao(u)}
                      className="mr-3 text-brand-accent hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => removerAcesso(u)}
                      className="text-red-600 hover:underline"
                    >
                      Remover acesso
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-faint">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={`Editar acesso — ${editando?.nomeCompleto ?? ""}`}
      >
        <form onSubmit={salvar} className="space-y-4">
          <FormRow label="Perfil">
            <Select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              <option value="administrador">Administrador</option>
              <option value="coordenador">Coordenador</option>
              <option value="consultor">Consultor</option>
            </Select>
          </FormRow>
          {perfil !== "administrador" && (
            <FormRow label="Recurso vinculado">
              <Select value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
                <option value="">Nenhum</option>
                {recursos
                  .filter((r) =>
                    perfil === "coordenador"
                      ? r.tipo === "coordenador"
                      : r.tipo !== "coordenador"
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nomeCompleto} ({TIPO_RECURSO_CONFIG[r.tipo].label})
                    </option>
                  ))}
              </Select>
            </FormRow>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <UsuariosPageContent />
    </ProtectedPage>
  );
}
