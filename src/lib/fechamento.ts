import { formatarHoras } from "@/lib/horas";
import { statusEfetivo } from "@/lib/statusHora";
import { tipoBoxEfetivo, type LinhaFechamento } from "@/lib/relatorioFechamento";
import { nomeExibicaoParceira } from "@/lib/parceira";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { EmpresaParceira, EventoCalendario, ItemFechamento, Projeto, Cliente, Recurso, StatusFechamento, TotaisFechamento } from "@/types";

export const STATUS_FECHAMENTO_CONFIG: Record<StatusFechamento, { label: string; bg: string; text: string }> = {
  rascunho: { label: "Rascunho", bg: "#eef1f5", text: "#5b6b7f" },
  em_revisao: { label: "Em revisão", bg: "#fff2de", text: "#a4650d" },
  fechado: { label: "Fechado", bg: "#e8efff", text: "#2f6fe4" },
  faturado: { label: "Faturamento liberado", bg: "#e3f5ea", text: "#15754c" },
};

export const ETAPAS_FECHAMENTO: StatusFechamento[] = ["rascunho", "em_revisao", "fechado", "faturado"];

export const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export function proximoMes(mesAno: string): string {
  const [ano, mes] = mesAno.split("-").map(Number);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

/** O período só pode ser enviado para revisão depois que o mês terminou (todas as horas já podem ter sido apontadas). */
export function mesTerminou(mesAno: string, hojeIso: string): boolean {
  return hojeIso >= `${proximoMes(mesAno)}-01`;
}

export const idItemFechamento = (mesAno: string, recursoId: string) => `${mesAno}_${recursoId}`;

export type ItemBase = Omit<ItemFechamento, "liberado" | "confirmacao">;

/** Agrupa as linhas do fechamento (um lançamento por linha) em um item por recurso, com os dados do vínculo. */
export function montarItens(linhas: LinhaFechamento[], recursos: Recurso[], parceiras: EmpresaParceira[], mesAno: string): ItemBase[] {
  const porRecurso = new Map<string, LinhaFechamento[]>();
  for (const l of linhas) porRecurso.set(l.recursoId, [...(porRecurso.get(l.recursoId) ?? []), l]);
  const itens: ItemBase[] = [];
  porRecurso.forEach((ls, recursoId) => {
    const recurso = recursos.find((r) => r.id === recursoId);
    if (!recurso) return;
    const tipoBox = tipoBoxEfetivo(recurso);
    const parceira = recurso.parceiraId ? parceiras.find((p) => p.id === recurso.parceiraId) : undefined;
    itens.push({
      id: idItemFechamento(mesAno, recursoId),
      mesAno,
      recursoId,
      recursoNome: recurso.nomeCompleto,
      tipoBox,
      parceiraId: tipoBox === "terceiro" ? (recurso.parceiraId ?? null) : null,
      parceiraNome: tipoBox === "terceiro" && parceira ? nomeExibicaoParceira(parceira) : null,
      horas: ls.reduce((s, l) => s + l.totalHoras, 0),
      valorRepasse: ls.reduce((s, l) => s + l.valorRepasse, 0),
      lancamentos: [...ls]
        .sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""))
        .map((l) => ({
          data: l.data,
          cliente: l.cliente,
          projeto: l.projeto,
          horaInicio: l.horaInicio ?? "",
          horaFim: l.horaFim ?? "",
          horaDesconto: l.horaDesconto ?? "",
          totalHoras: l.totalHoras,
          valorRepasse: l.valorRepasse,
        })),
    });
  });
  return itens.sort((a, b) => a.recursoNome.localeCompare(b.recursoNome, "pt-BR"));
}

export function totaisPorTipo(itens: Pick<ItemFechamento, "tipoBox" | "horas" | "valorRepasse">[]): {
  proprio: TotaisFechamento;
  terceiro: TotaisFechamento;
} {
  const zero = (): TotaisFechamento => ({ horas: 0, valor: 0, recursos: 0 });
  const t = { proprio: zero(), terceiro: zero() };
  for (const i of itens) {
    const alvo = t[i.tipoBox];
    alvo.horas += i.horas;
    alvo.valor += i.valorRepasse;
    alvo.recursos += 1;
  }
  return t;
}

export interface Divergencia {
  chave: string;
  /** Bloqueante: impede fechar sem uma justificativa. Alerta: só chama atenção. */
  severidade: "bloqueante" | "alerta";
  titulo: string;
  detalhes: string[];
}

const NOME_STATUS_PENDENTE: Record<string, string> = {
  previsto: "a confirmar pelo consultor",
  aguardando_aprovacao: "aguardando aprovação",
  rejeitado: "rejeitado",
};

/** Relatório de divergências do período — o que conferir antes de fechar e liberar o faturamento. */
export function calcularDivergencias({
  eventos,
  recursos,
  projetos,
  clientes,
  linhas,
  mesAno,
  hojeIso,
}: {
  eventos: EventoCalendario[];
  recursos: Recurso[];
  projetos: Projeto[];
  clientes: Cliente[];
  linhas: LinhaFechamento[];
  mesAno: string;
  hojeIso: string;
}): Divergencia[] {
  const lista: Divergencia[] = [];
  const nomeRecurso = (id: string) => recursos.find((r) => r.id === id)?.nomeCompleto ?? "Recurso removido";
  const nomeCliente = (projetoId: string) => {
    const p = projetos.find((x) => x.id === projetoId);
    return nomeExibicaoCliente(clientes.find((c) => c.id === p?.clienteId));
  };
  const doMes = eventos.filter((e) => e.data.startsWith(mesAno));

  if (!mesTerminou(mesAno, hojeIso)) {
    lista.push({
      chave: "mes_aberto",
      severidade: "bloqueante",
      titulo: "O período ainda não terminou",
      detalhes: [`O fechamento só pode seguir depois de ${dataBR(`${mesAno}-01`).slice(3)} terminar (novas horas ainda podem ser apontadas).`],
    });
  }

  const pendentes = doMes.filter((e) => ["previsto", "aguardando_aprovacao", "rejeitado"].includes(statusEfetivo(e)));
  if (pendentes.length > 0) {
    lista.push({
      chave: "horas_pendentes",
      severidade: "bloqueante",
      titulo: `${pendentes.length} lançamento${pendentes.length === 1 ? "" : "s"} ainda sem aprovação no período`,
      detalhes: pendentes
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((e) => `${dataBR(e.data)} · ${nomeRecurso(e.recursoId)} · ${nomeCliente(e.projetoId)} · ${formatarHoras(e.totalHoras)} — ${NOME_STATUS_PENDENTE[statusEfetivo(e)]}`),
    });
  }

  const comHoras = new Set(linhas.map((l) => l.recursoId));
  const semHoras = recursos.filter((r) => !comHoras.has(r.id)).map((r) => r.nomeCompleto);
  if (semHoras.length > 0) {
    lista.push({
      chave: "sem_horas",
      severidade: "alerta",
      titulo: `${semHoras.length} consultor${semHoras.length === 1 ? "" : "es"} sem nenhuma hora aprovada no mês`,
      detalhes: semHoras.sort((a, b) => a.localeCompare(b, "pt-BR")),
    });
  }

  const descontos = doMes.filter(
    (e) => statusEfetivo(e) === "aprovado" && !!e.horaDesconto && e.horaDesconto !== "00:00" && !(e.descricao ?? "").trim()
  );
  if (descontos.length > 0) {
    lista.push({
      chave: "descontos",
      severidade: "alerta",
      titulo: `${descontos.length} desconto${descontos.length === 1 ? "" : "s"} sem justificativa`,
      detalhes: descontos.map((e) => `${dataBR(e.data)} · ${nomeRecurso(e.recursoId)} · desconto de ${e.horaDesconto}`),
    });
  }

  const sobrepostos = Array.from(new Set(linhas.filter((l) => l.sobreposto).map((l) => `${l.data}|${l.recursoNome}`)));
  if (sobrepostos.length > 0) {
    lista.push({
      chave: "sobrepostos",
      severidade: "alerta",
      titulo: `${sobrepostos.length} dia${sobrepostos.length === 1 ? "" : "s"} com horários sobrepostos`,
      detalhes: sobrepostos.sort().map((k) => {
        const [data, nome] = k.split("|");
        return `${dataBR(data)} · ${nome}`;
      }),
    });
  }

  const semValor = Array.from(new Set(linhas.filter((l) => l.totalHoras > 0 && l.valorRepasse === 0).map((l) => l.recursoNome)));
  if (semValor.length > 0) {
    lista.push({
      chave: "sem_valor",
      severidade: "alerta",
      titulo: `${semValor.length} consultor${semValor.length === 1 ? "" : "es"} com horas e valor de repasse zerado`,
      detalhes: semValor.sort((a, b) => a.localeCompare(b, "pt-BR")),
    });
  }

  return lista;
}

/** Reconstrói as linhas do relatório (PDF/Excel) a partir dos itens congelados do fechamento. */
export function linhasDosItens(itens: ItemFechamento[]): LinhaFechamento[] {
  return itens.flatMap((i) =>
    i.lancamentos.map((l) => ({
      data: l.data,
      recursoId: i.recursoId,
      recursoNome: i.recursoNome,
      vinculo: i.tipoBox === "terceiro" ? `Terceiro – ${i.parceiraNome ?? "sem parceira"}` : "Próprio",
      cliente: l.cliente,
      projeto: l.projeto,
      horaInicio: l.horaInicio,
      horaFim: l.horaFim,
      horaDesconto: l.horaDesconto,
      totalHoras: l.totalHoras,
      valorRepasse: l.valorRepasse,
      sobreposto: false,
    }))
  );
}
