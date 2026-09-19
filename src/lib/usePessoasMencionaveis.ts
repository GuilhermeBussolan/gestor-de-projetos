"use client";

import { useEffect, useMemo, useRef } from "react";
import { useCollection } from "@/lib/useCollection";
import { sincronizarDiretorio } from "@/lib/diretorio";
import { pessoasMencionaveis } from "@/lib/mencoes";
import type { PessoaDiretorio, Projeto, Usuario } from "@/types";

type UsuarioDoc = Omit<Usuario, "uid"> & { id: string };

/**
 * Administradores e o time alocado no projeto (menos você), para a lista de @.
 * Quem não é administrador lê o "diretorio"; o administrador lê "usuarios"
 * direto (só ele pode listá-lo), então a lista dele não depende da sincronização —
 * e, se o diretório estiver defasado, ele mesmo o atualiza.
 */
export function usePessoasMencionaveis(
  projeto: Pick<Projeto, "coordenadorId" | "consultorIds">,
  usuario: Usuario | null
) {
  const souAdmin = usuario?.perfil === "administrador";
  const { data: diretorio, erro: erroDiretorio } = useCollection<PessoaDiretorio>("diretorio", []);
  const { data: usuarios } = useCollection<UsuarioDoc>("usuarios", [], souAdmin);
  const sincronizou = useRef(false);

  const base = useMemo<PessoaDiretorio[]>(
    () =>
      souAdmin
        ? usuarios.map((u) => ({
            id: u.id,
            nomeCompleto: u.nomeCompleto,
            perfil: u.perfil,
            recursoId: u.recursoId ?? null,
          }))
        : diretorio,
    [souAdmin, usuarios, diretorio]
  );

  useEffect(() => {
    if (!souAdmin || !usuario || sincronizou.current || usuarios.length === 0) return;
    const noDiretorio = new Set(diretorio.map((p) => p.id));
    if (usuarios.some((u) => !noDiretorio.has(u.id))) {
      sincronizou.current = true;
      sincronizarDiretorio(usuario).catch((err) =>
        console.warn("Não foi possível atualizar o diretório de pessoas:", err)
      );
    }
  }, [souAdmin, usuario, usuarios, diretorio]);

  const pessoas = useMemo(
    () => pessoasMencionaveis(base, projeto, usuario?.uid ?? ""),
    [base, projeto, usuario?.uid]
  );

  return { pessoas, erroLista: !souAdmin && erroDiretorio };
}
