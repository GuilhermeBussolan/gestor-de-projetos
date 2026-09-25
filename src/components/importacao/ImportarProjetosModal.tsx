"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Download } from "lucide-react";
import { db } from "@/lib/firebase";
import { ImportModal, type LinhaValidada } from "@/components/importacao/ImportModal";
import { pegarCampo, type LinhaImportada } from "@/lib/importarArquivo";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { baixarModeloImportacaoProjetos } from "@/lib/modeloImportacaoProjetos";
import { MODULOS, TIPOS_ATENDIMENTO } from "@/types";
import type { Cliente, ContatoFaturamento, DocumentoProjeto, Financeiro, Modulo, Projeto, TipoAtendimento, TipoDocumento, TipoFaturamento } from "@/types";

export interface ProjetoImportado {
  clienteId: string;
  clienteNome: string;
  codigoProposta: string;
  modulo: Modulo;
  tipoAtendimento: TipoAtendimento;
  horasPrevistasConsultor: number;
  horasPrevistasCoordenador: number;
  dataInicio: string;
  financeiro: Financeiro;
  contatoFaturamento: ContatoFaturamento | null;
  observacoes: string;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Aceita "80,5", "80.5", "20000", "20.000,00", "R$ 20.000" — devolve null se não for número. Vazio = 0. */
export function parseNumero(texto: string): number | null {
  let t = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "20.000" = vinte mil
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseData(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const data = iso ? t : br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : null;
  if (!data || Number.isNaN(new Date(data).getTime())) return null;
  return data;
}

/** "Apontamento" -> apontamento_horas, "Parcelado", "Banco de horas"; "marco" não é importável; vazio = apontamento. */
function parseTipoFaturamento(texto: string): TipoFaturamento | "marco" | null {
  const t = normalizar(texto);
  if (!t || t.startsWith("apont")) return "apontamento_horas";
  if (t.startsWith("parcel")) return "parcelado";
  if (t.startsWith("banco")) return "banco_horas";
  if (t.startsWith("marco")) return "marco";
  return null;
}

const ROTULO_FATURAMENTO: Record<TipoFaturamento, string> = {
  apontamento_horas: "apontamento",
  parcelado: "parcelado",
  marco_faturamento: "marco",
  banco_horas: "banco de horas",
};

export function processarProjetos(linhas: LinhaImportada[], clientes: Cliente[], projetosExistentes: Projeto[]): LinhaValidada<ProjetoImportado>[] {
  const propostasExistentes = new Set(projetosExistentes.map((p) => normalizar(p.codigoProposta)));
  const propostasNoArquivo = new Set<string>();
  const hojeISO = new Date().toISOString().slice(0, 10);

  return linhas.map((l) => {
    const campo = (...nomes: string[]) => pegarCampo(l.valores, ...nomes).trim();
    const nomeCliente = campo("Nome do Cliente", "Cliente");
    const codigoProposta = campo("Código da Proposta", "Codigo da Proposta", "Proposta");
    const moduloTexto = campo("Módulo (opcional)", "Módulo", "Modulo");
    const tipoTexto = campo("Tipo de Atendimento", "Tipo");
    const horasConsultorTexto = campo("Horas Consultor", "Horas do Consultor");
    const horasCoordenadorTexto = campo("Horas Coordenador", "Horas do Coordenador");
    const dataInicioTexto = campo("Data de Início", "Data de Inicio", "Data Início");
    const tipoFaturamentoTexto = campo("Tipo de faturamento", "Faturamento");
    const valorTexto = campo("Valor do projeto", "Valor do Projeto", "Valor");
    const parcelasTexto = campo("Parcelas", "Número de parcelas", "Numero de parcelas");
    const valorHoraTexto = campo("Valor hora (só banco de horas)", "Valor hora", "Valor da hora");
    const contatoNome = campo("Contato de faturamento", "Contato");
    const contatoCnpj = campo("CNPJ de faturamento", "CNPJ");
    const contatoEmail = campo("E-mail", "Email");
    const contatoTelefone = campo("Telefone");
    const contatoEmailNF = campo("E-mail para envio da nota fiscal", "Email para envio da nota fiscal", "E-mail NF");
    const observacoes = campo("Observações", "Observacoes");

    const erros: string[] = [];

    const cliente = clientes.find(
      (c) => normalizar(c.nome) === normalizar(nomeCliente) || normalizar(c.nomeFantasia ?? "") === normalizar(nomeCliente)
    );
    if (!nomeCliente) erros.push("Nome do cliente vazio");
    else if (!cliente) erros.push("Cliente não encontrado — cadastre ou importe o cliente primeiro");

    if (!codigoProposta) {
      erros.push("Código da Proposta vazio");
    } else if (propostasExistentes.has(normalizar(codigoProposta))) {
      erros.push("Código da Proposta já usado por outro projeto");
    } else if (propostasNoArquivo.has(normalizar(codigoProposta))) {
      erros.push("Código da Proposta duplicado no arquivo");
    }

    // Módulo é opcional neste formato: sem ele o projeto entra como QRH (o Financeiro usa o módulo para separar LIOT x NG).
    const modulo = moduloTexto ? MODULOS.find((m) => normalizar(m) === normalizar(moduloTexto)) : MODULOS[0];
    if (!modulo) erros.push(`Módulo inválido (use: ${MODULOS.join(", ")})`);

    const tipoAtendimento = TIPOS_ATENDIMENTO.find((t) => normalizar(t) === normalizar(tipoTexto));
    if (!tipoTexto) erros.push("Tipo de Atendimento vazio");
    else if (!tipoAtendimento) erros.push(`Tipo de Atendimento inválido (use: ${TIPOS_ATENDIMENTO.join(", ")})`);

    const horasConsultor = parseNumero(horasConsultorTexto);
    if (horasConsultor === null) erros.push("Horas Consultor inválida");
    const horasCoordenador = parseNumero(horasCoordenadorTexto);
    if (horasCoordenador === null) erros.push("Horas Coordenador inválida");

    let dataInicio = hojeISO;
    if (dataInicioTexto) {
      const parseada = parseData(dataInicioTexto);
      if (!parseada) erros.push("Data de Início inválida (use DD/MM/AAAA)");
      else dataInicio = parseada;
    }

    // Financeiro
    const tipoFaturamento = parseTipoFaturamento(tipoFaturamentoTexto);
    const valor = parseNumero(valorTexto);
    const parcelas = parcelasTexto ? parseNumero(parcelasTexto) : 0;
    const valorHora = parseNumero(valorHoraTexto);
    let financeiro: Financeiro = { tipoFaturamento: "apontamento_horas", valorTotal: 0, numeroParcelas: 0, parcelas: [] };
    if (tipoFaturamento === null) {
      erros.push("Tipo de faturamento inválido (use: Apontamento, Parcelado ou Banco de horas)");
    } else if (tipoFaturamento === "marco") {
      erros.push("Marco de faturamento não é importável — importe como Parcelado/Apontamento e ajuste no sistema");
    } else if (valor === null) {
      erros.push("Valor do projeto inválido");
    } else if (tipoFaturamento === "apontamento_horas") {
      // Faturamento por apontamento não tem parcelas; o valor (se vier) fica só como valor do contrato.
      financeiro = { tipoFaturamento, valorTotal: valor, numeroParcelas: 0, parcelas: [] };
    } else if (tipoFaturamento === "parcelado") {
      if (valor <= 0) erros.push("Parcelado: informe o Valor do projeto");
      else if (parcelas === null || parcelas < 1 || !Number.isInteger(parcelas)) erros.push("Parcelado: informe a quantidade de Parcelas (número inteiro)");
      else {
        const valorParcela = Math.round((valor / parcelas) * 100) / 100;
        financeiro = {
          tipoFaturamento,
          valorTotal: valor,
          numeroParcelas: parcelas,
          parcelas: Array.from({ length: parcelas }, (_, i) => ({ numero: i + 1, valor: valorParcela, status: "AGUARDANDO" as const })),
        };
      }
    } else if (tipoFaturamento === "banco_horas") {
      if (valor <= 0) erros.push("Banco de horas: informe o Valor do projeto (valor de venda)");
      else if (valorHora === null || valorHora <= 0) erros.push("Banco de horas: informe o Valor hora");
      else financeiro = { tipoFaturamento, valorTotal: valor, numeroParcelas: 0, parcelas: [], valorHora, valorVenda: valor };
    }

    const temContato = [contatoNome, contatoCnpj, contatoEmail, contatoTelefone, contatoEmailNF].some(Boolean);

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
            financeiro,
            contatoFaturamento: temContato
              ? { nome: contatoNome, cnpj: contatoCnpj, email: contatoEmail, telefone: contatoTelefone, emailNF: contatoEmailNF, memo: "" }
              : null,
            observacoes,
          }
        : null,
      resumo: `${nomeCliente || "?"} — ${codigoProposta || `linha ${l.linha}`}${
        ok ? ` · ${ROTULO_FATURAMENTO[financeiro.tipoFaturamento]}${financeiro.valorTotal ? ` · R$ ${financeiro.valorTotal.toLocaleString("pt-BR")}` : ""}${moduloTexto ? "" : " · módulo QRH (padrão)"}` : ""
      }`,
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
        <div className="space-y-2.5">
          <p>
            Use o modelo com estas colunas: <strong>Nome do cliente</strong> (já cadastrado), <strong>Código da Proposta</strong> (único),{" "}
            <strong>Tipo de Atendimento</strong> ({TIPOS_ATENDIMENTO.join(", ")}), <strong>Horas Consultor</strong>, <strong>Horas Coordenador</strong>,{" "}
            <strong>Data de Início</strong> (DD/MM/AAAA), <strong>Tipo de faturamento</strong> (Apontamento, Parcelado ou Banco de horas),{" "}
            <strong>Valor do projeto</strong>, <strong>Parcelas</strong>, os dados de <strong>contato de faturamento</strong> (contato, CNPJ, e-mail, telefone e e-mail
            da nota fiscal) e <strong>Observações</strong>.
          </p>
          <p>
            Opcionais no fim do arquivo: <strong>Módulo</strong> ({MODULOS.join(", ")} — vazio = QRH) e <strong>Valor hora</strong> (obrigatório no banco de
            horas). Os documentos padrão entram automaticamente.
          </p>
          <button
            type="button"
            onClick={() => baixarModeloImportacaoProjetos()}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-accent hover:underline"
          >
            <Download size={14} />
            Baixar modelo (.xlsx)
          </button>
        </div>
      }
      processarLinhas={(linhas) => processarProjetos(linhas, clientes, projetosExistentes)}
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
            observacoes: p.observacoes,
            financeiro: p.financeiro,
            horasPrevistasConsultor: p.horasPrevistasConsultor,
            horasPrevistasCoordenador: p.horasPrevistasCoordenador,
            dataInicio: p.dataInicio,
            dataFim: null,
            status: "ativo",
            contatoFaturamento: p.contatoFaturamento,
            ultimoContato: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }}
    />
  );
}
