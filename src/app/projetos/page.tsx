"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { TelaCheia } from "@/components/ui/TelaCheia";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { ProjetoDrawerConteudo } from "@/components/projetos/ProjetoDrawer";
import { ProjetoFormModal } from "@/components/projetos/ProjetoFormModal";
import { EditarProjetoModal } from "@/components/projetos/EditarProjetoModal";
import { AlterarTermometroModal } from "@/components/projetos/AlterarTermometroModal";
import { ContatoModal } from "@/components/dashboard/ContatoModal";
import { ImportarProjetosModal } from "@/components/importacao/ImportarProjetosModal";
import { Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularPercentualProjeto } from "@/lib/dashboardCalc";
import { TERMOMETRO_CONFIG } from "@/lib/constants";
import { termometroEfetivo } from "@/lib/termometro";
import { MODULOS, TIPOS_ATENDIMENTO } from "@/types";
import type { Cliente, Escopo, EventoCalendario, Projeto, Recurso, TipoDocumento } from "@/types";

function ProjetosPageContent() {
  const { usuario } = useAuth();
  const searchParams = useSearchParams();
  const destaqueId = searchParams.get("projetoId");

  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const { data: recursos } = useCollection<Recurso>("recursos");
  const { data: tiposDocumento } = useCollection<TipoDocumento>("tiposDocumento", []);
  const { data: eventos } = useCollection<EventoCalendario>("eventosCalendario", []);
  const { data: escopos } = useCollection<Escopo>("escopos", []);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [editando, setEditando] = useState<Projeto | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(destaqueId);
  const [contatoProjeto, setContatoProjeto] = useState<Projeto | null>(null);
  const [alterandoTermometro, setAlterandoTermometro] = useState<Projeto | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [importarAberto, setImportarAberto] = useState(false);

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "coordenador";

  const projetoDetalhe = projetos.find((p) => p.id === detalheId) ?? null;

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return projetos.filter((p) => {
      if (filtroModulo && p.modulo !== filtroModulo) return false;
      if (filtroTipo && p.tipoAtendimento !== filtroTipo) return false;
      if (!termo) return true;
      const cliente = clientes.find((c) => c.id === p.clienteId);
      const alvo = `${nomeExibicaoCliente(cliente)} ${p.codigoProposta}`.toLowerCase();
      return alvo.includes(termo);
    });
  }, [projetos, clientes, busca, filtroModulo, filtroTipo]);

  async function excluir(projeto: Projeto) {
    const cliente = clientes.find((c) => c.id === projeto.clienteId);
    if (!confirm(`Excluir o projeto de "${nomeExibicaoCliente(cliente)}"?`)) return;
    await deleteDoc(doc(db, "projetos", projeto.id));
    setDetalheId(null);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Input
            placeholder="Buscar cliente ou proposta"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-64"
          />
          <Select
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
            className="w-40"
          >
            <option value="">Todos os módulos</option>
            {MODULOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-44">
            <option value="">Todos os tipos</option>
            {TIPOS_ATENDIMENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportarAberto(true)}>
              <Upload size={15} /> Importar
            </Button>
            <Button onClick={() => setModalNovoAberto(true)}>+ Novo projeto</Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-[13.5px]">
            <thead>
              <tr className="bg-brand-hover">
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Termômetro
                </th>
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Cliente
                </th>
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Proposta
                </th>
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Módulo
                </th>
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Tipo
                </th>
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Coordenador
                </th>
                <th className="px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Período
                </th>
                <th className="w-[210px] px-[18px] py-3.5 text-left text-[11px] font-bold tracking-[.09em] text-brand-faint uppercase">
                  Progresso
                </th>
              </tr>
            </thead>
            <tbody>
              {projetosFiltrados.map((p) => {
                const cliente = clientes.find((c) => c.id === p.clienteId);
                const coordenador = recursos.find((r) => r.id === p.coordenadorId);
                const percentual = calcularPercentualProjeto(p, eventos);
                const termometroCfg = TERMOMETRO_CONFIG[termometroEfetivo(p)];
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDetalheId(p.id)}
                    className={`cursor-pointer border-t border-brand-border-soft hover:bg-brand-hover ${
                      detalheId === p.id ? "bg-brand-accent-soft/40" : ""
                    }`}
                  >
                    <td className="px-[18px] py-[15px]">
                      <span
                        title={termometroCfg.label}
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: termometroCfg.text }}
                      />
                    </td>
                    <td className="px-[18px] py-[15px] font-bold text-brand-navy-2">
                      <div className="flex items-center gap-1.5">
                        {nomeExibicaoCliente(cliente)}
                        {p.status === "finalizado" && (
                          <span className="rounded-full bg-brand-hover px-1.5 py-[1px] text-[9px] font-bold text-brand-faint">
                            Finalizado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-[18px] py-[15px] text-brand-muted">{p.codigoProposta}</td>
                    <td className="px-[18px] py-[15px]">
                      <span className="rounded-full bg-brand-accent-soft px-2.5 py-1 text-[11px] font-bold text-[#2456b8]">
                        {p.modulo}
                      </span>
                    </td>
                    <td className="px-[18px] py-[15px] text-brand-muted">{p.tipoAtendimento}</td>
                    <td className="px-[18px] py-[15px] text-brand-navy-2">
                      {coordenador ? coordenador.nomeCompleto : "—"}
                    </td>
                    <td className="px-[18px] py-[15px] text-[12.5px]">
                      <PeriodoBadge dataInicio={p.dataInicio} dataFim={p.dataFim} className="text-brand-muted" />
                    </td>
                    <td className="px-[18px] py-[15px]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-[110px] overflow-hidden rounded-full bg-brand-accent-soft">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percentual}%`,
                              background:
                                percentual >= 100
                                  ? "linear-gradient(90deg,#1f9a63,#15754c)"
                                  : "linear-gradient(90deg,#4d8bf5,#2f6fe4)",
                            }}
                          />
                        </div>
                        <span className="text-[12.5px] font-bold text-brand-navy-2">{percentual}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {projetosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-brand-faint">
                    Nenhum projeto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TelaCheia open={!!projetoDetalhe} onClose={() => setDetalheId(null)}>
        {projetoDetalhe && (
          <ProjetoDrawerConteudo
            projeto={projetoDetalhe}
            cliente={nomeExibicaoCliente(clientes.find((c) => c.id === projetoDetalhe.clienteId))}
            coordenador={recursos.find((r) => r.id === projetoDetalhe.coordenadorId)}
            consultores={recursos.filter((r) => projetoDetalhe.consultorIds?.includes(r.id))}
            eventos={eventos}
            recursos={recursos}
            podeEditar={!!podeEditar}
            podeVerFinanceiro={usuario?.perfil === "administrador" || usuario?.perfil === "financeiro"}
            telaCheia
            onEditar={() => setEditando(projetoDetalhe)}
            onExcluir={() => excluir(projetoDetalhe)}
            onClose={() => setDetalheId(null)}
            onRegistrarContato={() => setContatoProjeto(projetoDetalhe)}
            onAlterarTermometro={() => setAlterandoTermometro(projetoDetalhe)}
          />
        )}
      </TelaCheia>

      <ContatoModal
        projeto={contatoProjeto}
        cliente={clientes.find((c) => c.id === contatoProjeto?.clienteId)}
        onClose={() => setContatoProjeto(null)}
      />

      {usuario && (
        <AlterarTermometroModal
          key={alterandoTermometro?.id}
          projeto={alterandoTermometro}
          usuario={usuario}
          onClose={() => setAlterandoTermometro(null)}
        />
      )}

      <ProjetoFormModal
        open={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        clientes={clientes}
        recursos={recursos}
        tiposDocumento={tiposDocumento}
        escopos={escopos}
      />
      <EditarProjetoModal
        projeto={editando}
        onClose={() => setEditando(null)}
        recursos={recursos}
        tiposDocumento={tiposDocumento}
        escopos={escopos}
        projetos={projetos}
      />
      <ImportarProjetosModal
        open={importarAberto}
        onClose={() => setImportarAberto(false)}
        clientes={clientes}
        projetosExistentes={projetos}
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
