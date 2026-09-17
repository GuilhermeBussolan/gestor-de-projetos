"use client";

import { ReactNode } from "react";

/** Popup do tamanho da tela inteira (diferente do Drawer, que desliza pela lateral). */
export function TelaCheia({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-bg">{children}</div>;
}
