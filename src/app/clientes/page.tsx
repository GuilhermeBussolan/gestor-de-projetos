"use client";

import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CadastrosTabs } from "@/components/layout/CadastrosTabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { semAcento } from "@/lib/mencoes";
import { ImportarClientesModal } from "@/components/importacao/ImportarClientesModal";
import { Search, Upload } from "lucide-react";
import type { Cliente, Projeto } from "@/types";

type FiltroProjetos = "" | "com_ativo" | "so_encerrados" | "sem_projeto";
type FiltroCadastro = "" | "sem_cnpj" | "sem_codigo_ci";
type Ordem = "nome" | "recentes";

const soDigitos = (t: string) => t.replace(/\D/g, "");

const CLIENTE_VAZIO = {
  nome: "",
  nomeFantasia: "",
  cnpj: "",
  codigoCI: "",
};

function ClientesPageContent() {
  const { data: clientes, loading } = useCollection<Cliente>("clientes");
  const { data: projetos } = useCollection<Projeto>("projetos");
  const [busca, setBusca] = useState("");
  const [filtroProjetos, setFiltroProjetos] = useState<FiltroProjetos>("");
  const [filtroCadastro, setFiltroCadastro] = useState<FiltroCadastro>("");
  const [ordem, setOrdem] = useState<Ordem>("nome");

  // Projetos de cada cliente: ativos (status ausente = ativo) e total.
  const projetosPorCliente = useMemo(() => {
    const mapa = new Map<string, { ativos: number; total: number }>();
    for (const p of projetos) {
      const atual = mapa.get(p.clienteId) ?? { ativos: 0, total: 0 };
      atual.total += 1;
      if ((p.status ?? "ativo") === "ativo") atual.ativos += 1;
      mapa.set(p.clienteId, atual);
    }
    return mapa;
  }, [projetos]);

  const clientesFiltrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    const termoDigitos = soDigitos(busca);
    return clientes
      .filter((c) => {
        if (termo) {
          const textos = [c.nome, c.nomeFantasia ?? "", c.codigoCI ?? "", c.cnpj ?? ""].map(semAcento);
          const achouTexto = textos.some((t) => t.includes(termo));
          // CNPJ com ou sem pontuação ("12.345" ou "12345").
          const achouCnpj = termoDigitos.length >= 3 && soDigitos(c.cnpj ?? "").includes(termoDigitos);
          if (!achouTexto && !achouCnpj) return false;
        }
        const qtd = projetosPorCliente.get(c.id);
        if (filtroProjetos === "com_ativo" && !(qtd && qtd.ativos > 0)) return false;
        if (filtroProjetos === "so_encerrados" && !(qtd && qtd.total > 0 && qtd.ativos === 0)) return false;
        if (filtroProjetos === "sem_projeto" && qtd && qtd.total > 0) return false;
        if (filtroCadastro === "sem_cnpj" && c.cnpj?.trim()) return false;
        if (filtroCadastro === "sem_codigo_ci" && c.codigoCI?.trim()) return false;
        return true;
      })
      .sort((a, b) => (ordem === "recentes" ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : a.nome.localeCompare(b.nome, "pt-BR")));
  }, [clientes, busca, filtroProjetos, filtroCadastro, ordem, projetosPorCliente]);
  const temFiltro = !!busca.trim() || !!filtroProjetos || !!filtroCadastro;

  function limparFiltros() {
    setBusca("");
    setFiltroProjetos("");
    setFiltroCadastro("");
  }
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(CLIENTE_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);

  function abrirNovo() {
    setEditando(null);
    setForm(CLIENTE_VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setEditando(cliente);
    setForm({
      nome: cliente.nome,
      nomeFantasia: cliente.nomeFantasia ?? "",
      cnpj: cliente.cnpj ?? "",
      codigoCI: cliente.codigoCI ?? "",
    });
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const dados = {
        nome: form.nome,
        nomeFantasia: form.nomeFantasia || null,
        cnpj: form.cnpj || null,
        codigoCI: form.codigoCI || null,
      };
      if (editando) {
        await updateDoc(doc(db, "clientes", editando.id), dados);
      } else {
        await addDoc(collection(db, "clientes"), { ...dados, createdAt: Date.now() });
      }
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(cliente: Cliente) {
    if (!confirm(`Excluir o cliente "${nomeExibicaoCliente(cliente)}"?`)) return;
    await deleteDoc(doc(db, "clientes", cliente.id));
  }

  return (
    <div>
      <CadastrosTabs />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Clientes</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportarAberto(true)}>
            <Upload size={15} /> Importar
          </Button>
          <Button onClick={abrirNovo}>+ Novo cliente</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2.5">
        <div className="w-72 max-w-full">
          <FormRow label="Buscar">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-faint" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, nome fantasia, CNPJ ou código CI"
                className="pl-9"
              />
            </div>
          </FormRow>
        </div>
        <div className="w-52">
          <FormRow label="Projetos">
            <Select value={filtroProjetos} onChange={(e) => setFiltroProjetos(e.target.value as FiltroProjetos)}>
              <option value="">Todos</option>
              <option value="com_ativo">Com projeto ativo</option>
              <option value="so_encerrados">Só projetos encerrados</option>
              <option value="sem_projeto">Sem projeto</option>
            </Select>
          </FormRow>
        </div>
        <div className="w-48">
          <FormRow label="Cadastro">
            <Select value={filtroCadastro} onChange={(e) => setFiltroCadastro(e.target.value as FiltroCadastro)}>
              <option value="">Todos</option>
              <option value="sem_cnpj">Sem CNPJ</option>
              <option value="sem_codigo_ci">Sem código CI</option>
            </Select>
          </FormRow>
        </div>
        <div className="w-40">
          <FormRow label="Ordenar por">
            <Select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="nome">Nome (A–Z)</option>
              <option value="recentes">Mais recentes</option>
            </Select>
          </FormRow>
        </div>
        {temFiltro && (
          <button type="button" onClick={limparFiltros} className="mb-2.5 text-[12.5px] font-semibold text-brand-accent hover:underline">
            Limpar filtros
          </button>
        )}
        <p className="mb-2.5 ml-auto text-[12.5px] text-brand-muted">
          {temFiltro ? `${clientesFiltrados.length} de ${clientes.length} clientes` : `${clientes.length} clientes`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
              <th className="px-[18px] py-3.5">Nome</th>
              <th className="px-[18px] py-3.5">Nome fantasia</th>
              <th className="px-[18px] py-3.5">CNPJ</th>
              <th className="px-[18px] py-3.5">Código CI</th>
              <th className="px-[18px] py-3.5" title="Projetos ativos e total de projetos do cliente">
                Projetos
              </th>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.map((c) => {
              const qtd = projetosPorCliente.get(c.id);
              return (
              <tr key={c.id} className="border-t border-brand-border-soft hover:bg-brand-hover">
                <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{c.nome}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{c.nomeFantasia || "—"}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{c.cnpj || "—"}</td>
                <td className="px-[18px] py-[15px] text-brand-muted">{c.codigoCI || "—"}</td>
                <td className="px-[18px] py-[15px] whitespace-nowrap text-brand-muted">
                  {qtd ? (
                    <>
                      <strong className="text-brand-navy-2">{qtd.ativos}</strong> {qtd.ativos === 1 ? "ativo" : "ativos"} · {qtd.total} no total
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-[18px] py-[15px] text-right">
                  <button
                    onClick={() => abrirEdicao(c)}
                    className="mr-3 text-brand-accent hover:underline"
                  >
                    Editar
                  </button>
                  <button onClick={() => excluir(c)} className="text-red-600 hover:underline">
                    Excluir
                  </button>
                </td>
              </tr>
              );
            })}
            {!loading && clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-faint">
                  {clientes.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum cliente encontrado com esses filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? "Editar cliente" : "Novo cliente"}
      >
        <form onSubmit={salvar} className="space-y-4">
          <FormRow label="Nome">
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Razão social ou nome do cliente"
              required
            />
          </FormRow>
          <FormRow label="Nome fantasia (opcional)">
            <Input
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
            />
          </FormRow>
          <FormRow label="CNPJ (opcional)">
            <Input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
          </FormRow>
          <FormRow label="Código CI (controle interno, opcional)">
            <Input
              value={form.codigoCI}
              onChange={(e) => setForm({ ...form, codigoCI: e.target.value })}
            />
          </FormRow>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <ImportarClientesModal
        open={importarAberto}
        onClose={() => setImportarAberto(false)}
        clientesExistentes={clientes}
      />
    </div>
  );
}

export default function ClientesPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <ClientesPageContent />
    </ProtectedPage>
  );
}
