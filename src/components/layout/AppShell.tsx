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
    <div className="flex h-screen w-full bg-brand-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[68px] shrink-0 items-center justify-end border-b border-brand-border bg-white px-7">
          {usuario && (
            <AccountMenu
              usuario={usuario}
              onTrocarSenha={() => setTrocarSenhaAberto(true)}
              onSair={handleLogout}
            />
          )}
        </header>
        <main className="flex-1 overflow-y-auto px-7 py-6">{children}</main>
      </div>
      <TrocarSenhaModal open={trocarSenhaAberto} onClose={() => setTrocarSenhaAberto(false)} />
    </div>
  );
}
