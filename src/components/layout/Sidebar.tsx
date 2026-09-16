"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perfis: Array<"administrador" | "coordenador" | "consultor">;
}

const CADASTROS: NavItem[] = [
  { href: "/clientes", label: "Clientes", icon: Building2, perfis: ["administrador"] },
  { href: "/recursos", label: "Recursos", icon: Users, perfis: ["administrador"] },
  { href: "/documentos", label: "Documentos", icon: FileText, perfis: ["administrador"] },
];

const PRINCIPAIS: NavItem[] = [
  {
    href: "/projetos",
    label: "Projetos",
    icon: FolderKanban,
    perfis: ["administrador", "coordenador"],
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    perfis: ["administrador", "coordenador", "consultor"],
  },
];

const OPERACAO: NavItem[] = [
  {
    href: "/calendario",
    label: "Calendário",
    icon: CalendarDays,
    perfis: ["administrador", "coordenador", "consultor"],
  },
  {
    href: "/apontamento",
    label: "Apontamento",
    icon: Clock,
    perfis: ["administrador", "coordenador", "consultor"],
  },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, perfis: ["administrador"] },
];

const SIDEBAR_COLAPSADA_KEY = "gp_sidebar_colapsada";
const CADASTROS_ABERTO_KEY = "gp_cadastros_aberto";

export function Sidebar() {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const [colapsada, setColapsada] = useState(
    () => localStorage.getItem(SIDEBAR_COLAPSADA_KEY) === "1"
  );
  const [cadastrosAberto, setCadastrosAberto] = useState(
    () => localStorage.getItem(CADASTROS_ABERTO_KEY) !== "0"
  );

  function alternarColapsada() {
    setColapsada((prev) => {
      const novo = !prev;
      localStorage.setItem(SIDEBAR_COLAPSADA_KEY, novo ? "1" : "0");
      return novo;
    });
  }

  function alternarCadastros() {
    setCadastrosAberto((prev) => {
      const novo = !prev;
      localStorage.setItem(CADASTROS_ABERTO_KEY, novo ? "1" : "0");
      return novo;
    });
  }

  if (!usuario) return null;

  const podeVer = (item: NavItem) => item.perfis.includes(usuario.perfil);
  const cadastrosVisiveis = CADASTROS.filter(podeVer);

  function NavLink({ item }: { item: NavItem }) {
    const ativo = pathname === item.href;
    const Icone = item.icon;
    return (
      <Link
        href={item.href}
        title={colapsada ? item.label : undefined}
        className={`flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
          colapsada ? "justify-center" : ""
        } ${
          ativo
            ? "bg-gradient-to-r from-brand-accent/95 to-brand-accent/55 text-white shadow-[0_8px_18px_rgba(47,111,228,0.32)]"
            : "text-white/65 hover:bg-white/8 hover:text-white"
        }`}
      >
        <Icone size={17} className="shrink-0" />
        {!colapsada && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-brand-navy text-white transition-[width] ${
        colapsada ? "w-16" : "w-[232px]"
      }`}
    >
      <div
        className="pointer-events-none absolute -top-[120px] -left-[90px] h-[340px] w-[340px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,111,228,.35) 0%, rgba(47,111,228,0) 70%)",
        }}
      />

      <div
        className={`relative flex items-center border-b border-white/8 py-3 ${
          colapsada ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        {!colapsada && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-white.png" alt="NG" className="h-6 w-auto shrink-0" />
        )}
        <button
          onClick={alternarColapsada}
          title={colapsada ? "Expandir menu" : "Recolher menu"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/8 text-white/75 hover:bg-white/18 hover:text-white"
        >
          <Menu size={16} />
        </button>
      </div>

      <nav className="relative flex-1 space-y-1 overflow-y-auto p-3">
        {PRINCIPAIS.filter(podeVer).map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {cadastrosVisiveis.length > 0 && (
          <div className="pt-3">
            {colapsada ? (
              <div className="my-2 border-t border-white/10" />
            ) : (
              <button
                onClick={alternarCadastros}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/38 hover:text-white/60"
              >
                Cadastros
                <ChevronDown
                  size={14}
                  className={`transition-transform ${cadastrosAberto ? "" : "-rotate-90"}`}
                />
              </button>
            )}
            {(colapsada || cadastrosAberto) &&
              cadastrosVisiveis.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        )}

        <div className="pt-3">
          {colapsada && <div className="my-2 border-t border-white/10" />}
          {OPERACAO.filter(podeVer).map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
