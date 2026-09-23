import jsPDF from "jspdf";
import {
  carregarImagemDataUrl,
  formatoImagem,
  nomeArquivoSeguro,
  redimensionarImagem,
  NG_INFORMATICA,
} from "@/lib/relatorioFechamento";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, EventoCalendario, Projeto, Recurso } from "@/types";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// Paleta do app (globals.css) — mantém a mesma identidade visual nos PDFs.
const NAVY: [number, number, number] = [21, 40, 73];
const ACCENT: [number, number, number] = [47, 111, 228];
const ACCENT_SOFT: [number, number, number] = [232, 239, 255];
const MUTED: [number, number, number] = [106, 117, 148];
const FAINT: [number, number, number] = [139, 148, 173];
const BORDER: [number, number, number] = [228, 232, 242];
const HOVER: [number, number, number] = [247, 249, 253];

const MARGEM = 16;

/**
 * PDF de "Ordem de Serviço" para um apontamento específico — documento voltado ao CLIENTE, então
 * só mostra o que interessa a ele (quem, quando, o que foi feito); nada de horas/duração do
 * atendimento, que é controle interno. Pronto pra confirmação por assinatura manual — o envio por
 * e-mail ainda é feito fora do sistema.
 */
export async function gerarOrdemServicoPdf(
  evento: Pick<EventoCalendario, "data" | "descricao">,
  projeto: Pick<Projeto, "codigoProposta" | "modulo">,
  cliente: Cliente | undefined,
  recurso: Recurso | undefined,
  atividades: string[],
  logoUrl = "/logo-white.png"
) {
  const pdf = new jsPDF();
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  const nomeCliente = nomeExibicaoCliente(cliente);

  // --- Faixa de cabeçalho (navy, com a logo clara) ---
  const alturaFaixa = 34;
  pdf.setFillColor(...NAVY);
  pdf.rect(0, 0, largura, alturaFaixa, "F");

  const logoBruto = await carregarImagemDataUrl(logoUrl);
  const logo = logoBruto ? await redimensionarImagem(logoBruto, 360).catch(() => logoBruto) : null;
  if (logo) {
    try {
      const props = pdf.getImageProperties(logo);
      const alturaLogo = 13;
      const larguraLogo = Math.min((props.width / props.height) * alturaLogo, 46);
      pdf.addImage(logo, formatoImagem(logo), MARGEM, (alturaFaixa - alturaLogo) / 2, larguraLogo, alturaLogo);
    } catch {
      // logo inválida — segue sem ela
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Ordem de Serviço", largura - MARGEM, alturaFaixa / 2 - 1, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(210, 220, 240);
  pdf.text(NG_INFORMATICA.razaoSocial, largura - MARGEM, alturaFaixa / 2 + 6, { align: "right" });

  let y = alturaFaixa + 14;

  // --- Dados do cliente / projeto ---
  const rotulo = (texto: string, x: number, yPos: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...FAINT);
    pdf.text(texto.toUpperCase(), x, yPos);
  };
  const valor = (texto: string, x: number, yPos: number, tamanho = 12) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...NAVY);
    pdf.text(texto, x, yPos);
  };

  rotulo("Cliente", MARGEM, y);
  valor(nomeCliente, MARGEM, y + 6, 13);
  y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...MUTED);
  const linhaInfo: string[] = [];
  if (cliente?.cnpj) linhaInfo.push(`CNPJ ${cliente.cnpj}`);
  linhaInfo.push(`Projeto ${projeto.codigoProposta} · ${projeto.modulo}`);
  linhaInfo.push(`Atendimento em ${dataBR(evento.data)}`);
  if (recurso?.nomeCompleto) linhaInfo.push(`Consultor: ${recurso.nomeCompleto}`);
  pdf.text(linhaInfo.join("   ·   "), MARGEM, y);
  y += 10;

  pdf.setDrawColor(...BORDER);
  pdf.setLineWidth(0.4);
  pdf.line(MARGEM, y, largura - MARGEM, y);
  y += 12;

  // --- Atividades realizadas ---
  pdf.setFillColor(...ACCENT);
  pdf.roundedRect(MARGEM, y - 4, 3, 3, 0.5, 0.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...NAVY);
  pdf.text("Atividades realizadas", MARGEM + 6, y - 1.3);
  y += 8;

  const garantirEspaco = (necessario: number) => {
    if (y + necessario > altura - 20) {
      pdf.addPage();
      y = MARGEM + 4;
    }
  };

  const larguraTexto = largura - MARGEM * 2 - 14;
  atividades.forEach((descricao, i) => {
    const linhas = pdf.splitTextToSize(descricao, larguraTexto);
    const alturaItem = Math.max(9, linhas.length * 5 + 4);
    garantirEspaco(alturaItem);

    if (i % 2 === 1) {
      pdf.setFillColor(...HOVER);
      pdf.rect(MARGEM, y - 5, largura - MARGEM * 2, alturaItem, "F");
    }

    pdf.setFillColor(...ACCENT);
    pdf.circle(MARGEM + 4, y - 1.2, 3, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text(String(i + 1), MARGEM + 4, y, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...NAVY);
    pdf.text(linhas, MARGEM + 11, y);

    y += alturaItem;
  });

  // --- Observações ---
  if (evento.descricao.trim()) {
    garantirEspaco(20);
    y += 4;
    const obs = pdf.splitTextToSize(evento.descricao.trim(), largura - MARGEM * 2 - 8);
    const alturaCaixa = obs.length * 4.5 + 12;
    garantirEspaco(alturaCaixa);
    pdf.setFillColor(...HOVER);
    pdf.roundedRect(MARGEM, y - 5, largura - MARGEM * 2, alturaCaixa, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...FAINT);
    pdf.text("OBSERVAÇÕES", MARGEM + 4, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...MUTED);
    pdf.text(obs, MARGEM + 4, y + 6);
    y += alturaCaixa + 6;
  }

  // --- Confirmação do cliente ---
  const alturaConfirmacao = 40;
  garantirEspaco(alturaConfirmacao + 6);
  y += 6;
  pdf.setDrawColor(...BORDER);
  pdf.setFillColor(...ACCENT_SOFT);
  pdf.roundedRect(MARGEM, y, largura - MARGEM * 2, alturaConfirmacao, 3, 3, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...ACCENT);
  pdf.text("CONFIRMAÇÃO DO CLIENTE", MARGEM + 6, y + 9);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...NAVY);
  pdf.text("Declaro que as atividades acima foram realizadas conforme descrito.", MARGEM + 6, y + 15.5);

  const linhaAssinaturaY = y + 32;
  pdf.setDrawColor(...NAVY);
  pdf.line(MARGEM + 6, linhaAssinaturaY, MARGEM + 100, linhaAssinaturaY);
  pdf.setFontSize(8);
  pdf.setTextColor(...FAINT);
  pdf.text("Assinatura / nome", MARGEM + 6, linhaAssinaturaY + 4.5);
  pdf.line(largura - MARGEM - 60, linhaAssinaturaY, largura - MARGEM - 6, linhaAssinaturaY);
  pdf.text("Data", largura - MARGEM - 60, linhaAssinaturaY + 4.5);

  pdf.save(`ordem-servico-${nomeArquivoSeguro(nomeCliente)}-${evento.data}.pdf`);
}
