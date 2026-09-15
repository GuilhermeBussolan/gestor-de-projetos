"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import type { Perfil } from "@/types";

export function ProtectedPage({
  perfis,
  children,
}: {
  perfis: Perfil[];
  children: ReactNode;
}) {
  const { usuario, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!usuario) {
      router.replace("/login");
      return;
    }
    if (!perfis.includes(usuario.perfil)) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, usuario]);

  if (loading || !usuario || !perfis.includes(usuario.perfil)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400">
        Carregando...
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
