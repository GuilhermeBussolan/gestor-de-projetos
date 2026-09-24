"use client";

import { useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { sincronizarDiretorio } from "@/lib/diretorio";
import { nomeExibicaoParceira } from "@/lib/parceira";
import type { EmpresaParceira, Perfil, Recurso, Usuario } from "@/types";

const PERFIL_LABEL: Record<Perfil, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
  financeiro: "Financeiro",
  responsavel_parceira: "Responsável da parceira",
};

const NOVO_USUARIO_VAZIO = {
  nomeCompleto: "",
  email: "",
  senha: "",
  perfil: "consultor" as Perfil,
  recursoId: "",
  parceiraId: "",
};

// Documentos da coleção "usuarios" são indexados pelo uid do Firebase Auth como
// id do documento (não como um campo "uid" dentro dele) — por isso remapeamos aqui.
type UsuarioDoc = Omit<Usuario, "uid"> & { id: string };

function UsuariosPageContent() {
  const { usuario: eu } = useAuth();
  const { data: usuariosDocs, loading } = useCollection<UsuarioDoc>("usuarios", []);
  const usuarios: Usuario[] = usuariosDocs.map(({ id, ...resto }) => ({ uid: id, ...resto }));
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: parceiras } = useCollection<EmpresaParceira>("parceiras");
  const [parceiraId, setParceiraId] = useState<string>("");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [perfil, setPerfil] = useState<Perfil>("consultor");
  const [recursoId, setRecursoId] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const [criandoAberto, setCriandoAberto] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState(NOVO_USUARIO_VAZIO);
  const [criandoErro, setCriandoErro] = useState("");
  const [criandoSalvando, setCriandoSalvando] = useState(false);

  // Espelha as mudanças de usuários na lista de @ da linha do tempo.
  function atualizarDiretorio() {
    if (!eu) return;
    sincronizarDiretorio(eu).catch((err) => console.warn("Não foi possível sincronizar o diretório:", err));
  }

  function abrirEdicao(u: Usuario) {
    setEditando(u);
    setPerfil(u.perfil);
    setRecursoId(u.recursoId ?? "");
    setParceiraId(u.parceiraId ?? "");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, "usuarios", editando.uid), {
        perfil,
        recursoId: recursoId || null,
        parceiraId: perfil === "responsavel_parceira" ? parceiraId || null : null,
      });
      atualizarDiretorio();
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
    atualizarDiretorio();
  }

  function abrirCriacao() {
    setNovoUsuario(NOVO_USUARIO_VAZIO);
    setCriandoErro("");
    setCriandoAberto(true);
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setCriandoErro("");
    if (novoUsuario.senha.length < 6) {
      setCriandoErro("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setCriandoSalvando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nomeCompleto: novoUsuario.nomeCompleto,
          email: novoUsuario.email,
          senha: novoUsuario.senha,
          perfil: novoUsuario.perfil,
          recursoId: novoUsuario.recursoId || null,
          parceiraId: novoUsuario.parceiraId || null,
        }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setCriandoErro(dados.erro ?? "Não foi possível criar o usuário.");
        return;
      }
      atualizarDiretorio();
      setCriandoAberto(false);
    } catch {
      setCriandoErro("Não foi possível criar o usuário.");
    } finally {
      setCriandoSalvando(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Usuários</h1>
        <Button onClick={abrirCriacao}>+ Novo usuário</Button>
      </div>
      <p className="mb-4 text-sm text-brand-muted">
        Só um administrador pode criar contas novas — não existe mais cadastro público pela tela de
        login. Defina a senha inicial abaixo e repasse pra pessoa; ela pode trocar depois em
        &quot;Trocar senha&quot;.
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
              <option value="financeiro">Financeiro</option>
              <option value="responsavel_parceira">Responsável da parceira</option>
            </Select>
          </FormRow>
          {perfil === "responsavel_parceira" && (
            <FormRow label="Empresa parceira que ele representa">
              <Select value={parceiraId} onChange={(e) => setParceiraId(e.target.value)} required>
                <option value="">Selecione...</option>
                {parceiras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nomeExibicaoParceira(p)}
                  </option>
                ))}
              </Select>
            </FormRow>
          )}
          {(perfil === "coordenador" || perfil === "consultor") && (
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

      <Modal open={criandoAberto} onClose={() => setCriandoAberto(false)} title="Novo usuário">
        <form onSubmit={criarUsuario} className="space-y-4">
          <FormRow label="Nome completo">
            <Input
              value={novoUsuario.nomeCompleto}
              onChange={(e) => setNovoUsuario({ ...novoUsuario, nomeCompleto: e.target.value })}
              required
              autoFocus
            />
          </FormRow>
          <FormRow label="E-mail">
            <Input
              type="email"
              value={novoUsuario.email}
              onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
              required
            />
          </FormRow>
          <FormRow label="Senha inicial">
            <Input
              type="text"
              value={novoUsuario.senha}
              onChange={(e) => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </FormRow>
          <FormRow label="Perfil">
            <Select
              value={novoUsuario.perfil}
              onChange={(e) => setNovoUsuario({ ...novoUsuario, perfil: e.target.value as Perfil })}
            >
              <option value="administrador">Administrador</option>
              <option value="coordenador">Coordenador</option>
              <option value="consultor">Consultor</option>
              <option value="financeiro">Financeiro</option>
              <option value="responsavel_parceira">Responsável da parceira</option>
            </Select>
          </FormRow>
          {novoUsuario.perfil === "responsavel_parceira" && (
            <FormRow label="Empresa parceira que ele representa">
              <Select
                value={novoUsuario.parceiraId}
                onChange={(e) => setNovoUsuario({ ...novoUsuario, parceiraId: e.target.value })}
                required
              >
                <option value="">Selecione...</option>
                {parceiras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nomeExibicaoParceira(p)}
                  </option>
                ))}
              </Select>
            </FormRow>
          )}
          {(novoUsuario.perfil === "coordenador" || novoUsuario.perfil === "consultor") && (
            <FormRow label="Recurso vinculado (opcional)">
              <Select
                value={novoUsuario.recursoId}
                onChange={(e) => setNovoUsuario({ ...novoUsuario, recursoId: e.target.value })}
              >
                <option value="">Nenhum</option>
                {recursos
                  .filter((r) =>
                    novoUsuario.perfil === "coordenador"
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
          {criandoErro && <p className="text-sm font-medium text-red-600">{criandoErro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCriandoAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criandoSalvando}>
              {criandoSalvando ? "Criando..." : "Criar usuário"}
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
