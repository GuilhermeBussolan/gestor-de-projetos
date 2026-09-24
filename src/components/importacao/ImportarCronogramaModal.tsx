"use client";

import { useMemo, useState } from "react";
import { orderBy, where } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { lerArquivoTabular } from "@/lib/importarArquivo";
import {
  aplicarAssociacaoRecursos,
  converterLinhasEmCronograma,
  nomesRecursosDoCronograma,
  type AtividadeCronogramaBruta,
} from "@/lib/importarCronograma";
import { ehCronogramaGantt, lerCronogramaGantt } from "@/lib/importarCronogramaGantt";
import { aplicarCorrecoesDuracao, atividadesSemDuracao } from "@/lib/importarEscopo";
import { idsFolhas, normalizarNiveis, numerarAtividades } from "@/lib/escopo";
import { calcularProgressoFolhas } from "@/lib/progressoEscopo";
import { casarAtividades, compararVersoes, preservarRealizado } from "@/lib/versaoCronograma";
import { gravarNovaVersaoCronograma } from "@/lib/versaoCronogramaDb";
import { ConferenciaVersao } from "@/components/importacao/ConferenciaVersao";
import { PERIODO_LABEL, idsAtividadesSobrepostas, todasAlocacoes } from "@/lib/cronograma";
import { TIPO_RECURSO_CONFIG } from "@/lib/constants";
import type { EscopoAtividade, EventoCalendario, Projeto, Recurso, VersaoCronograma } from "@/types";

type Etapa = "form" | "processando" | "corrigindo" | "recursos" | "conferencia" | "revisao" | "importando" | "concluido" | "erro";

function dataBR(iso: string | null | undefined) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

function CronogramaImportForm({
  projeto,
  recursos,
  outrosProjetos,
  onClose,
  onImportado,
  rascunho = false,
  onRascunho,
}: {
  projeto: Projeto;
  recursos: Recurso[];
  /** Todos os outros projetos, para checar sobreposição de agenda contra o que já está alocado. */
  outrosProjetos: Projeto[];
  onClose: () => void;
  onImportado: (atividades: EscopoAtividade[]) => void;
  /** true: o projeto ainda não existe (cadastro) — não grava nada, só devolve o cronograma via onRascunho. */
  rascunho?: boolean;
  onRascunho?: (dados: { atividades: EscopoAtividade[]; arquivoNome: string; observacao: string }) => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>("form");
  const [atividades, setAtividades] = useState<AtividadeCronogramaBruta[]>([]);
  const [correcoes, setCorrecoes] = useState<Map<string, string>>(new Map());
  const [associacao, setAssociacao] = useState<Map<string, string>>(new Map());
  const [erro, setErro] = useState("");
  const [arquivoNome, setArquivoNome] = useState("");
  const [observacao, setObservacao] = useState("");
  /** Vínculos manuais: id da atividade da versão atual -> id da atividade nova do arquivo. */
  const [vinculos, setVinculos] = useState<Map<string, string>>(new Map());
  const { usuario } = useAuth();
  const versoesCol = useCollection<VersaoCronograma>(
    `projetos/${projeto.id}/versoesCronograma`,
    [orderBy("numero", "asc")],
    !rascunho,
    [projeto.id, rascunho]
  );
  const versoes = versoesCol.data;
  const { data: eventosProjeto } = useCollection<EventoCalendario>(
    "eventosCalendario",
    [where("projetoId", "==", projeto.id)],
    !rascunho,
    [projeto.id, rascunho]
  );

  const faltando = useMemo(() => atividadesSemDuracao(atividades), [atividades]);
  const nomesRecurso = useMemo(() => nomesRecursosDoCronograma(atividades), [atividades]);
  const numeracao = useMemo(() => numerarAtividades(atividades), [atividades]);

  const atividadesFinal = useMemo(
    () => normalizarNiveis(aplicarAssociacaoRecursos(atividades, associacao)),
    [atividades, associacao]
  );
  // Cronograma "vivo": cada atividade do arquivo tenta reaproveitar o ID da equivalente já existente
  // no projeto, para o realizado (apontamentos guardam IDs) continuar ligado mesmo se a ordem mudar.
  const temEscopoAtual = (projeto.escopoAtividades ?? []).length > 0;
  const casamentoBase = useMemo(
    () => casarAtividades(projeto.escopoAtividades ?? [], atividadesFinal),
    [projeto.escopoAtividades, atividadesFinal]
  );
  const casamento = useMemo(
    () => casarAtividades(projeto.escopoAtividades ?? [], atividadesFinal, vinculos),
    [projeto.escopoAtividades, atividadesFinal, vinculos]
  );
  const horasPorAtividade = useMemo(
    () => calcularProgressoFolhas(projeto.id, projeto.escopoAtividades ?? [], eventosProjeto),
    [projeto.id, projeto.escopoAtividades, eventosProjeto]
  );
  const nomeRecurso = (id: string) => recursos.find((r) => r.id === id)?.nomeCompleto ?? "recurso";
  // O que já foi feito não se perde: tarefas concluídas mantêm data/recurso e as que saíram do arquivo
  // mas têm horas apontadas continuam no cronograma como "realizadas em versão anterior".
  const preservado = useMemo(
    () => preservarRealizado(projeto.escopoAtividades ?? [], casamento.atividades, horasPorAtividade, nomeRecurso),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projeto.escopoAtividades, casamento.atividades, horasPorAtividade, recursos]
  );
  const atividadesSalvar = temEscopoAtual ? preservado.atividades : atividadesFinal;
  const comparacao = useMemo(() => {
    const c = compararVersoes(projeto.escopoAtividades ?? [], atividadesSalvar, nomeRecurso);
    return { ...c, resumo: { ...c.resumo, agendaPreservada: preservado.agendaPreservada.length } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projeto.escopoAtividades, atividadesSalvar, recursos, preservado.agendaPreservada]);
  const removidasComHoras = useMemo(() => {
    const folhas = idsFolhas(projeto.escopoAtividades ?? []);
    return casamento.semParAntigas.filter(
      (a) => folhas.has(a.id) && (horasPorAtividade.get(a.id)?.horas ?? 0) > 0
    );
  }, [casamento.semParAntigas, projeto.escopoAtividades, horasPorAtividade]);
  const opcoesNovas = useMemo(() => {
    const folhasNovas = idsFolhas(atividadesFinal);
    return casamentoBase.semParNovas.filter((a) => folhasNovas.has(a.id));
  }, [casamentoBase.semParNovas, atividadesFinal]);
  const ultimaVersao = versoes.length > 0 ? versoes[versoes.length - 1].numero : null;

  const sobrepostas = useMemo(() => {
    const projetoSimulado = { id: projeto.id, codigoProposta: projeto.codigoProposta, escopoAtividades: atividadesSalvar };
    return idsAtividadesSobrepostas(todasAlocacoes([...outrosProjetos, projetoSimulado]));
  }, [atividadesSalvar, outrosProjetos, projeto.id, projeto.codigoProposta]);

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEtapa("processando");
    setErro("");
    try {
      const resultado = (await ehCronogramaGantt(file))
        ? await lerCronogramaGantt(file)
        : converterLinhasEmCronograma(await lerArquivoTabular(file));
      if (resultado.atividades.length === 0) {
        setErro(
          'Nenhuma atividade encontrada. Use "Atividade" (ou "Tarefa Pai"/"Tarefa Filha"), "Duração", "Data de Início", "Período" e "Recurso".'
        );
        setEtapa("erro");
        return;
      }
      setAtividades(resultado.atividades);
      setArquivoNome(file.name);
      setVinculos(new Map());
      setCorrecoes(new Map());
      setAssociacao(new Map());
      setEtapa(resultado.erros.length > 0 ? "corrigindo" : "recursos");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      setEtapa("erro");
    }
  }

  function aplicarCorrecoes() {
    const atualizado = aplicarCorrecoesDuracao(atividades, correcoes) as AtividadeCronogramaBruta[];
    setAtividades(atualizado);
    setCorrecoes(new Map());
    if (atividadesSemDuracao(atualizado).length === 0) setEtapa("recursos");
  }

  async function confirmar() {
    if (!usuario) return;
    setEtapa("importando");
    try {
      const atividadesSemUndefined = JSON.parse(JSON.stringify(atividadesSalvar)) as EscopoAtividade[];
      if (rascunho) {
        // Projeto ainda não criado: só devolve o cronograma (a versão 1 é gravada junto com o projeto).
        onRascunho?.({ atividades: atividadesSemUndefined, arquivoNome, observacao: observacao.trim() });
        setEtapa("concluido");
        return;
      }
      await gravarNovaVersaoCronograma({
        projetoId: projeto.id,
        escopoAnterior: projeto.escopoAtividades ?? [],
        versoes,
        atividades: atividadesSemUndefined,
        arquivoNome,
        observacao,
        usuario,
        comparacao,
      });
      onImportado(atividadesSemUndefined);
      setEtapa("concluido");
    } catch (err) {
      console.error("Falha ao salvar cronograma:", err);
      setErro("Não foi possível salvar o cronograma. Tente novamente.");
      setEtapa("erro");
    }
  }

  const associacaoCompleta = nomesRecurso.every((n) => associacao.get(n));

  return (
    <div className="space-y-4">
      {etapa === "form" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-brand-hover p-4 text-[13px] text-brand-muted">
            Aceita o cronograma-padrão (planilha com <strong>Nome da Tarefa</strong>, hierarquia por
            indentação e coluna <strong>Recurso</strong>) ou um arquivo simples com{" "}
            <strong>Atividade</strong> (ou <strong>Tarefa Pai</strong>/<strong>Tarefa Filha</strong>),{" "}
            <strong>Duração</strong>, <strong>Data de Início</strong>, <strong>Período</strong>{" "}
            (manhã/tarde) e <strong>Recurso</strong>.
          </div>
          {projeto.escopoAtividades && projeto.escopoAtividades.length > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-[#fff2de] p-3 text-[12.5px] text-[#a4650d]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Este projeto já tem um escopo com {projeto.escopoAtividades.length} atividade
              {projeto.escopoAtividades.length === 1 ? "" : "s"}. Importar um cronograma cria uma nova versão no histórico e substitui a lista atual; as horas já apontadas continuam ligadas às tarefas que o sistema reconhecer pelo nome (mesmo com a ordem alterada).
            </p>
          )}
          <label className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-brand-border bg-white p-8 text-center hover:border-brand-accent hover:bg-brand-accent-soft/30">
            <Upload size={22} className="text-brand-faint" />
            <span className="text-sm font-semibold text-brand-navy-2">
              Clique para escolher o arquivo (.csv ou .xlsx)
            </span>
            <input type="file" accept=".csv,.xlsx,.xlsm" onChange={aoEscolherArquivo} className="hidden" />
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {etapa === "processando" && <p className="py-10 text-center text-sm text-brand-muted">Lendo o arquivo...</p>}

      {etapa === "erro" && (
        <div className="space-y-4">
          <p className="rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">{erro}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" onClick={() => setEtapa("form")}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {etapa === "corrigindo" && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Importação bloqueada: {faltando.length} tarefa{faltando.length === 1 ? "" : "s"} sem
            duração. Revise o arquivo ou preencha os campos faltantes abaixo.
          </p>
          <div className="max-h-[320px] overflow-y-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-brand-border-soft bg-brand-hover text-left text-[10.5px] font-bold tracking-[.08em] text-brand-faint uppercase">
                  <th className="px-3 py-2">Tarefa</th>
                  <th className="px-3 py-2">Duração (min ou horas)</th>
                </tr>
              </thead>
              <tbody>
                {faltando.map((a) => (
                  <tr key={a.id} className="border-t border-brand-border-soft">
                    <td className="px-3 py-2 text-brand-navy-2">{a.descricao}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className="w-28"
                        value={correcoes.get(a.id) ?? ""}
                        onChange={(e) => setCorrecoes((prev) => new Map(prev).set(a.id, e.target.value))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={aplicarCorrecoes} disabled={correcoes.size === 0}>
              Aplicar e continuar
            </Button>
          </div>
        </div>
      )}

      {etapa === "recursos" && (
        <div className="space-y-4">
          <p className="text-sm text-brand-muted">
            Associe cada recurso citado no arquivo a um recurso cadastrado no sistema (coordenador,
            consultor funcional ou técnico).
          </p>
          <div className="space-y-2.5">
            {nomesRecurso.map((nome) => (
              <div key={nome} className="flex items-center gap-3">
                <span className="w-48 shrink-0 truncate text-[13px] font-semibold text-brand-navy-2">
                  {nome}
                </span>
                <Select
                  value={associacao.get(nome) ?? ""}
                  onChange={(e) =>
                    setAssociacao((prev) => new Map(prev).set(nome, e.target.value))
                  }
                  className="flex-1"
                >
                  <option value="">Selecione o recurso...</option>
                  {recursos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nomeCompleto} — {TIPO_RECURSO_CONFIG[r.tipo].label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            {nomesRecurso.length === 0 && (
              <p className="text-sm text-brand-faint">Nenhum recurso citado no arquivo.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => setEtapa(temEscopoAtual ? "conferencia" : "revisao")} disabled={!associacaoCompleta}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {etapa === "conferencia" && (
        <ConferenciaVersao
          versaoAtual={ultimaVersao}
          resumo={comparacao.resumo}
          mudancas={comparacao.mudancas}
          removidasComHoras={removidasComHoras}
          agendaPreservada={preservado.agendaPreservada}
          horasPorAtividade={horasPorAtividade}
          opcoesNovas={opcoesNovas}
          atividadesNovas={atividadesFinal}
          atividadesAtuais={projeto.escopoAtividades ?? []}
          vinculos={vinculos}
          onVincular={(idAntiga, idNova) =>
            setVinculos((prev) => {
              const novo = new Map(prev);
              if (idNova) novo.set(idAntiga, idNova);
              else novo.delete(idAntiga);
              return novo;
            })
          }
          onVoltar={() => setEtapa("recursos")}
          onContinuar={() => setEtapa("revisao")}
        />
      )}

      {etapa === "revisao" && (
        <div className="space-y-4">
          <p className="text-sm text-brand-muted">
            {atividadesSalvar.length} atividade{atividadesSalvar.length === 1 ? "" : "s"} prontas para
            entrar no projeto.
          </p>
          {sobrepostas.size > 0 && (
            <p className="flex items-start gap-2 rounded-md bg-[#fdeceb] p-3 text-[12.5px] text-[#b5392a]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {sobrepostas.size} tarefa{sobrepostas.size === 1 ? "" : "s"} com sobreposição de
              agenda — o mesmo recurso já tem outra alocação no mesmo dia e horário. Marcadas em
              vermelho abaixo; você pode importar mesmo assim e ajustar depois.
            </p>
          )}
          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12px]">
              <tbody>
                {atividadesSalvar.map((a, i) => (
                  <tr
                    key={a.id}
                    className={`border-t border-brand-border-soft first:border-t-0 ${
                      sobrepostas.has(a.id) ? "bg-[#fdeceb]" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 text-brand-faint">{numeracao[i]}</td>
                    <td className="px-2 py-1.5 text-brand-navy-2" style={{ paddingLeft: 8 + (a.nivel ?? 0) * 16 }}>
                      {a.descricao}
                      {a.realizadaEmVersaoAnterior && (
                        <span className="ml-1.5 rounded-full bg-[#e3f5ea] px-1.5 py-0.5 text-[9.5px] font-bold text-[#15754c]">
                          Realizada (versão anterior)
                        </span>
                      )}
                      {sobrepostas.has(a.id) && (
                        <span className="ml-1.5 rounded-full bg-[#b5392a] px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                          Sobreposição
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-brand-muted">
                      {a.dataInicio ? `${dataBR(a.dataInicio)}${a.periodo ? ` · ${PERIODO_LABEL[a.periodo]}` : ""}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-brand-muted">
                      {a.duracao ? `${a.duracao}${a.unidadeDuracao === "minutos" ? " min" : "h"}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12.5px] font-bold text-brand-navy-2">
              Observação desta versão <span className="text-[#b5392a]">*</span>
            </label>
            <Textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: Cliente pediu para antecipar os itens de segurança; treinamento movido para a semana 3."
            />
            <p className="text-[11.5px] text-brand-faint">
              {rascunho
                ? "Fica registrada como versão 1 no histórico do cronograma do projeto."
                : "Fica registrada no histórico do cronograma junto com quem importou e o que mudou."}
            </p>
          </div>
          {versoesCol.erro && (
            <p className="rounded-md bg-[#fdeceb] p-3 text-[12.5px] text-[#b5392a]">
              Não foi possível ler o histórico de versões (as regras do Firestore precisam estar publicadas
              com a subcoleção versoesCronograma). A importação está bloqueada até isso ser resolvido.
            </p>
          )}
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmar}
              disabled={observacao.trim().length < 3 || versoesCol.erro || versoesCol.loading || !usuario}
            >
              {rascunho ? "Usar este cronograma" : `Importar como versão ${(ultimaVersao ?? (temEscopoAtual ? 1 : 0)) + 1}`}
            </Button>
          </div>
        </div>
      )}

      {etapa === "importando" && <p className="py-10 text-center text-sm text-brand-muted">Importando...</p>}

      {etapa === "concluido" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#92D050]/40 bg-[#e3f5ea] p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-[#15754c]" />
            <p className="font-bold text-[#15754c]">
              Cronograma importado com {atividadesSalvar.length} atividade
              {atividadesSalvar.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImportarCronogramaModal({
  open,
  projeto,
  recursos,
  outrosProjetos,
  onClose,
  onImportado,
  rascunho = false,
  onRascunho,
}: {
  open: boolean;
  projeto: Projeto | null;
  recursos: Recurso[];
  outrosProjetos: Projeto[];
  onClose: () => void;
  onImportado: (atividades: EscopoAtividade[]) => void;
  rascunho?: boolean;
  onRascunho?: (dados: { atividades: EscopoAtividade[]; arquivoNome: string; observacao: string }) => void;
}) {
  return (
    <Modal open={open && !!projeto} onClose={onClose} title="Importar cronograma" wide>
      {open && projeto && (
        <CronogramaImportForm
          key={projeto.id}
          projeto={projeto}
          recursos={recursos}
          outrosProjetos={outrosProjetos}
          onClose={onClose}
          onImportado={onImportado}
          rascunho={rascunho}
          onRascunho={onRascunho}
        />
      )}
    </Modal>
  );
}
