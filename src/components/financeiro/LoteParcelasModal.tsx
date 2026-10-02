"use client";

import { useMemo, useState } from "react";
import { CheckCheck, FileText, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import { ThOrdenavel, useOrdenacao } from "@/components/ui/Ordenacao";
import { STATUS_PARCELA_CONFIG } from "@/lib/constants";
import { alterarStatusEmLote, type MudancaEmLote } from "@/lib/parcela";
import type { LinhaLiberacao } from "@/lib/relatorioLiberacao";
import type { Projeto, Usuario } from "@/types";

export type ModoLote = "recebimento" | "nf";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("pt-BR") : "—");
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Ações em lote do faturamento, para a conferência de fim de mês:
 *  - recebimento: marca as parcelas escolhidas (só as faturadas) como Recebido, todas com a mesma data;
 *  - nf: informa a nota fiscal de cada parcela liberada; as que receberem NF viram Faturado.
 */
export function LoteParcelasModal({
  modo,
  linhas,
  projetos,
  usuario,
  onClose,
}: {
  modo: ModoLote;
  /** Todas as parcelas da rotina de faturamento (a tela filtra as que cabem no modo). */
  linhas: LinhaLiberacao[];
  projetos: Projeto[];
  usuario: Usuario | null;
  onClose: () => void;
}) {
  const recebimento = modo === "recebimento";
  const [busca, setBusca] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [data, setData] = useState(hojeIso());
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [resultado, setResultado] = useState("");

  const chave = (l: LinhaLiberacao) => `${l.projetoId}#${l.numero}`;
  const proposta = useMemo(() => new Map(projetos.map((p) => [p.id, p.codigoProposta])), [projetos]);

  const elegiveis = useMemo(
    () => linhas.filter((l) => l.status === (recebimento ? "FATURADO" : "LIBERADO")),
    [linhas, recebimento]
  );
  const termo = semAcento(busca.trim());
  const visiveis = termo
    ? elegiveis.filter((l) => semAcento(`${l.cliente} ${proposta.get(l.projetoId) ?? ""} ${l.parcela}`).includes(termo))
    : elegiveis;
  const { ordenados, ordem, ordenar } = useOrdenacao(visiveis, {
    cliente: (l) => l.cliente,
    proposta: (l) => proposta.get(l.projetoId) ?? "",
    parcela: (l) => l.parcela,
    valor: (l) => l.valor,
    liberadoEm: (l) => l.dataLiberacao,
    status: (l) => STATUS_PARCELA_CONFIG[l.status].label,
  });

  const selecionadas = recebimento
    ? elegiveis.filter((l) => marcadas.has(chave(l)))
    : elegiveis.filter((l) => (notas[chave(l)] ?? "").trim());
  const totalSelecionado = selecionadas.reduce((s, l) => s + l.valor, 0);
  const todasVisiveisMarcadas = visiveis.length > 0 && visiveis.every((l) => marcadas.has(chave(l)));

  function alternar(l: LinhaLiberacao) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(chave(l))) n.delete(chave(l));
      else n.add(chave(l));
      return n;
    });
  }
  function alternarTodas() {
    setMarcadas((m) => {
      const n = new Set(m);
      visiveis.forEach((l) => (todasVisiveisMarcadas ? n.delete(chave(l)) : n.add(chave(l))));
      return n;
    });
  }

  async function confirmar() {
    setErros([]);
    setResultado("");
    if (selecionadas.length === 0) return;
    if (recebimento && !/^20\d\d-\d\d-\d\d$/.test(data)) {
      setErros(["Informe a data de recebimento."]);
      return;
    }
    const mudancas: MudancaEmLote[] = [];
    for (const l of selecionadas) {
      const projeto = projetos.find((p) => p.id === l.projetoId);
      if (!projeto) continue;
      mudancas.push(
        recebimento
          ? { projeto, numero: l.numero, status: "RECEBIDO", dados: { dataRecebimento: data } }
          : { projeto, numero: l.numero, status: "FATURADO", dados: { notaFiscal: notas[chave(l)].trim() } }
      );
    }
    setSalvando(true);
    try {
      const r = await alterarStatusEmLote(mudancas, usuario ?? undefined);
      setErros(r.erros);
      setResultado(`${r.ok} parcela${r.ok === 1 ? "" : "s"} ${recebimento ? "marcada" : "faturada"}${r.ok === 1 ? "" : "s"}${recebimento ? " como recebida" + (r.ok === 1 ? "" : "s") : ""}.`);
      setMarcadas(new Set());
      setNotas({});
    } finally {
      setSalvando(false);
    }
  }

  const th = "px-3 py-2.5";
  return (
    <Modal open onClose={onClose} title={recebimento ? "Recebimento em lote" : "Faturamento em lote"} extraWide>
      <div className="space-y-4">
        <p className="text-[13px] text-brand-muted">
          {recebimento
            ? "Aparecem só as parcelas faturadas. Selecione as que já foram recebidas e informe a data — todas são marcadas como Recebido de uma vez."
            : "Informe a nota fiscal de cada parcela liberada. As que tiverem NF preenchida são marcadas como Faturado; as em branco ficam como estão."}
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-72 max-w-full">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-faint" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, proposta ou parcela…" className="pl-9" />
          </div>
          {recebimento && (
            <FormRow label="Data do recebimento (para todas)">
              <Input type="date" value={data} max={hojeIso()} onChange={(e) => setData(e.target.value)} className="w-44" />
            </FormRow>
          )}
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-xl border border-brand-border">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-brand-hover text-left text-[11px] font-bold tracking-[.09em] whitespace-nowrap text-brand-faint uppercase">
                {recebimento && (
                  <th className={`${th} w-10`}>
                    <input type="checkbox" checked={todasVisiveisMarcadas} onChange={alternarTodas} aria-label="Selecionar todas" />
                  </th>
                )}
                <ThOrdenavel chave="cliente" ordem={ordem} onOrdenar={ordenar} className={th}>Cliente</ThOrdenavel>
                <ThOrdenavel chave="proposta" ordem={ordem} onOrdenar={ordenar} className={th}>Proposta</ThOrdenavel>
                <ThOrdenavel chave="parcela" ordem={ordem} onOrdenar={ordenar} className={th}>Parcela</ThOrdenavel>
                <ThOrdenavel chave="valor" ordem={ordem} onOrdenar={ordenar} className={th}>Valor</ThOrdenavel>
                <ThOrdenavel chave="liberadoEm" ordem={ordem} onOrdenar={ordenar} className={th}>Liberado em</ThOrdenavel>
                {recebimento ? (
                  <ThOrdenavel chave="status" ordem={ordem} onOrdenar={ordenar} className={th}>Status</ThOrdenavel>
                ) : (
                  <th className={th}>Nota fiscal</th>
                )}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((l) => {
                const k = chave(l);
                const cfg = STATUS_PARCELA_CONFIG[l.status];
                const ativa = recebimento ? marcadas.has(k) : !!(notas[k] ?? "").trim();
                return (
                  <tr
                    key={k}
                    onClick={recebimento ? () => alternar(l) : undefined}
                    className={`border-t border-brand-border-soft ${recebimento ? "cursor-pointer" : ""} ${ativa ? "bg-brand-accent-soft/40" : "hover:bg-brand-hover"}`}
                  >
                    {recebimento && (
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={marcadas.has(k)} onChange={() => alternar(l)} onClick={(e) => e.stopPropagation()} aria-label={`Selecionar ${l.cliente}`} />
                      </td>
                    )}
                    <td className="px-3 py-2 font-bold text-brand-navy-2">{l.cliente}</td>
                    <td className="px-3 py-2 text-brand-muted">{proposta.get(l.projetoId) ?? "—"}</td>
                    <td className="px-3 py-2 text-brand-muted">{l.parcela}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap text-brand-navy-2">{moeda(l.valor)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-brand-muted">{dataBR(l.dataLiberacao)}</td>
                    {recebimento ? (
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                          {cfg.label}
                        </span>
                      </td>
                    ) : (
                      <td className="px-3 py-1.5">
                        <Input
                          value={notas[k] ?? ""}
                          onChange={(e) => setNotas((n) => ({ ...n, [k]: e.target.value }))}
                          placeholder="nº da NF"
                          className="h-9 w-36"
                          aria-label={`Nota fiscal de ${l.cliente} — ${l.parcela}`}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-brand-faint">
                    {elegiveis.length === 0
                      ? recebimento
                        ? "Nenhuma parcela faturada aguardando recebimento."
                        : "Nenhuma parcela liberada aguardando nota fiscal."
                      : "Nenhuma parcela encontrada para essa busca."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {resultado && <p className="rounded-md bg-[#e3f5ea] px-3 py-2 text-[13px] font-semibold text-[#15754c]">{resultado}</p>}
        {erros.length > 0 && (
          <ul className="space-y-0.5 rounded-md bg-[#fdeceb] px-3 py-2 text-[12.5px] text-[#b5392a]">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-brand-muted">
            {selecionadas.length === 0 ? (
              recebimento ? "Nenhuma parcela selecionada" : "Nenhuma NF preenchida"
            ) : (
              <>
                <strong className="text-brand-navy-2">{selecionadas.length}</strong> parcela{selecionadas.length === 1 ? "" : "s"} ·{" "}
                <strong className="text-brand-navy-2">{moeda(totalSelecionado)}</strong>
              </>
            )}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            <Button type="button" disabled={salvando || selecionadas.length === 0} onClick={confirmar}>
              {recebimento ? <CheckCheck size={15} /> : <FileText size={15} />}
              {salvando
                ? "Salvando..."
                : recebimento
                  ? `Marcar ${selecionadas.length || ""} como Recebido`.replace("  ", " ")
                  : `Faturar ${selecionadas.length || ""} com NF`.replace("  ", " ")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
