"use client";

import { AbasNavegacao } from "@/components/layout/AbasNavegacao";

const ABAS = [
  { href: "/clientes", label: "Clientes" },
  { href: "/recursos", label: "Recursos" },
  { href: "/parceiras", label: "Parceiras" },
  { href: "/documentos", label: "Documentos" },
  { href: "/escopos", label: "Escopos" },
];

export function CadastrosTabs() {
  return <AbasNavegacao abas={ABAS} />;
}
