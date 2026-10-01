"use client";

import { AbasNavegacao } from "@/components/layout/AbasNavegacao";

const ABAS = [
  { href: "/financeiro", label: "Visão geral" },
  { href: "/financeiro/liberacao", label: "Liberação de Faturamento" },
  { href: "/financeiro/faturamento-previsto", label: "Faturamento Previsto x Realizado" },
  { href: "/financeiro/fechamentos", label: "Fechamentos" },
  { href: "/financeiro/fechamento-mensal", label: "Relatório do Fechamento" },
];

export function FinanceiroTabs() {
  return <AbasNavegacao abas={ABAS} />;
}
