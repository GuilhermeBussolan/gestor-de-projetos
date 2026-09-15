"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TrocarSenhaModal } from "@/components/layout/TrocarSenhaModal";
import { useAuth } from "@/contexts/AuthContext";

const PERFIL_LABEL: Record<string, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const [trocarSenhaAberto, setTrocarSenhaAberto] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div />
          <div className="flex items-center gap-4">
            {usuario && (
              <span className="text-sm text-slate-600">
                {usuario.nomeCompleto}{" "}
                <span className="text-slate-400">· {PERFIL_LABEL[usuario.perfil]}</span>
              </span>
            )}
            <button
              onClick={() => setTrocarSenhaAberto(true)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Trocar senha
            </button>
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <TrocarSenhaModal open={trocarSenhaAberto} onClose={() => setTrocarSenhaAberto(false)} />
    </div>
  );
}
