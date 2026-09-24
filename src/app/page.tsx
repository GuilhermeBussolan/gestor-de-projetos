"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { usuario, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!usuario) {
      router.replace("/login");
      return;
    }
    const destino =
      usuario.perfil === "consultor"
        ? "/calendario"
        : usuario.perfil === "coordenador"
          ? "/projetos"
          : usuario.perfil === "financeiro"
            ? "/financeiro"
            : usuario.perfil === "responsavel_parceira"
              ? "/fechamento-parceira"
              : "/clientes";
    router.replace(destino);
  }, [usuario, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-brand-bg text-sm font-medium text-brand-faint">
      Carregando...
    </div>
  );
}
