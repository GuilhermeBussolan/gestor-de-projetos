"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  href: string;
  label: string;
  perfis: Array<"administrador" | "coordenador" | "consultor">;
}

const CADASTROS: NavItem[] = [
  { href: "/clientes", label: "Clientes", perfis: ["administrador"] },
  { href: "/recursos", label: "Recursos", perfis: ["administrador"] },
  { href: "/documentos", label: "Documentos", perfis: ["administrador"] },
  { href: "/usuarios", label: "Usuários", perfis: ["administrador"] },
];

const PRINCIPAIS: NavItem[] = [
  { href: "/projetos", label: "Projetos", perfis: ["administrador", "coordenador"] },
  { href: "/dashboard", label: "Dashboard", perfis: ["administrador", "coordenador"] },
  { href: "/calendario", label: "Calendário", perfis: ["administrador", "coordenador", "consultor"] },
  { href: "/apontamento", label: "Apontamento", perfis: ["administrador", "coordenador", "consultor"] },
  { href: "/financeiro", label: "Financeiro", perfis: ["administrador"] },
];

export function Sidebar() {
  const { usuario } = useAuth();
  const pathname = usePathname();
  if (!usuario) return null;

  const podeVer = (item: NavItem) => item.perfis.includes(usuario.perfil);

  const linkClass = (href: string) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-sky-600 text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const cadastrosVisiveis = CADASTROS.filter(podeVer);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-600 text-sm font-bold text-white">
          GP
        </div>
        <span className="text-sm font-semibold text-slate-900">Gestor de Projetos</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {PRINCIPAIS.filter(podeVer)
          .slice(0, 2)
          .map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}

        {cadastrosVisiveis.length > 0 && (
          <div className="pt-3">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cadastros
            </p>
            {cadastrosVisiveis.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <div className="pt-3">
          {PRINCIPAIS.filter(podeVer)
            .slice(2)
            .map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
        </div>
      </nav>
    </aside>
  );
}
