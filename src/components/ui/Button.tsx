"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-accent text-white font-bold shadow-[0_6px_16px_rgba(47,111,228,0.28)] hover:bg-brand-accent-dark hover:-translate-y-px",
  secondary:
    "bg-white text-brand-navy-2 font-semibold border border-brand-border hover:bg-brand-hover",
  danger: "bg-red-600 text-white font-bold hover:bg-red-700",
  ghost: "bg-transparent text-brand-muted font-semibold hover:bg-brand-hover",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[13.5px] transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0 ${variants[variant]} ${className}`}
    />
  );
}
