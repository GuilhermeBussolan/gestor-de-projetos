"use client";

import { ReactNode } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
  flush = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** When true, skips the default padded header bar — content renders its own hero/header. */
  flush?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-brand-navy/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-brand-bg shadow-[-24px_0_60px_rgba(15,29,56,0.25)]">
        {!flush && (
          <div className="flex items-center justify-between border-b border-brand-border bg-white px-5 py-4">
            <div className="text-[15px] font-bold tracking-[-0.01em] text-brand-navy-2">{title}</div>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-brand-faint hover:bg-brand-hover hover:text-brand-navy-2"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        )}
        <div className={flush ? "flex-1 overflow-y-auto" : "flex-1 overflow-y-auto px-5 py-4"}>
          {children}
        </div>
      </div>
    </div>
  );
}
