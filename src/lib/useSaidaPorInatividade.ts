"use client";

import { useEffect } from "react";

/** Depois deste tempo sem nenhuma atividade (em qualquer aba), o sistema sai sozinho. */
export const LIMITE_INATIVIDADE_MS = 8 * 60 * 60 * 1000;

const CHAVE_ULTIMA_ATIVIDADE = "gp_ultima_atividade";
/** Marca, para a tela de login avisar que a sessão expirou por inatividade. */
export const CHAVE_SAIU_POR_INATIVIDADE = "gp_saiu_por_inatividade";
const INTERVALO_VERIFICACAO_MS = 60 * 1000;

function lerUltimaAtividade(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function registrarAtividade() {
  try {
    localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(Date.now()));
  } catch {
    // sem armazenamento: a sessão não expira por inatividade neste navegador
  }
}

/**
 * Logout automático por inatividade: enquanto há alguém logado, cliques, teclas, rolagem e toques contam como
 * atividade (registrada no navegador, compartilhada entre as abas). Passado o limite sem atividade — inclusive com o
 * navegador fechado —, chama `sair`. Protege o computador compartilhado ou esquecido aberto.
 */
export function useSaidaPorInatividade(logado: boolean, sair: () => Promise<void> | void) {
  useEffect(() => {
    if (!logado) return;

    function expirou() {
      const ultima = lerUltimaAtividade();
      return ultima !== null && Date.now() - ultima > LIMITE_INATIVIDADE_MS;
    }
    async function encerrar() {
      try {
        sessionStorage.setItem(CHAVE_SAIU_POR_INATIVIDADE, "1");
      } catch {
        // só deixa de mostrar o aviso no login
      }
      await sair();
    }

    // Ao abrir o sistema: se a última atividade foi há mais que o limite, sai antes de qualquer coisa.
    if (expirou()) {
      void encerrar();
      return;
    }
    registrarAtividade();

    let ultimaGravacao = Date.now();
    const aoAgir = () => {
      // Grava no máximo uma vez por minuto para não pesar.
      if (Date.now() - ultimaGravacao > INTERVALO_VERIFICACAO_MS) {
        ultimaGravacao = Date.now();
        registrarAtividade();
      }
    };
    const eventos = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    eventos.forEach((ev) => window.addEventListener(ev, aoAgir, { passive: true }));
    const verificacao = window.setInterval(() => {
      if (expirou()) void encerrar();
    }, INTERVALO_VERIFICACAO_MS);

    return () => {
      eventos.forEach((ev) => window.removeEventListener(ev, aoAgir));
      window.clearInterval(verificacao);
    };
  }, [logado, sair]);
}
