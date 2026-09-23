"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { formatarHoras } from "@/lib/horas";
import { caminhosLegiveis } from "@/lib/versaoCronograma";
import type { EscopoAtividade, MudancaCronograma, ResumoVersaoCronograma, TipoMudancaCronograma } from "@/types";
import type { ProgressoFolha } from "@/lib/progressoEscopo";

export const MUDANCA_CONFIG: Record<TipoMudancaCronograma, { label: string; cor: string; fundo: string }> = {
  nova: { label: "Nova", cor: "#15754c", fundo: "#e3f5ea" },
  mantida: { label: "Mantida (já realizada)", cor: "#15754c", fundo: "#e3f5ea" },
  removida: { label: "Removida", cor: "#b5392a", fundo: "#fdeceb" },
  duracao: { label: "Duração", cor: "#a4650d", fundo: "#fff2de" },
  movida: { label: "Mudou de grupo", cor: "#2f6fe4", fundo: "#e8f0fd" },
  renomeada: { label: "Renomeada", cor: "#6b4bb8", fundo: "#efe9fb" },
  reordenada: { label: "Reordenada", cor: "#5b6b7f", fundo: "#eef1f5" },
  agenda: { label: "Agenda", cor: "#0f7d9e", fundo: "#e0f3f9" },
};

export function ListaMudancas({ mudancas }: { mudancas: MudancaCronograma[] }) {
  if (mudancas.length === 0) return <p className="p-3 text-[12.5px] text-brand-faint">Nenhuma mudança.</p>;
  return (
    <ul className="divide-y divide-brand-border-soft text-[12px]">
      {mudancas.map((m, i) => {
        const cfg = MUDANCA_CONFIG[m.tipo];
        return (
          <li key={i} className="flex items-start gap-2 px-3 py-1.5">
            <span
              className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold whitespace-nowrap"
              style={{ color: cfg.cor, background: cfg.fundo }}
            >
              {cfg.label}
            </span>
            <span className="min-w-0 flex-1 text-brand-navy-2">
              {m.caminho}
              {m.detalhe && <span className="ml-1.5 text-brand-faint">{m.detalhe}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ChipsResumo({ resumo }: { resumo: ResumoVersaoCronograma }) {
  const itens: { tipo: TipoMudancaCronograma; n: number }[] = [
    { tipo: "nova", n: resumo.novas },
    { tipo: "mantida", n: resumo.mantidasPorRealizado ?? 0 },
    { tipo: "removida", n: resumo.removidas },
    { tipo: "duracao", n: resumo.duracaoAlterada },
    { tipo: "movida", n: resumo.movidas },
    { tipo: "renomeada", n: resumo.renomeadas },
    { tipo: "reordenada", n: resumo.reordenadas },
    { tipo: "agenda", n: resumo.agendaAlterada },
  ];
  const visiveis = itens.filter((i) => i.n > 0);
  if (visiveis.length === 0) return <span className="text-[12px] text-brand-faint">Sem mudanças</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {visiveis.map(({ tipo, n }) => {
        const cfg = MUDANCA_CONFIG[tipo];
        return (
          <span
            key={tipo}
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ color: cfg.cor, background: cfg.fundo }}
          >
            {n} {tipo === "mantida" ? "mantida" : cfg.label.toLowerCase()}
            {n > 1 && (tipo === "nova" || tipo === "removida" || tipo === "mantida") ? "s" : ""}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Passo de conferência antes de gravar uma nova versão do cronograma: mostra o que mudou em relação
 * à versão atual e deixa o usuário ligar manualmente uma atividade que saiu (e já tem horas
 * apontadas) a uma atividade nova — ex: quando foi renomeada.
 */
export function ConferenciaVersao({
  versaoAtual,
  resumo,
  mudancas,
  removidasComHoras,
  agendaPreservada,
  horasPorAtividade,
  opcoesNovas,
  atividadesNovas,
  atividadesAtuais,
  vinculos,
  onVincular,
  onVoltar,
  onContinuar,
}: {
  versaoAtual: number | null;
  resumo: ResumoVersaoCronograma;
  mudancas: MudancaCronograma[];
  removidasComHoras: EscopoAtividade[];
  agendaPreservada: { caminho: string; detalhe: string }[];
  horasPorAtividade: Map<string, ProgressoFolha>;
  opcoesNovas: EscopoAtividade[];
  atividadesNovas: EscopoAtividade[];
  atividadesAtuais: EscopoAtividade[];
  vinculos: Map<string, string>;
  onVincular: (idAntiga: string, idNova: string) => void;
  onVoltar: () => void;
  onContinuar: () => void;
}) {
  const caminhoNovo = useMemo(() => {
    const c = caminhosLegiveis(atividadesNovas);
    return new Map(atividadesNovas.map((a, i) => [a.id, c[i]]));
  }, [atividadesNovas]);
  const caminhoAtual = useMemo(() => {
    const c = caminhosLegiveis(atividadesAtuais);
    return new Map(atividadesAtuais.map((a, i) => [a.id, c[i]]));
  }, [atividadesAtuais]);
  const escolhidas = new Set(vinculos.values());

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-muted">
        Comparação com a versão atual do cronograma{versaoAtual ? ` (v${versaoAtual})` : ""}. A ordem pode mudar à
        vontade: as horas já apontadas continuam ligadas às tarefas que o sistema reconhece pelo nome.
      </p>
      <div className="rounded-xl border border-brand-border bg-white p-3">
        <div className="mb-1 text-[11px] font-bold tracking-[.06em] text-brand-faint uppercase">
          {resumo.mantidas} tarefa{resumo.mantidas === 1 ? "" : "s"} sem mudança
        </div>
        <ChipsResumo resumo={resumo} />
      </div>

      {removidasComHoras.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[#f0c48a] bg-[#fff8ec] p-3">
          <p className="flex items-start gap-2 text-[12.5px] text-[#a4650d]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {removidasComHoras.length} tarefa{removidasComHoras.length === 1 ? "" : "s"} com horas já apontadas não{" "}
            {removidasComHoras.length === 1 ? "está" : "estão"} no arquivo. Elas serão <strong>mantidas no cronograma
            como realizadas</strong>, com a data e o recurso de antes. Se foi só renomeada, ligue-a à tarefa nova
            abaixo para não duplicar.
          </p>
          {removidasComHoras.map((a) => {
            const escolhida = vinculos.get(a.id) ?? "";
            return (
              <div key={a.id} className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <p className="truncate font-semibold text-brand-navy-2">{caminhoAtual.get(a.id) ?? a.descricao}</p>
                  <p className="text-[11.5px] text-brand-faint">
                    {formatarHoras(horasPorAtividade.get(a.id)?.horas ?? 0)} apontadas
                  </p>
                </div>
                <Select
                  value={escolhida}
                  onChange={(e) => onVincular(a.id, e.target.value)}
                  className="sm:w-72"
                >
                  <option value="">Manter como realizada (versão anterior)</option>
                  {opcoesNovas
                    .filter((n) => n.id === escolhida || !escolhidas.has(n.id))
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {caminhoNovo.get(n.id) ?? n.descricao}
                      </option>
                    ))}
                </Select>
              </div>
            );
          })}
        </div>
      )}

      {agendaPreservada.length > 0 && (
        <details className="rounded-xl border border-[#b9e2cb] bg-[#f1faf5] p-3 text-[12.5px] text-[#15754c]">
          <summary className="cursor-pointer font-semibold">
            {agendaPreservada.length} tarefa{agendaPreservada.length === 1 ? "" : "s"} já concluída
            {agendaPreservada.length === 1 ? "" : "s"} manteve{agendaPreservada.length === 1 ? "" : "ram"} a data,
            o período e o recurso em que foi realizada (o arquivo novo trazia outros)
          </summary>
          <ul className="mt-2 space-y-1 text-brand-navy-2">
            {agendaPreservada.map((x, i) => (
              <li key={i}>
                {x.caminho} <span className="text-brand-faint">{x.detalhe}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="max-h-[300px] overflow-y-auto rounded-xl border border-brand-border">
        <ListaMudancas mudancas={mudancas} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="button" onClick={onContinuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
