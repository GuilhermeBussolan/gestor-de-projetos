"use client";

import { AbasNavegacao } from "@/components/layout/AbasNavegacao";

const ABAS = [
  { href: "/calendario", label: "Calendário" },
  { href: "/calendario/mapa-alocacao", label: "Mapa de Alocação" },
];

export function CalendarioTabs() {
  return <AbasNavegacao abas={ABAS} />;
}
