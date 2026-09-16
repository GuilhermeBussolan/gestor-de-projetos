"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ProjetoDrawerConteudo } from "@/components/projetos/ProjetoDrawer";
import { ProjetoFormModal } from "@/components/projetos/ProjetoFormModal";
import { EditarProjetoModal } from "@/components/projetos/EditarProjetoModal";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularPercentualProjeto, corFaixaProgresso } from "@/lib/dashboardCalc";
import type { Cliente, EventoCalendario, Projeto, Recurso, TipoDocumento } from "@/types";

function ProjetosPageContent() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();
  const destaqueId = searchParams.get("projetoId");

  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: tiposDocumento } = useCollection<TipoDocumento>("tiposDocumento", []);
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(destaqueId);

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";

  const projetoDetalhe = projetos.find((p) => p.id === detalheId) ?? null;

  async function excluir(projeto: Projeto) {
    const cliente = clientes.find((c) => c.id === projeto.clienteId);
    if (!confirm(`Excluir o projeto de "${nomeExibicaoCliente(cliente)}"?`)) return;
    await deleteDoc(doc(db, "projetos", projeto.id));
    setDetalheId(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Projetos</h1>
        {podeEditar && <Button onClick={() => setModalNovoAberto(true)}>+ Novo projeto</Button>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Proposta</th>
              <th className="px-4 py-3">Módulo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Coordenador</th>
              <th className="px-4 py-3">Progresso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projetos.map((p) => {
              const cliente = clientes.find((c) => c.id === p.clienteId);
              const coordenador = recursos.find((r) => r.id === p.coordenadorId);
              const percentual = calcularPercentualProjeto(p.documentos);
              const cor = corFaixaProgresso(percentual);
              return (
                <tr
                  key={p.id}
                  onClick={() => setDetalheId(p.id)}
                  className={`cursor-pointer hover:bg-slate-50 ${
                    detalheId === p.id ? "bg-sky-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {nomeExibicaoCliente(cliente)}
                  </td>
                  <td className="px-4 py-3">{p.codigoProposta}</td>
                  <td className="px-4 py-3">{p.modulo}</td>
                  <td className="px-4 py-3">{p.tipoAtendimento}</td>
                  <td className="px-4 py-3">{coordenador ? coordenador.nomeCompleto : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percentual}%`, backgroundColor: cor }}
                        />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: cor }}>
                        {percentual}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {projetos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum projeto cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={!!projetoDetalhe}
        onClose={() => setDetalheId(null)}
        title={nomeExibicaoCliente(clientes.find((c) => c.id === projetoDetalhe?.clienteId))}
      >
        {projetoDetalhe && (
          <ProjetoDrawerConteudo
            projeto={projetoDetalhe}
            coordenador={recursos.find((r) => r.id === projetoDetalhe.coordenadorId)}
            consultores={recursos.filter((r) => projetoDetalhe.consultorIds?.includes(r.id))}
            eventos={eventos}
            recursos={recursos}
            podeEditar={!!podeEditar}
            onEditar={() => setEditando(projetoDetalhe)}
            onExcluir={() => excluir(projetoDetalhe)}
          />
        )}
      </Drawer>

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
