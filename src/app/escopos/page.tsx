"use client";

import { Fragment, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { CadastrosTabs } from "@/components/layout/CadastrosTabs";
import { Button } from "@/components/ui/Button";
import { ImportarEscopoModal } from "@/components/importacao/ImportarEscopoModal";
import { EscopoFormModal } from "@/components/escopos/EscopoFormModal";
import { nivelAtividade, numerarAtividades, temFilhos } from "@/lib/escopo";
import { Upload, ChevronDown, ChevronUp } from "lucide-react";
import type { Escopo } from "@/types";

function EscoposPageContent() {
  const { data: escopos, loading } = useCollection<Escopo>("escopos");
  const [importarAberto, setImportarAberto] = useState(false);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Escopo | "novo" | null>(null);

  async function excluir(escopo: Escopo) {
    if (
      !confirm(
        `Excluir o escopo "${escopo.nome}"? Projetos que já usam esse escopo não são afetados, só deixa de estar disponível para novos vínculos.`
      )
    )
      return;
    await deleteDoc(doc(db, "escopos", escopo.id));
  }

  return (
    <div>
      <CadastrosTabs />
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Escopos</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportarAberto(true)}>
            <Upload size={15} /> Importar escopo
          </Button>
          <Button onClick={() => setEditando("novo")}>+ Novo escopo</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
              <th className="px-[18px] py-3.5">Nome do escopo</th>
              <th className="px-[18px] py-3.5">Atividades</th>
              <th className="px-[18px] py-3.5" />
            </tr>
          </thead>
          <tbody>
            {escopos.map((e) => {
              const expandido = expandidoId === e.id;
              const numeros = expandido ? numerarAtividades(e.atividades ?? []) : [];
              return (
                <Fragment key={e.id}>
                  <tr className="border-t border-brand-border-soft hover:bg-brand-hover">
                    <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">{e.nome}</td>
                    <td className="px-[18px] py-[15px] text-brand-muted">
                      {e.atividades?.length ?? 0} atividade{(e.atividades?.length ?? 0) === 1 ? "" : "s"}
                    </td>
                    <td className="px-[18px] py-[15px] text-right">
                      <button
                        onClick={() => setExpandidoId(expandido ? null : e.id)}
                        className="mr-3 inline-flex items-center gap-1 text-brand-accent hover:underline"
                      >
                        {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {expandido ? "Ocultar" : "Ver atividades"}
                      </button>
                      <button onClick={() => setEditando(e)} className="mr-3 text-brand-accent hover:underline">
                        Editar
                      </button>
                      <button onClick={() => excluir(e)} className="text-red-600 hover:underline">
                        Excluir
                      </button>
                    </td>
                  </tr>
                  {expandido && (
                    <tr className="border-t border-brand-border-soft bg-brand-hover/40">
                      <td colSpan={3} className="px-[18px] py-3.5">
                        <div className="space-y-1 text-[12.5px] text-brand-muted">
                          {(e.atividades ?? []).map((a, i) => (
                            <p key={a.id} style={{ paddingLeft: nivelAtividade(a) * 18 }}>
                              <span className="mr-1.5 text-[11px] text-brand-faint">
                                {numeros[i]}
                              </span>
                              <span className={temFilhos(e.atividades, i) ? "font-bold text-brand-navy-2" : ""}>
                                {a.descricao}
                              </span>
                            </p>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && escopos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-faint">
                  Nenhum escopo importado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ImportarEscopoModal open={importarAberto} onClose={() => setImportarAberto(false)} />

      <EscopoFormModal
        open={editando !== null}
        escopo={editando === "novo" ? null : editando}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}

export default function EscoposPage() {
  return (
    <ProtectedPage perfis={["administrador"]}>
      <EscoposPageContent />
    </ProtectedPage>
  );
}
