"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ImportModal, type LinhaValidada } from "@/components/importacao/ImportModal";
import { pegarCampo, type LinhaImportada } from "@/lib/importarArquivo";
import { calcularTotalHoras } from "@/lib/horas";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { aceitaApontamentoEm } from "@/lib/recursoAtivo";
import type { Cliente, Projeto, Recurso } from "@/types";

interface HoraRetroativaImportada {
  recursoId: string;
  projetoId: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  horaDesconto: string;
  totalHoras: number;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function parseDataBR(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const data = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  return data;
}

function horaValida(texto: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto.trim());
}

function processar(
  linhas: LinhaImportada[],
  recursos: Recurso[],
  projetos: Projeto[],
  clientes: Cliente[]
): LinhaValidada<HoraRetroativaImportada>[] {
  return linhas.map((l) => {
    const nomeRecurso = pegarCampo(l.valores, "Recurso");
    const codigoProposta = pegarCampo(l.valores, "Projeto", "Código da Proposta", "Codigo da Proposta");
    const nomeClienteTexto = pegarCampo(l.valores, "Cliente");
    const dataTexto = pegarCampo(l.valores, "Data");
    const horaInicioTexto = pegarCampo(l.valores, "Hora Início", "Hora Inicio");
    const horaFimTexto = pegarCampo(l.valores, "Hora Fim");
    const descontoTexto = pegarCampo(l.valores, "Desconto") || "00:00";

    const erros: string[] = [];

    // O recurso define de quem é a hora (é por ele que o consultor enxerga no calendário e no histórico):
    // nome repetido no cadastro poderia gravar no recurso errado, então bloqueia.
    const mesmoNome = recursos.filter((r) => normalizar(r.nomeCompleto) === normalizar(nomeRecurso));
    const recurso = mesmoNome.length === 1 ? mesmoNome[0] : undefined;
    if (!nomeRecurso) erros.push("Recurso vazio");
    else if (mesmoNome.length === 0) erros.push("Recurso não encontrado no cadastro");
    else if (mesmoNome.length > 1) erros.push("Há mais de um recurso com esse nome no cadastro — ajuste o cadastro antes de importar");

    const projeto = projetos.find((p) => normalizar(p.codigoProposta) === normalizar(codigoProposta));
    if (!codigoProposta) {
      erros.push("Projeto (código da proposta) vazio");
    } else if (!projeto) {
      erros.push("Projeto não encontrado");
    } else if (nomeClienteTexto) {
      const cliente = clientes.find((c) => c.id === projeto.clienteId);
      const nomeAtual = normalizar(nomeExibicaoCliente(cliente));
      if (nomeAtual !== normalizar(nomeClienteTexto)) {
        erros.push("Cliente informado não bate com o cliente do projeto encontrado");
      }
    }

    let data = "";
    if (!dataTexto) {
      erros.push("Data vazia");
    } else {
      const parseada = parseDataBR(dataTexto);
      if (!parseada) erros.push("Data inválida (use DD/MM/AAAA)");
      else data = parseada;
    }

    if (recurso && data && !aceitaApontamentoEm(recurso, data)) {
      erros.push(
        recurso.dataInativacao
          ? `Recurso inativado em ${recurso.dataInativacao.split("-").reverse().join("/")}: só aceita horas até essa data`
          : "Recurso inativo: não aceita horas"
      );
    }

    if (!horaInicioTexto || !horaValida(horaInicioTexto)) erros.push("Hora Início inválida (use HH:MM)");
    if (!horaFimTexto || !horaValida(horaFimTexto)) erros.push("Hora Fim inválida (use HH:MM)");
    if (descontoTexto && !horaValida(descontoTexto)) erros.push("Desconto inválido (use HH:MM)");

    let totalHoras = 0;
    if (erros.length === 0) {
      if (horaFimTexto <= horaInicioTexto) {
        erros.push("Hora Fim precisa ser depois da Hora Início");
      } else {
        totalHoras = calcularTotalHoras(horaInicioTexto, horaFimTexto, descontoTexto);
      }
    }

    const ok = erros.length === 0;
    return {
      linha: l.linha,
      ok,
      erros,
      dados: ok
        ? {
            recursoId: recurso!.id,
            projetoId: projeto!.id,
            data,
            horaInicio: horaInicioTexto,
            horaFim: horaFimTexto,
            horaDesconto: descontoTexto,
            totalHoras,
          }
        : null,
      resumo: `${nomeRecurso || "?"} — ${codigoProposta || "?"} — ${dataTexto || `linha ${l.linha}`}`,
    };
  });
}

export function ImportarHorasRetroativasModal({
  open,
  onClose,
  recursos,
  projetos,
  clientes,
}: {
  open: boolean;
  onClose: () => void;
  recursos: Recurso[];
  projetos: Projeto[];
  clientes: Cliente[];
}) {
  return (
    <ImportModal<HoraRetroativaImportada>
      open={open}
      onClose={onClose}
      titulo="Importar horas retroativas"
      instrucoes={
        <>
          Colunas esperadas: <strong>Recurso</strong> (nome completo já cadastrado),{" "}
          <strong>Projeto</strong> (código da proposta), <strong>Cliente</strong> (opcional, só para
          conferência), <strong>Data</strong> (DD/MM/AAAA), <strong>Hora Início</strong> (HH:MM),{" "}
          <strong>Hora Fim</strong> (HH:MM), <strong>Desconto</strong> (HH:MM, opcional — ex.: 01:00
          de almoço). O total de horas já sai calculado com o desconto aplicado, e cada linha entra
          com status <strong>Aprovado</strong> direto. Elas aparecem para o consultor (e para quem vê a agenda
          dele) no Calendário e no histórico de Apontamento (Horas aprovadas).
        </>
      }
      textoConfirmar="Importar horas"
      processarLinhas={(linhas) => processar(linhas, recursos, projetos, clientes)}
      onConfirmar={async (validos) => {
        for (const h of validos) {
          await addDoc(collection(db, "eventosCalendario"), {
            data: h.data,
            projetoId: h.projetoId,
            recursoId: h.recursoId,
            horaInicio: h.horaInicio,
            horaFim: h.horaFim,
            horaDesconto: h.horaDesconto,
            totalHoras: h.totalHoras,
            descricao: "Importado — hora retroativa",
            origem: "avulso",
            status: "aprovado",
            retroativo: true,
            createdAt: serverTimestamp(),
          });
        }
      }}
    />
  );
}
