"use client";

import { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-navy/45 backdrop-blur-[2px] p-4 pt-10">
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-white shadow-card-lg`}
      >
        <div className="flex items-center justify-between border-b border-brand-border-soft px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-brand-navy-2">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-brand-faint hover:bg-brand-hover hover:text-brand-navy-2"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
