"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TrocarSenhaModal } from "@/components/layout/TrocarSenhaModal";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { useAuth } from "@/contexts/AuthContext";

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
          {usuario && (
            <AccountMenu
              usuario={usuario}
              onTrocarSenha={() => setTrocarSenhaAberto(true)}
              onSair={handleLogout}
            />
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <TrocarSenhaModal open={trocarSenhaAberto} onClose={() => setTrocarSenhaAberto(false)} />
    </div>
  );
}
