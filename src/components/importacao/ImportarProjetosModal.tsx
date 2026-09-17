"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ImportModal, type LinhaValidada } from "@/components/importacao/ImportModal";
import { pegarCampo, type LinhaImportada } from "@/lib/importarArquivo";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { MODULOS, TIPOS_ATENDIMENTO } from "@/types";
import type { Cliente, DocumentoProjeto, Modulo, Projeto, TipoAtendimento, TipoDocumento } from "@/types";

interface ProjetoImportado {
  clienteId: string;
  clienteNome: string;
  codigoProposta: string;
  modulo: Modulo;
  tipoAtendimento: TipoAtendimento;
  horasPrevistasConsultor: number;
  horasPrevistasCoordenador: number;
  dataInicio: string;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function parseNumero(texto: string): number | null {
  const limpo = texto.replace(",", ".").trim();
  if (!limpo) return 0;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function parseDataBR(texto: string): string | null {
  if (!texto.trim()) return null;
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const data = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  return data;
}

function processar(
  linhas: LinhaImportada[],
  clientes: Cliente[],
  projetosExistentes: Projeto[]
): LinhaValidada<ProjetoImportado>[] {
  const propostasExistentes = new Set(
    projetosExistentes.map((p) => normalizar(p.codigoProposta))
  );
  const propostasNoArquivo = new Set<string>();
  const hojeISO = new Date().toISOString().slice(0, 10);

  return linhas.map((l) => {
    const nomeCliente = pegarCampo(l.valores, "Nome do Cliente", "Cliente");
    const codigoProposta = pegarCampo(l.valores, "Código da Proposta", "Codigo da Proposta", "Proposta");
    const moduloTexto = pegarCampo(l.valores, "Módulo", "Modulo");
    const tipoTexto = pegarCampo(l.valores, "Tipo de Atendimento", "Tipo");
    const horasConsultorTexto = pegarCampo(l.valores, "Horas Consultor", "Horas do Consultor");
    const horasCoordenadorTexto = pegarCampo(l.valores, "Horas Coordenador", "Horas do Coordenador");
    const dataInicioTexto = pegarCampo(l.valores, "Data de Início", "Data de Inicio", "Data Início");

    const erros: string[] = [];

    const cliente = clientes.find(
      (c) => normalizar(c.nome) === normalizar(nomeCliente) || normalizar(c.nomeFantasia ?? "") === normalizar(nomeCliente)
    );
    if (!nomeCliente) erros.push("Nome do Cliente vazio");
    else if (!cliente) erros.push("Cliente não encontrado — cadastre ou importe o cliente primeiro");

    if (!codigoProposta) {
      erros.push("Código da Proposta vazio");
    } else if (propostasExistentes.has(normalizar(codigoProposta))) {
      erros.push("Código da Proposta já usado por outro projeto");
    } else if (propostasNoArquivo.has(normalizar(codigoProposta))) {
      erros.push("Código da Proposta duplicado no arquivo");
    }

    const modulo = MODULOS.find((m) => normalizar(m) === normalizar(moduloTexto));
    if (!moduloTexto) erros.push("Módulo vazio");
    else if (!modulo) erros.push(`Módulo inválido (use: ${MODULOS.join(", ")})`);

    const tipoAtendimento = TIPOS_ATENDIMENTO.find((t) => normalizar(t) === normalizar(tipoTexto));
    if (!tipoTexto) erros.push("Tipo de Atendimento vazio");
    else if (!tipoAtendimento) erros.push(`Tipo de Atendimento inválido (use: ${TIPOS_ATENDIMENTO.join(", ")})`);

    const horasConsultor = parseNumero(horasConsultorTexto);
    if (horasConsultor === null) erros.push("Horas Consultor inválida");

    const horasCoordenador = parseNumero(horasCoordenadorTexto);
    if (horasCoordenador === null) erros.push("Horas Coordenador inválida");

    let dataInicio = hojeISO;
    if (dataInicioTexto) {
      const parseada = parseDataBR(dataInicioTexto);
      if (!parseada) erros.push("Data de Início inválida (use DD/MM/AAAA)");
      else dataInicio = parseada;
    }

    if (erros.length === 0) propostasNoArquivo.add(normalizar(codigoProposta));

    const ok = erros.length === 0;
    return {
      linha: l.linha,
      ok,
      erros,
      dados: ok
        ? {
            clienteId: cliente!.id,
            clienteNome: nomeExibicaoCliente(cliente),
            codigoProposta,
            modulo: modulo as Modulo,
            tipoAtendimento: tipoAtendimento as TipoAtendimento,
            horasPrevistasConsultor: horasConsultor as number,
            horasPrevistasCoordenador: horasCoordenador as number,
            dataInicio,
          }
        : null,
      resumo: `${nomeCliente || "?"} — ${codigoProposta || `linha ${l.linha}`}`,
    };
  });
}

export function ImportarProjetosModal({
  open,
  onClose,
  clientes,
  projetosExistentes,
  tiposDocumento,
}: {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  projetosExistentes: Projeto[];
  tiposDocumento: TipoDocumento[];
}) {
  return (
    <ImportModal<ProjetoImportado>
      open={open}
      onClose={onClose}
      titulo="Importar projetos"
      instrucoes={
        <>
          Colunas esperadas: <strong>Nome do Cliente</strong> (precisa já estar cadastrado),{" "}
          <strong>Código da Proposta</strong> (único), <strong>Módulo</strong> (
          {MODULOS.join(", ")}), <strong>Tipo de Atendimento</strong> ({TIPOS_ATENDIMENTO.join(", ")}
          ), <strong>Horas Consultor</strong>, <strong>Horas Coordenador</strong>. Coluna opcional:{" "}
          <strong>Data de Início</strong> (DD/MM/AAAA — se não vier, usa a data de hoje). Os
          documentos padrão são incluídos automaticamente e o financeiro entra como &quot;Apontamento
          de horas&quot;, editável depois.
        </>
      }
      processarLinhas={(linhas) => processar(linhas, clientes, projetosExistentes)}
      onConfirmar={async (validos) => {
        const documentosPadrao: DocumentoProjeto[] = tiposDocumento.map((t) => ({
          tipoDocumentoId: t.id,
          codigo: t.codigo,
          descricao: t.descricao,
          pesoIndividual: t.pesoIndividual,
          status: "A_INICIAR",
        }));

        for (const p of validos) {
          await addDoc(collection(db, "projetos"), {
            clienteId: p.clienteId,
            codigoProposta: p.codigoProposta,
            modulo: p.modulo,
            tipoAtendimento: p.tipoAtendimento,
            coordenadorId: null,
            consultorIds: [],
            documentos: documentosPadrao,
            observacoes: "",
            financeiro: { tipoFaturamento: "apontamento_horas", valorTotal: 0, numeroParcelas: 0, parcelas: [] },
            horasPrevistasConsultor: p.horasPrevistasConsultor,
            horasPrevistasCoordenador: p.horasPrevistasCoordenador,
            dataInicio: p.dataInicio,
            dataFim: null,
            status: "ativo",
            contatoFaturamento: null,
            ultimoContato: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }}
    />
  );
}
