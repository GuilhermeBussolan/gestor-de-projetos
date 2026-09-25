"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { abrirArquivo, MENSAGEM_ERRO_ARQUIVO } from "@/lib/arquivosFechamento";
import type { ArquivoFechamento } from "@/types";

/** Botão que abre um arquivo do Storage (PDF da NF, comprovante ou documento complementar) em outra aba. */
export function LinkArquivo({ arquivo, rotulo }: { arquivo: ArquivoFechamento; rotulo?: string }) {
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={abrindo}
        onClick={async () => {
          setAbrindo(true);
          setErro("");
          try {
            await abrirArquivo(arquivo);
          } catch (err) {
            console.error("Erro ao abrir o arquivo:", err);
            setErro(MENSAGEM_ERRO_ARQUIVO);
          } finally {
            setAbrindo(false);
          }
        }}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-accent hover:underline disabled:opacity-50"
        title={arquivo.nome}
      >
        <Paperclip size={13} />
        <span className="max-w-[240px] truncate">{rotulo ?? arquivo.nome}</span>
      </button>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </span>
  );
}
