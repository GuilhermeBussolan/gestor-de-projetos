"use client";

import { ReactNode } from "react";

/**
 * Popup do tamanho da tela inteira (diferente do Drawer, que desliza pela
 * lateral): fundo do sistema visível e escurecido atrás, clique fora fecha.
 */
export function TelaCheia({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-navy/45 px-6 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
