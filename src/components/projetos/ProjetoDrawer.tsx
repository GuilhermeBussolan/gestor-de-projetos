"use client";

import { useState } from "react";
import { updateDoc, doc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { Button } from "@/components/ui/Button";
import { PeriodoBadge } from "@/components/projetos/PeriodoBadge";
import { CronogramaAcoes } from "@/components/projetos/CronogramaAcoes";
import { useAuth } from "@/contexts/AuthContext";
import { EnvolvidosProjeto } from "@/components/projetos/EnvolvidosProjeto";
import {
  CODIGO_TERMO_ENCERRAMENTO,
  STATUS_DOCUMENTO_CONFIG,
  STATUS_DOCUMENTO_ORDEM,
  STATUS_PARCELA_CONFIG,
  TERMOMETRO_CONFIG,
  TIPO_FATURAMENTO_CONFIG,
  TIPO_RECURSO_CONFIG,
} from "@/lib/constants";
import {
  calcularAtividadesConcluidas,
  calcularHorasRealizadas,
  calcularPercentualProjeto,
  calcularRegistrosAtividades,
  resumoGruposRotina,
} from "@/lib/dashboardCalc";
import { contarFolhas, duracaoEmMinutos, formatarDataCurta, nivelAtividade, numerarAtividades, temFilhos } from "@/lib/escopo";
import { calcularProgressoFolhas } from "@/lib/progressoEscopo";
import { sistemasQrh } from "@/lib/qrh";
import { termometroEfetivo } from "@/lib/termometro";
import { RegistroItem } from "@/components/timeline/RegistroItem";
import { PrevisaoFaturamentoInline } from "@/components/financeiro/PrevisaoFaturamentoInline";
import type { ContatoProjeto, EventoCalendario, Projeto, Recurso, StatusDocumento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarDataHoraCurta(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BarraHorasDrawer({ label, realizado, previsto }: { label: string; realizado: number; previsto: number }) {
  const percentual = previsto > 0 ? Math.min(100, (realizado / previsto) * 100) : 0;
  const estourou = previsto > 0 && realizado > previsto;
  return (
    <div className="rounded-xl border border-brand-border bg-white p-3.5 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
      <div className="mb-1 text-[11.5px] text-brand-faint">{label}</div>
      <div className={`text-lg font-bold ${estourou ? "text-[#b5392a]" : "text-brand-navy-2"}`}>
        {realizado.toFixed(1)}h{previsto > 0 ? ` / ${previsto.toFixed(1)}h` : ""}
      </div>
      {previsto > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-brand-accent-soft">
          <div
            className={`h-full rounded-full ${estourou ? "bg-[#e0543c]" : "bg-[#8fa8dd]"}`}
            style={{ width: `${percentual}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ProjetoDrawerConteudo({
  projeto,
  cliente,
  coordenador,
  consultores,
  eventos,
  recursos,
  podeEditar,
  podeVerFinanceiro,
  souConsultor = false,
  telaCheia = false,
  onEditar,
  onExcluir,
  onClose,
  onRegistrarContato,
  onAlterarTermometro,
}: {
  projeto: Projeto;
  cliente: string;
  coordenador: Recurso | undefined;
  consultores: Recurso[];
  eventos: EventoCalendario[];
  recursos: Recurso[];
  podeEditar: boolean;
  podeVerFinanceiro: boolean;
  souConsultor?: boolean;
  /** Tela cheia (módulo Projetos): mais largo e com o detalhe de cada parcela. */
  telaCheia?: boolean;
  onEditar: () => void;
  onExcluir: () => void;
  onClose: () => void;
  onRegistrarContato: () => void;
  onAlterarTermometro: () => void;
}) {
  const [escopoAberto, setEscopoAberto] = useState(false);
  // Consultor não vê os dados comerciais da proposta (ex: data de assinatura).
  const { usuario } = useAuth();
  const ehConsultor = souConsultor || usuario?.perfil === "consultor";

  const { data: atualizacoesRecentes } = useCollection<ContatoProjeto>(
    `projetos/${projeto.id}/contatos`,
    [orderBy("criadoEm", "desc"), limit(3)]
  );

  const termometro = termometroEfetivo(projeto);
  const termometroCfg = TERMOMETRO_CONFIG[termometro];
  const percentual = calcularPercentualProjeto(projeto, eventos);
  const horas = calcularHorasRealizadas(projeto.id, eventos, recursos);
  const atividadesConcluidas = calcularAtividadesConcluidas(projeto.id, eventos);
  const registrosAtividades = calcularRegistrosAtividades(projeto.id, eventos, recursos);
  const progressoFolhas = calcularProgressoFolhas(projeto.id, projeto.escopoAtividades ?? [], eventos);
  const folhasEscopo = contarFolhas(projeto.escopoAtividades ?? [], atividadesConcluidas);
  const numeracaoEscopo = numerarAtividades(projeto.escopoAtividades ?? []);
  // Só existe quando o cronograma foi importado (é dele que vem a duração por atividade).
  const gruposRotina = resumoGruposRotina(projeto.id, projeto.escopoAtividades ?? [], eventos).filter(
    (g) => g.horasPrevistas > 0
  );
  const sistemasDoCliente = sistemasQrh(projeto);
  const previstoConsultor = projeto.horasPrevistasConsultor ?? 0;
  const previstoCoordenador = projeto.horasPrevistasCoordenador ?? 0;
  const finalizado = projeto.status === "finalizado";
  const cancelado = projeto.status === "cancelado";
  const contatoFaturamento = projeto.contatoFaturamento;
  const temContatoFaturamento =
    !!contatoFaturamento &&
    Object.values(contatoFaturamento).some((v) => (v ?? "").toString().trim() !== "");

  async function alterarStatus(tipoDocumentoId: string, status: StatusDocumento) {
    const documentoAlterado = projeto.documentos.find((d) => d.tipoDocumentoId === tipoDocumentoId);
    const documentos = projeto.documentos.map((d) =>
      d.tipoDocumentoId === tipoDocumentoId ? { ...d, status } : d
    );
    const encerraProjeto = documentoAlterado?.codigo === CODIGO_TERMO_ENCERRAMENTO && status === "ASSINADO";
    await updateDoc(doc(db, "projetos", projeto.id), {
      documentos,
      ...(encerraProjeto ? { status: "finalizado" } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  async function reabrirProjeto() {
    if (!confirm("Reabrir este projeto? Ele volta a aceitar apontamentos normalmente.")) return;
    await updateDoc(doc(db, "projetos", projeto.id), {
      status: "ativo",
      cancelamento: null,
      updatedAt: serverTimestamp(),
    });
  }

  return (
    <div
      className={
        telaCheia
          ? "mx-auto flex max-h-[calc(100vh-4rem)] max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-card-lg"
          : undefined
      }
    >
      <div className={`relative overflow-hidden bg-brand-navy px-6 pt-6 pb-6 text-white ${telaCheia ? "shrink-0" : ""}`}>
        <div
          className="pointer-events-none absolute -top-[140px] -right-20 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(47,111,228,.45) 0%, rgba(47,111,228,0) 70%)" }}
        />
        <div className="relative mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-white/60">
              <span>
                {projeto.codigoProposta} · {projeto.modulo} · {projeto.tipoAtendimento}
              </span>
              <PeriodoBadge
                dataInicio={projeto.dataInicio}
                dataFim={projeto.dataFim}
                className="text-white/60"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[22px] font-extrabold tracking-[-0.02em]">{cliente}</div>
              {finalizado && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold text-white">
                  Finalizado
                </span>
              )}
              {cancelado && (
                <span className="rounded-full bg-[#e0543c]/25 px-2.5 py-1 text-[10.5px] font-bold text-white">
                  Cancelado
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-[9px] border border-white/25 bg-white/8 px-3.5 py-2 text-[13px] font-semibold hover:bg-white/18"
          >
            Fechar
          </button>
        </div>
        <div className="relative mb-2.5 flex items-end justify-between">
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-[.1em] text-white/55 uppercase">
              Andamento
            </div>
            <div className="text-[42px] leading-[.9] font-extrabold tracking-[-0.04em]">{percentual}%</div>
          </div>
          <div className="text-right text-xs leading-relaxed text-white/60">
            Coordenador
            <br />
            <strong className="text-white">{coordenador?.nomeCompleto ?? "Sem coordenador"}</strong>
          </div>
        </div>
        <div className="relative h-[9px] w-full overflow-hidden rounded-full bg-white/14">
          <div
            className="h-full rounded-full"
            style={{ width: `${percentual}%`, background: "linear-gradient(90deg,#63a0ff,#2f6fe4)" }}
          />
        </div>
      </div>

      <div className={`px-6 pt-5.5 pb-8 ${telaCheia ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-brand-border bg-white p-4 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: termometroCfg.text }}
              />
              <span className="text-[12.5px] font-extrabold" style={{ color: termometroCfg.text }}>
                Termômetro: {termometroCfg.label}
              </span>
            </div>
            {projeto.termometroObservacao ? (
              <p className="text-[12.5px] leading-relaxed text-brand-muted">
                <span className="text-brand-faint">
                  {formatarDataHoraCurta(projeto.termometroObservacao.criadoEm)} ·{" "}
                  {projeto.termometroObservacao.usuarioNome}:
                </span>{" "}
                {projeto.termometroObservacao.texto}
              </p>
            ) : (
              <p className="text-[12px] text-brand-faint">Nenhuma observação registrada.</p>
            )}
          </div>
          {podeEditar && (
            <Button variant="secondary" onClick={onAlterarTermometro} className="shrink-0">
              Alterar
            </Button>
          )}
        </div>

        {cancelado && projeto.cancelamento && (
          <div className="mb-5 rounded-xl border border-[#f5c6bd] bg-[#fdeceb] p-4">
            <p className="mb-1 text-[12.5px] font-extrabold text-[#b5392a]">Projeto cancelado</p>
            <p className="text-[12.5px] leading-relaxed text-[#b5392a]">
              <span className="opacity-75">
                {formatarDataHoraCurta(projeto.cancelamento.criadoEm)} · {projeto.cancelamento.usuarioNome}:
              </span>{" "}
              {projeto.cancelamento.motivo}
            </p>
          </div>
        )}

        <p className="mb-5 text-sm text-brand-muted">
          Consultores:{" "}
          {consultores.length > 0
            ? consultores
                .map((c) => `${c.nomeCompleto} (${c.codigo}) — ${TIPO_RECURSO_CONFIG[c.tipo].label}`)
                .join("; ")
            : "Sem consultor"}
        </p>

        {(previstoConsultor > 0 || horas.consultor > 0 || (!souConsultor && (previstoCoordenador > 0 || horas.coordenador > 0))) && (
          <div className={`mb-5.5 grid gap-3.5 ${souConsultor ? "grid-cols-1" : "grid-cols-2"}`}>
            <BarraHorasDrawer label="Consultor" realizado={horas.consultor} previsto={previstoConsultor} />
            {!souConsultor && (
              <BarraHorasDrawer
                label="Coordenador"
                realizado={horas.coordenador}
                previsto={previstoCoordenador}
              />
            )}
          </div>
        )}

        {sistemasDoCliente.length > 0 && (
          <div className="mb-5.5">
            <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Módulo QRH — sistemas do cliente</p>
            <div className="grid grid-cols-3 gap-2.5">
              {sistemasDoCliente.map((sis) => (
                <div
                  key={sis.rotulo}
                  className="rounded-xl border border-brand-border bg-brand-accent-soft/50 px-3.5 py-2.5 shadow-[0_8px_20px_rgba(21,40,73,0.05)]"
                >
                  <p className="text-[10.5px] font-bold tracking-[.06em] text-brand-faint uppercase">{sis.rotulo}</p>
                  <p className="text-[14px] font-extrabold text-brand-navy-2">{sis.valor}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {projeto.escopoAtividades && projeto.escopoAtividades.length > 0 && (
          <div className="mb-5.5">
            <button
              type="button"
              onClick={() => setEscopoAberto((v) => !v)}
              className="mb-2 flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-sm font-extrabold text-brand-navy-2">
                {projeto.escopoNome ? `Escopo do projeto — ${projeto.escopoNome}` : "Cronograma do projeto"}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-bold text-brand-faint">
                {folhasEscopo.feitas}/{folhasEscopo.total} concluídas
                {escopoAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-accent-soft">
              <div
                className="h-full rounded-full bg-[#1f9a63]"
                style={{
                  width: `${folhasEscopo.total > 0 ? (folhasEscopo.feitas / folhasEscopo.total) * 100 : 0}%`,
                }}
              />
            </div>
            {escopoAberto && (
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-brand-border bg-white p-4 text-[12.5px] shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
                {projeto.escopoAtividades.map((a, i) => {
                  const feita = atividadesConcluidas.has(a.id);
                  const pai = temFilhos(projeto.escopoAtividades!, i);
                  const feitoEm = registrosAtividades.get(a.id) ?? [];
                  return (
                    <div key={a.id} style={{ paddingLeft: nivelAtividade(a) * 18 }}>
                      <p className={feita ? "text-[#15754c]" : "text-brand-muted"}>
                        <span className="mr-1.5 text-[11px] text-brand-faint">{numeracaoEscopo[i]}</span>
                        <span
                          className={`${pai ? "font-bold" : ""} ${feita && !pai ? "line-through decoration-[#15754c]/50" : ""}`}
                        >
                          {a.descricao}
                        </span>
                        {feita && <CheckCircle2 size={12} className="ml-1 -mt-0.5 inline align-middle" />}
                      </p>
                      {feitoEm.length > 0 && (
                        <p className={`text-[11px] ${feita ? "text-[#15754c]" : "text-[#2456b8]"}`}>
                          {feita ? "Feito em" : "Apontado em"}:{" "}
                          {feitoEm
                            .map((r) => `${formatarDataCurta(r.data)} (${r.recursoNome})`)
                            .join(", ")}
                        </p>
                      )}
                      {!feita && !pai && (progressoFolhas.get(a.id)?.horas ?? 0) > 0 && (
                        <p className="text-[11px] font-semibold text-[#a4650d]">
                          Em andamento · {progressoFolhas.get(a.id)!.horas.toFixed(1)}h
                          {duracaoEmMinutos(a) > 0 ? ` de ${(duracaoEmMinutos(a) / 60).toFixed(1)}h` : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {gruposRotina.length > 0 && (
          <div className="mb-5.5">
            <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">
              Horas Previstas x Realizadas (por grupo de rotina)
            </p>
            <div className="overflow-hidden rounded-xl border border-brand-border bg-white shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
              {gruposRotina.map((g) => {
                const acima = g.diferenca > 0.01;
                const dentro = g.diferenca <= 0.01;
                return (
                  <div
                    key={g.grupoId}
                    className="border-t border-brand-border-soft px-4 py-2.5 first:border-t-0"
                  >
                    <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-navy-2">
                      {g.descricao}
                      {g.concluido && (
                        <span className="rounded-full bg-[#e3f5ea] px-1.5 py-0.5 text-[10px] font-bold text-[#15754c]">
                          Concluído
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-brand-muted">
                      <span>
                        Previsto: <strong className="text-brand-navy-2">{g.horasPrevistas.toFixed(1)}h</strong>
                      </span>
                      <span>
                        Realizado: <strong className="text-brand-navy-2">{g.horasRealizadas.toFixed(1)}h</strong>
                      </span>
                      <span
                        className={
                          acima ? "font-semibold text-[#b5392a]" : dentro ? "font-semibold text-[#15754c]" : ""
                        }
                      >
                        Diferença: {g.diferenca > 0 ? "+" : ""}
                        {g.diferenca.toFixed(1)}h
                      </span>
                      <span>{g.percentualRealizado.toFixed(0)}% realizado</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Documentos do projeto</p>
        <div className="mb-5.5 overflow-hidden rounded-xl border border-brand-border bg-white shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
          {projeto.documentos.map((d) => {
            const cfg = STATUS_DOCUMENTO_CONFIG[d.status];
            return (
              <div
                key={d.tipoDocumentoId}
                className="flex items-center gap-3 border-t border-brand-border-soft px-4 py-2.5 first:border-t-0"
              >
                <span className="w-[58px] shrink-0 text-[11px] font-bold text-brand-faint">{d.codigo}</span>
                <span className="flex-1 text-[12.5px] leading-tight text-brand-navy-2">{d.descricao}</span>
                {podeEditar ? (
                  <select
                    value={d.status}
                    onChange={(e) => alterarStatus(d.tipoDocumentoId, e.target.value as StatusDocumento)}
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                    className="shrink-0 rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold"
                  >
                    {STATUS_DOCUMENTO_ORDEM.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_DOCUMENTO_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap"
                  >
                    {cfg.label}
                  </span>
                )}
              </div>
            );
          })}
          {projeto.documentos.length === 0 && (
            <p className="px-4 py-4 text-sm text-brand-faint">Nenhum documento incluído neste projeto.</p>
          )}
        </div>

        {podeVerFinanceiro && (
          <>
            <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Financeiro</p>
            <div className="mb-5.5 rounded-xl border border-brand-border bg-white p-4 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-brand-faint">
                  {TIPO_FATURAMENTO_CONFIG[projeto.financeiro?.tipoFaturamento ?? "parcelado"].label}
                </span>
                <span className="text-lg font-extrabold text-brand-navy-2">
                  {projeto.financeiro?.tipoFaturamento === "apontamento_horas"
                    ? "Sem valor fixo"
                    : `${moeda(projeto.financeiro?.valorTotal ?? 0)} em ${projeto.financeiro?.numeroParcelas ?? 0}x`}
                </span>
              </div>
              {telaCheia &&
                projeto.financeiro?.tipoFaturamento !== "apontamento_horas" &&
                (projeto.financeiro?.parcelas ?? []).length > 0 && (
                  <div className="mt-3.5 flex flex-wrap gap-2.5 border-t border-brand-border-soft pt-3.5">
                    {projeto.financeiro!.parcelas.map((parc) => {
                      const cfgParcela = STATUS_PARCELA_CONFIG[parc.status];
                      const documentoDoMarco = parc.tipoDocumentoId
                        ? projeto.documentos.find((d) => d.tipoDocumentoId === parc.tipoDocumentoId)
                        : undefined;
                      return (
                        <div
                          key={parc.numero}
                          className="flex min-w-[170px] flex-col gap-1.5 rounded-xl border border-brand-border-soft bg-brand-input px-3.5 py-2.5"
                        >
                          <span className="text-[11px] text-brand-faint">
                            {parc.descricao ? parc.descricao : `Parcela ${parc.numero}`}
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13.5px] font-extrabold text-brand-navy-2">
                              {moeda(parc.valor)}
                            </span>
                            <span
                              style={{ backgroundColor: cfgParcela.bg, color: cfgParcela.text }}
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
                            >
                              {cfgParcela.label}
                            </span>
                          </div>
                          {documentoDoMarco && (
                            <span
                              style={{
                                backgroundColor: STATUS_DOCUMENTO_CONFIG[documentoDoMarco.status].bg,
                                color: STATUS_DOCUMENTO_CONFIG[documentoDoMarco.status].text,
                              }}
                              className="w-fit rounded-full px-2 py-0.5 text-[10px] font-bold"
                            >
                              MIT: {STATUS_DOCUMENTO_CONFIG[documentoDoMarco.status].label}
                            </span>
                          )}
                          {projeto.financeiro?.tipoFaturamento === "marco_faturamento" && (
                            <PrevisaoFaturamentoInline
                              projeto={projeto}
                              parcela={parc}
                              podeEditar={podeVerFinanceiro}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </>
        )}

        {podeVerFinanceiro && temContatoFaturamento && (
          <div className="mb-5.5">
            <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Contato de faturamento</p>
            <div className="rounded-xl border border-brand-border bg-white p-4 text-[13px] text-brand-muted shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
              {contatoFaturamento?.nome && (
                <p>
                  <span className="text-brand-faint">Nome:</span>{" "}
                  <span className="text-brand-navy-2">{contatoFaturamento.nome}</span>
                </p>
              )}
              {contatoFaturamento?.cnpj && (
                <p>
                  <span className="text-brand-faint">CNPJ de faturamento:</span>{" "}
                  <span className="text-brand-navy-2">{contatoFaturamento.cnpj}</span>
                </p>
              )}
              {contatoFaturamento?.email && (
                <p>
                  <span className="text-brand-faint">E-mail:</span>{" "}
                  <span className="text-brand-navy-2">{contatoFaturamento.email}</span>
                </p>
              )}
              {contatoFaturamento?.telefone && (
                <p>
                  <span className="text-brand-faint">Telefone:</span>{" "}
                  <span className="text-brand-navy-2">{contatoFaturamento.telefone}</span>
                </p>
              )}
              {contatoFaturamento?.emailNF && (
                <p>
                  <span className="text-brand-faint">E-mail para NF:</span>{" "}
                  <span className="text-brand-navy-2">{contatoFaturamento.emailNF}</span>
                </p>
              )}
              {contatoFaturamento?.memo && (
                <p className="mt-1.5 border-t border-brand-border-soft pt-1.5">{contatoFaturamento.memo}</p>
              )}
            </div>
          </div>
        )}

        {projeto.dataAssinaturaProposta && !ehConsultor && (
          <div className="mb-5.5">
            <p className="mb-2.5 text-sm font-extrabold text-brand-navy-2">Dados da proposta</p>
            <div className="rounded-xl border border-brand-border bg-white px-4 py-3 text-[12.5px] text-brand-muted shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
              Assinatura da proposta:{" "}
              <strong className="text-brand-navy-2">{formatarDataCurta(projeto.dataAssinaturaProposta)}</strong>
            </div>
          </div>
        )}

        <EnvolvidosProjeto projeto={projeto} />

        <div className="mb-5.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-sm font-extrabold text-brand-navy-2">Linha do tempo</p>
            {atualizacoesRecentes.length > 0 && (
              <button
                type="button"
                onClick={onRegistrarContato}
                className="text-[12.5px] font-semibold text-brand-accent hover:underline"
              >
                Ver tudo
              </button>
            )}
          </div>
          {atualizacoesRecentes.length > 0 ? (
            <div className="rounded-xl border border-brand-border bg-white p-4 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
              {atualizacoesRecentes.map((c) => (
                <div key={c.id} className="border-t border-brand-border-soft pt-2.5 pb-2.5 first:border-t-0 first:pt-0 last:pb-0">
                  <RegistroItem registro={c} compacto />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-brand-border bg-white p-4 text-[12.5px] text-brand-faint">
              Nenhuma atualização registrada ainda.
            </p>
          )}
        </div>

        {projeto.observacoes && (
          <div className="mb-5.5">
            <p className="mb-1.5 text-sm font-extrabold text-brand-navy-2">Observações</p>
            <p className="text-sm text-brand-muted">{projeto.observacoes}</p>
          </div>
        )}

        {/* Uso esporádico: fica no fim da página, abaixo da linha do tempo. */}
        <CronogramaAcoes projeto={projeto} recursos={recursos} />

        <div className="flex flex-wrap gap-2.5">
          {podeEditar && <Button onClick={onEditar}>Editar projeto</Button>}
          <Button variant="secondary" onClick={onRegistrarContato}>
            Registrar atualização
          </Button>
          {podeEditar && (finalizado || cancelado) && (
            <Button variant="secondary" onClick={reabrirProjeto}>
              Reabrir projeto
            </Button>
          )}
          {podeEditar && (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onExcluir}>
              Excluir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
