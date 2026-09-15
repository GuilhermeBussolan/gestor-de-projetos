"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { ProjetoCard } from "@/components/projetos/ProjetoCard";
import { ProjetoFormModal } from "@/components/projetos/ProjetoFormModal";
import { EditarProjetoModal } from "@/components/projetos/EditarProjetoModal";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto, Recurso, TipoDocumento } from "@/types";

function ProjetosPageContent() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();
  const destaqueId = searchParams.get("projetoId");

  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: tiposDocumento } = useCollection<TipoDocumento>("tiposDocumento", []);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";

  useEffect(() => {
    if (destaqueId) {
      const el = document.getElementById(`projeto-${destaqueId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [destaqueId, projetos.length]);

  async function excluir(projeto: Projeto) {
    const cliente = clientes.find((c) => c.id === projeto.clienteId);
    if (!confirm(`Excluir o projeto de "${nomeExibicaoCliente(cliente)}"?`)) return;
    await deleteDoc(doc(db, "projetos", projeto.id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Projetos</h1>
        {podeEditar && <Button onClick={() => setModalNovoAberto(true)}>+ Novo projeto</Button>}
      </div>

      <div className="space-y-4">
        {projetos.map((p) => (
          <ProjetoCard
            key={p.id}
            projeto={p}
            cliente={clientes.find((c) => c.id === p.clienteId)}
            coordenador={recursos.find((r) => r.id === p.coordenadorId)}
            consultores={recursos.filter((r) => p.consultorIds?.includes(r.id))}
            destacado={destaqueId === p.id}
            podeEditar={!!podeEditar}
            onEditar={() => setEditando(p)}
            onExcluir={() => excluir(p)}
          />
        ))}
        {projetos.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
            Nenhum projeto cadastrado ainda.
          </p>
        )}
      </div>

      <ProjetoFormModal
        open={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        clientes={clientes}
        recursos={recursos}
        tiposDocumento={tiposDocumento}
      />
      <EditarProjetoModal
        projeto={editando}
        onClose={() => setEditando(null)}
        recursos={recursos}
        tiposDocumento={tiposDocumento}
      />
    </div>
  );
}

export default function ProjetosPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador"]}>
      <Suspense fallback={null}>
        <ProjetosPageContent />
      </Suspense>
    </ProtectedPage>
  );
}
