"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { NotificacoesMenu } from "@/components/layout/NotificacoesMenu";
import { LinhaDoTempoProjeto } from "@/components/timeline/LinhaDoTempoProjeto";
import { GuiaSistema } from "@/components/layout/GuiaSistema";
import { GUIA_POR_PERFIL, guiaJaVisto, marcarGuiaVisto } from "@/lib/guiaSistema";
import { Sidebar } from "@/components/layout/Sidebar";
import { TrocarSenhaModal } from "@/components/layout/TrocarSenhaModal";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { useAuth } from "@/contexts/AuthContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const [trocarSenhaAberto, setTrocarSenhaAberto] = useState(false);
  const [projetoTempoId, setProjetoTempoId] = useState<string | null>(null);
  // Abre sozinho no primeiro acesso de cada usuário neste navegador.
  const [guiaAberto, setGuiaAberto] = useState(() =>
    // Perfis sem módulos no guia (ex: responsável de parceira) não abrem o tour.
    usuario ? !guiaJaVisto(usuario.uid) && GUIA_POR_PERFIL[usuario.perfil].modulos.length > 0 : false
  );

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  function fecharGuia() {
    if (usuario) marcarGuiaVisto(usuario.uid);
    setGuiaAberto(false);
  }

  return (
    <div className="flex h-screen w-full bg-brand-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[68px] shrink-0 items-center justify-end gap-2 border-b border-brand-border bg-white px-7">
          {usuario && (
            <>
              <NotificacoesMenu usuario={usuario} onAbrirProjeto={setProjetoTempoId} />
              <button
                type="button"
                onClick={() => setGuiaAberto(true)}
                title="Passo a passo do sistema"
                aria-label="Passo a passo do sistema"
                className="flex h-9 w-9 items-center justify-center rounded-full text-brand-faint hover:bg-brand-hover hover:text-brand-accent"
              >
                <CircleHelp size={20} />
              </button>
              <AccountMenu
                usuario={usuario}
                onTrocarSenha={() => setTrocarSenhaAberto(true)}
                onSair={handleLogout}
              />
            </>
          )}
        </header>
        <main className="flex-1 overflow-y-auto px-7 py-6">{children}</main>
      </div>
      <TrocarSenhaModal open={trocarSenhaAberto} onClose={() => setTrocarSenhaAberto(false)} />
      {usuario && <GuiaSistema open={guiaAberto} perfil={usuario.perfil} onClose={fecharGuia} />}
      <LinhaDoTempoProjeto projetoId={projetoTempoId} onClose={() => setProjetoTempoId(null)} />
    </div>
  );
}
