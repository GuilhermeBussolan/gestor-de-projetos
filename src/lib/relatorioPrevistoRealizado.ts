import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { classificarCenario, type CenarioComparativo } from "@/lib/comparativoHoras";
import { resumoGruposRotina } from "@/lib/dashboardCalc";
import { calcularProgressoFolhas } from "@/lib/progressoEscopo";
import { duracaoEmMinutos, idsFolhas, fimDoBloco } from "@/lib/escopo";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, EscopoAtividade, EventoCalendario, Projeto, Recurso } from "@/types";

export interface LinhaRelatorioGrupo {
  projetoId: string;
  projetoNome: string;
  clienteNome: string;
  grupoId: string;
  grupoIndice: number;
  grupoDescricao: string;
  horasPrevistas: number;
  horasRealizadas: number;
  diferenca: number;
  percentualRealizado: number;
  status: CenarioComparativo;
  concluido: boolean;
}

export interface FiltrosRelatorioHoras {
  mes: string; // YYYY-MM, "" = todos
  recursoId: string;
  status: "" | CenarioComparativo;
  projetoId: string;
  grupoId: string;
}

/** Um grupo de rotina por linha, de todos os projetos com cronograma (duração) importado. */
export function montarRelatorioGrupos(
  projetos: Projeto[],
  clientes: Cliente[],
  eventos: EventoCalendario[]
): LinhaRelatorioGrupo[] {
  const linhas: LinhaRelatorioGrupo[] = [];
  for (const projeto of projetos) {
    const grupos = resumoGruposRotina(projeto.id, projeto.escopoAtividades ?? [], eventos).filter(
      (g) => g.horasPrevistas > 0
    );
    for (const g of grupos) {
      linhas.push({
        projetoId: projeto.id,
        projetoNome: projeto.codigoProposta,
        clienteNome: nomeExibicaoCliente(clientes.find((c) => c.id === projeto.clienteId)),
        grupoId: g.grupoId,
        grupoIndice: g.indice,
        grupoDescricao: g.descricao,
        horasPrevistas: g.horasPrevistas,
        horasRealizadas: g.horasRealizadas,
        diferenca: g.diferenca,
        percentualRealizado: g.percentualRealizado,
        status: g.concluido ? "dentro" : classificarCenario(g.horasPrevistas, g.horasRealizadas),
        concluido: g.concluido,
      });
    }
  }
  return linhas;
}

/** O "recurso" de um grupo, para o filtro — o do primeiro atividade-folha dele que tiver um definido. */
function recursoDoGrupo(atividades: EscopoAtividade[], indiceGrupo: number): string | null {
  const fim = fimDoBloco(atividades, indiceGrupo);
  const folha = atividades.slice(indiceGrupo, fim).find((a) => a.recursoId);
  return folha?.recursoId ?? null;
}

export function filtrarLinhasGrupo(
  linhas: LinhaRelatorioGrupo[],
  projetos: Projeto[],
  filtros: FiltrosRelatorioHoras
): LinhaRelatorioGrupo[] {
  return linhas.filter((l) => {
    if (filtros.status && l.status !== filtros.status) return false;
    if (filtros.projetoId && l.projetoId !== filtros.projetoId) return false;
    if (filtros.grupoId && l.grupoId !== filtros.grupoId) return false;
    if (filtros.recursoId) {
      const projeto = projetos.find((p) => p.id === l.projetoId);
      const recursoGrupo = recursoDoGrupo(projeto?.escopoAtividades ?? [], l.grupoIndice);
      if (recursoGrupo !== filtros.recursoId) return false;
    }
    return true;
  });
}

export interface LinhaDetalheTarefa {
  atividadeId: string;
  descricao: string;
  recursoNome: string;
  data: string | null;
  horasPrevistas: number;
  horasRealizadas: number;
  diferenca: number;
}

/** Detalhamento por tarefa-folha de um grupo — o que abre ao expandir uma linha do relatório. */
export function detalheTarefasDoGrupo(
  projeto: Pick<Projeto, "id" | "escopoAtividades">,
  indiceGrupo: number,
  recursos: Recurso[],
  eventos: EventoCalendario[]
): LinhaDetalheTarefa[] {
  const atividades = projeto.escopoAtividades ?? [];
  const folhas = idsFolhas(atividades);
  const fim = fimDoBloco(atividades, indiceGrupo);
  const progresso = calcularProgressoFolhas(projeto.id, atividades, eventos);
  return atividades
    .slice(indiceGrupo, fim)
    .filter((a) => folhas.has(a.id))
    .map((a) => {
      const horasPrevistas = duracaoEmMinutos(a) / 60;
      const horasRealizadas = progresso.get(a.id)?.horas ?? 0;
      return {
        atividadeId: a.id,
        descricao: a.descricao,
        recursoNome: recursos.find((r) => r.id === a.recursoId)?.nomeCompleto ?? "—",
        data: a.dataInicio ?? null,
        horasPrevistas,
        horasRealizadas,
        diferenca: horasRealizadas - horasPrevistas,
      };
    });
}

const moeda = (v: number) => v.toFixed(1);
const dataBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const STATUS_LABEL: Record<CenarioComparativo, string> = { abaixo: "Abaixo", dentro: "Dentro", acima: "Acima" };

const CABECALHO = ["Cliente", "Projeto", "Grupo de rotina", "Previsto (h)", "Realizado (h)", "Diferença (h)", "% Realizado", "Status"];

function linhasParaCelulas(linhas: LinhaRelatorioGrupo[]): string[][] {
  return linhas.map((l) => [
    l.clienteNome,
    l.projetoNome,
    l.grupoDescricao,
    moeda(l.horasPrevistas),
    moeda(l.horasRealizadas),
    moeda(l.diferenca),
    `${l.percentualRealizado.toFixed(0)}%`,
    STATUS_LABEL[l.status],
  ]);
}

export function exportarRelatorioCsv(linhas: LinhaRelatorioGrupo[]) {
  const corpo = linhasParaCelulas(linhas).map((c) => c.map((v) => `"${v.replace(/"/g, '""')}"`).join(";"));
  const csv = [CABECALHO.join(";"), ...corpo].join("\r\n");
  saveAs(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "previsto-x-realizado.csv");
}

export function exportarRelatorioPdf(linhas: LinhaRelatorioGrupo[]) {
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(14);
  pdf.text("Horas Previstas x Realizadas", 14, 16);
  autoTable(pdf, {
    startY: 22,
    head: [CABECALHO],
    body: linhasParaCelulas(linhas),
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  pdf.save("previsto-x-realizado.pdf");
}

export { dataBR };
