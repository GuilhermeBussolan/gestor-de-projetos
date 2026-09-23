"use client";

import { useMemo, useState, type ReactNode } from "react";
import { orderBy } from "firebase/firestore";
import { ArrowRight, Clock, FileSpreadsheet, GitCompareArrows, History, ListChecks, ListTree, MessageSquareText, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Field";
import { useCollection } from "@/lib/useCollection";
import { formatarHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { duracaoEmMinutos, formatarMinutos, idsFolhas, nivelAtividade, numerarAtividades } from "@/lib/escopo";
import { compararVersoes } from "@/lib/versaoCronograma";
import { ChipsResumo, ListaMudancas } from "@/components/importacao/ConferenciaVersao";
import type { Cliente, Projeto, Recurso, VersaoCronograma } from "@/types";

function dataHora(ms: number) {
  return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function textoDelta(minutos: number) {
  if (minutos === 0) return "sem alteração no previsto";
  return `${minutos > 0 ? "+" : "−"}${formatarMinutos(Math.abs(minutos))} no previsto`;
}

function variacao(minutos: number) {
  if (minutos === 0) return "0h";
  return `${minutos > 0 ? "+" : "−"}${formatarMinutos(Math.abs(minutos))}`;
}

/** Botão de aba/alternância no padrão dos filtros do sistema (pílula com borda; ativo em azul suave). */
function BotaoAba({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`inline-flex h-9 items-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-all ${
        ativo
          ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
          : "border-brand-border bg-white text-brand-navy-2 hover:bg-brand-hover"
      }`}
    >
      {icone}
      {children}
    </button>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-white px-3.5 py-3 shadow-card">
      <p className="text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">{rotulo}</p>
      <p className="mt-0.5 text-[18px] font-extrabold tracking-[-0.01em] text-brand-navy-2">{valor}</p>
      {detalhe && <p className="text-[11.5px] text-brand-faint">{detalhe}</p>}
    </div>
  );
}

function CronogramaDaVersao({ versao }: { versao: VersaoCronograma }) {
  const numeracao = numerarAtividades(versao.atividades);
  const folhas = idsFolhas(versao.atividades);
  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-brand-border bg-white">
      <table className="w-full text-[12.5px]">
        <tbody>
          {versao.atividades.map((a, i) => {
            const grupo = !folhas.has(a.id);
            return (
              <tr key={a.id} className={`border-t border-brand-border-soft first:border-t-0 ${grupo ? "bg-brand-hover" : ""}`}>
                <td className="w-14 px-3 py-1.5 text-brand-faint">{numeracao[i]}</td>
                <td
                  className={`px-2 py-1.5 text-brand-navy-2 ${grupo ? "font-bold" : ""}`}
                  style={{ paddingLeft: 8 + nivelAtividade(a) * 18 }}
                >
                  {a.descricao}
                  {a.realizadaEmVersaoAnterior && (
                    <span className="ml-1.5 rounded-full bg-[#e3f5ea] px-1.5 py-0.5 text-[9.5px] font-bold text-[#15754c]">
                      Realizada (versão anterior)
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap text-brand-muted">
                  {folhas.has(a.id) ? formatarMinutos(duracaoEmMinutos(a)) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CartaoVersao({
  versao,
  anterior,
  atual,
  ultima,
}: {
  versao: VersaoCronograma;
  anterior: VersaoCronograma | null;
  atual: boolean;
  ultima: boolean;
}) {
  const [aberto, setAberto] = useState<"mudancas" | "cronograma" | null>(null);
  const alternar = (v: "mudancas" | "cronograma") => setAberto((cur) => (cur === v ? null : v));
  const temMudancas = !!anterior && versao.origem === "importacao";
  const agendaPreservada = versao.resumo.agendaPreservada ?? 0;

  return (
    <div className="relative pl-12">
      {/* linha do tempo */}
      {!ultima && <span className="absolute top-10 bottom-[-20px] left-[17px] w-0.5 bg-brand-border" aria-hidden />}
      <span
        className={`absolute top-0 left-0 flex h-9 w-9 items-center justify-center rounded-full text-[12.5px] font-extrabold ${
          atual ? "bg-brand-accent text-white shadow-[0_6px_16px_rgba(47,111,228,0.28)]" : "bg-brand-accent-soft text-brand-accent"
        }`}
      >
        v{versao.numero}
      </span>

      <div
        className={`rounded-2xl border bg-white p-4 shadow-card ${atual ? "border-brand-accent/50" : "border-brand-border"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-extrabold text-brand-navy-2">
            {versao.origem === "escopo_inicial" ? "Escopo inicial" : `Versão ${versao.numero}`}
          </span>
          {atual && (
            <span className="rounded-full bg-[#e3f5ea] px-2 py-0.5 text-[10.5px] font-bold text-[#15754c]">Versão atual</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-brand-faint">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} /> {dataHora(versao.criadoEm)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User size={13} /> {versao.usuarioNome}
          </span>
          {versao.arquivoNome && (
            <span className="inline-flex items-center gap-1.5">
              <FileSpreadsheet size={13} /> {versao.arquivoNome}
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2.5 rounded-xl border-l-[3px] border-brand-accent bg-brand-hover px-3.5 py-2.5">
          <MessageSquareText size={15} className="mt-0.5 shrink-0 text-brand-accent" />
          <p className="text-[13px] whitespace-pre-wrap text-brand-navy-2">{versao.observacao}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-brand-muted">
          <span>
            <strong className="text-brand-navy-2">{versao.totalTarefas}</strong> tarefas ·{" "}
            <strong className="text-brand-navy-2">{formatarMinutos(versao.totalMinutos)}</strong> previstas
            {anterior && (
              <span className="text-brand-faint"> ({textoDelta(versao.totalMinutos - anterior.totalMinutos)})</span>
            )}
          </span>
          {temMudancas && <ChipsResumo resumo={versao.resumo} />}
        </div>

        {versao.horasSemVinculo > 0 && (
          <p className="mt-2 text-[12px] font-semibold text-[#a4650d]">
            {formatarHoras(versao.horasSemVinculo)} apontadas em tarefas que saíram do cronograma nesta versão (ficaram sem
            tarefa; continuam no total do projeto).
          </p>
        )}
        {agendaPreservada > 0 && (
          <p className="mt-2 text-[12px] font-semibold text-[#15754c]">
            {agendaPreservada} tarefa{agendaPreservada === 1 ? "" : "s"} já concluída{agendaPreservada === 1 ? "" : "s"} manteve
            {agendaPreservada === 1 ? "" : "ram"} a data, o período e o recurso em que foi realizada.
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap gap-2 border-t border-brand-border-soft pt-3.5">
          {temMudancas && (
            <BotaoAba ativo={aberto === "mudancas"} onClick={() => alternar("mudancas")} icone={<ListChecks size={15} />}>
              O que mudou
              <span className="rounded-full bg-brand-bg px-1.5 text-[11px] font-bold text-brand-muted">
                {versao.mudancas.length}
              </span>
            </BotaoAba>
          )}
          <BotaoAba ativo={aberto === "cronograma"} onClick={() => alternar("cronograma")} icone={<ListTree size={15} />}>
            Ver cronograma desta versão
          </BotaoAba>
        </div>

        {aberto === "mudancas" && (
          <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-brand-border bg-white">
            <ListaMudancas mudancas={versao.mudancas} />
            {versao.mudancas.length >= 400 && (
              <p className="border-t border-brand-border-soft p-2 text-[11.5px] text-brand-faint">
                Lista limitada às 400 primeiras mudanças.
              </p>
            )}
          </div>
        )}
        {aberto === "cronograma" && (
          <div className="mt-3">
            <CronogramaDaVersao versao={versao} />
          </div>
        )}
      </div>
    </div>
  );
}

function Comparador({ versoes, recursos }: { versoes: VersaoCronograma[]; recursos: Recurso[] }) {
  const [de, setDe] = useState(String(versoes[Math.max(versoes.length - 2, 0)].numero));
  const [para, setPara] = useState(String(versoes[versoes.length - 1].numero));
  const resultado = useMemo(() => {
    const a = versoes.find((v) => String(v.numero) === de);
    const b = versoes.find((v) => String(v.numero) === para);
    if (!a || !b) return null;
    return {
      a,
      b,
      ...compararVersoes(a.atividades, b.atividades, (id) => recursos.find((r) => r.id === id)?.nomeCompleto ?? "recurso"),
    };
  }, [versoes, recursos, de, para]);

  return (
    <div className="space-y-3 rounded-2xl border border-brand-accent/30 bg-brand-accent-soft/40 p-4">
      <div className="flex flex-wrap items-center gap-2.5 text-[13px] font-semibold text-brand-navy-2">
        <GitCompareArrows size={16} className="text-brand-accent" />
        Comparar
        <Select value={de} onChange={(e) => setDe(e.target.value)} style={{ width: 96 }}>
          {versoes.map((v) => (
            <option key={v.id} value={v.numero}>
              v{v.numero}
            </option>
          ))}
        </Select>
        <ArrowRight size={15} className="text-brand-faint" />
        <Select value={para} onChange={(e) => setPara(e.target.value)} style={{ width: 96 }}>
          {versoes.map((v) => (
            <option key={v.id} value={v.numero}>
              v{v.numero}
            </option>
          ))}
        </Select>
      </div>
      {resultado && (
        <>
          <p className="text-[12.5px] text-brand-muted">
            Previsto: <strong className="text-brand-navy-2">{formatarMinutos(resultado.a.totalMinutos)}</strong> →{" "}
            <strong className="text-brand-navy-2">{formatarMinutos(resultado.b.totalMinutos)}</strong> (
            {textoDelta(resultado.b.totalMinutos - resultado.a.totalMinutos)})
          </p>
          <ChipsResumo resumo={resultado.resumo} />
          <div className="max-h-72 overflow-y-auto rounded-xl border border-brand-border bg-white">
            <ListaMudancas mudancas={resultado.mudancas} />
          </div>
        </>
      )}
    </div>
  );
}

export function HistoricoCronogramaModal({
  open,
  projeto,
  recursos,
  onClose,
}: {
  open: boolean;
  projeto: Pick<Projeto, "id" | "clienteId" | "codigoProposta">;
  recursos: Recurso[];
  onClose: () => void;
}) {
  const { data: versoes, loading, erro } = useCollection<VersaoCronograma>(
    `projetos/${projeto.id}/versoesCronograma`,
    [orderBy("numero", "asc")],
    open,
    [projeto.id, open]
  );
  const { data: clientes } = useCollection<Cliente>("clientes", [orderBy("createdAt", "asc")], open, [open]);
  const cliente = clientes.find((c) => c.id === projeto.clienteId);
  const nomeCliente = cliente ? nomeExibicaoCliente(cliente) : projeto.codigoProposta;
  const [comparando, setComparando] = useState(false);
  const recentesPrimeiro = [...versoes].reverse();
  const atual = versoes[versoes.length - 1];
  const primeira = versoes[0];
  const temVariasVersoes = !!atual && !!primeira && primeira.numero !== atual.numero;

  return (
    <Modal open={open} onClose={onClose} title={`${nomeCliente} — Histórico de cronograma`} extraWide>
      <div className="space-y-5">
        {loading && <p className="py-10 text-center text-sm text-brand-muted">Carregando...</p>}
        {erro && (
          <p className="rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">
            Não foi possível ler o histórico. Confirme que as regras do Firestore foram publicadas.
          </p>
        )}
        {!loading && !erro && versoes.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-border bg-white px-6 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-accent-soft text-brand-accent">
              <History size={20} />
            </span>
            <p className="text-sm font-bold text-brand-navy-2">Nenhuma versão registrada ainda</p>
            <p className="max-w-sm text-[13px] text-brand-muted">
              Cada vez que um cronograma é importado, ele entra aqui com a observação de quem importou e o que mudou em
              relação à versão anterior.
            </p>
          </div>
        )}

        {atual && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicador rotulo="Versão atual" valor={`v${atual.numero}`} detalhe={dataHora(atual.criadoEm)} />
            <Indicador rotulo="Versões" valor={String(versoes.length)} detalhe="registradas no histórico" />
            <Indicador rotulo="Previsto atual" valor={formatarMinutos(atual.totalMinutos)} detalhe={`${atual.totalTarefas} tarefas`} />
            <Indicador
              rotulo={temVariasVersoes ? `Variação desde v${primeira.numero}` : "Variação"}
              valor={temVariasVersoes ? variacao(atual.totalMinutos - primeira.totalMinutos) : "—"}
              detalhe="no previsto total"
            />
          </div>
        )}

        {versoes.length > 1 && (
          <div className="space-y-3">
            <BotaoAba ativo={comparando} onClick={() => setComparando((v) => !v)} icone={<GitCompareArrows size={15} />}>
              Comparar duas versões
            </BotaoAba>
            {comparando && <Comparador versoes={versoes} recursos={recursos} />}
          </div>
        )}

        {recentesPrimeiro.length > 0 && (
          <div className="space-y-5">
            {recentesPrimeiro.map((v, i) => (
              <CartaoVersao
                key={v.id}
                versao={v}
                atual={i === 0}
                anterior={recentesPrimeiro[i + 1] ?? null}
                ultima={i === recentesPrimeiro.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
