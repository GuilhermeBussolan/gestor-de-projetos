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
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
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
  { href: "/usuarios", label: "Usuários", icon: UserCog, perfis: ["administrador"] },
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
    perfis: ["administrador", "coordenador"],
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
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          colapsada ? "justify-center" : ""
        } ${
          ativo
            ? "bg-sky-600 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icone size={18} className="shrink-0" />
        {!colapsada && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] ${
        colapsada ? "w-16" : "w-60"
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b border-slate-200 px-4 py-4 ${
          colapsada ? "justify-center px-2" : ""
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-600 text-sm font-bold text-white">
          GP
        </div>
        {!colapsada && (
          <span className="truncate text-sm font-semibold text-slate-900">
            Gestor de Projetos
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {PRINCIPAIS.filter(podeVer).map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {cadastrosVisiveis.length > 0 && (
          <div className="pt-2">
            {colapsada ? (
              <div className="my-2 border-t border-slate-100" />
            ) : (
              <button
                onClick={alternarCadastros}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
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

        <div className="pt-2">
          {colapsada && <div className="my-2 border-t border-slate-100" />}
          {OPERACAO.filter(podeVer).map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-2">
        <button
          onClick={alternarColapsada}
          title={colapsada ? "Expandir menu" : "Recolher menu"}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 ${
            colapsada ? "justify-center" : ""
          }`}
        >
          {colapsada ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!colapsada && <span>Recolher menu</span>}
        </button>
      </div>
    </aside>
  );
}
