"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TIPO_REGISTRO_CONFIG } from "@/lib/constants";
import { partirComMencoes } from "@/lib/mencoes";
import type { ContatoProjeto } from "@/types";

export function formatarDataHoraCurta(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TextoComMencoes({ registro }: { registro: ContatoProjeto }) {
  const partes = partirComMencoes(
    registro.texto,
    (registro.mencionados ?? []).map((m) => m.nome)
  );
  return (
    <>
      {partes.map((p, i) =>
        p.mencao ? (
          <span key={i} className="rounded bg-brand-accent-soft px-1 font-semibold text-brand-accent">
            {p.texto}
          </span>
        ) : (
          <span key={i}>{p.texto}</span>
        )
      )}
    </>
  );
}

/**
 * Uma entrada da linha do tempo do projeto. Com `ciencias`, mostra o status de
 * cada pessoa marcada e, se você foi marcado, o botão "Dar ciência".
 */
export function RegistroItem({
  registro,
  ciencias,
  meuUid,
  onDarCiencia,
  compacto = false,
}: {
  registro: ContatoProjeto;
  /** uid → quando deu ciência deste registro. */
  ciencias?: Map<string, number>;
  meuUid?: string;
  onDarCiencia?: (registro: ContatoProjeto) => Promise<void>;
  compacto?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const tipo = registro.tipo ?? "atualizacao";
  const cfg = TIPO_REGISTRO_CONFIG[tipo];
  const mencionados = registro.mencionados ?? [];
  const euMarcado = !!meuUid && mencionados.some((m) => m.uid === meuUid);
  const euJaCiente = !!meuUid && !!ciencias?.has(meuUid);

  async function ciente() {
    if (!onDarCiencia) return;
    setErro("");
    setEnviando(true);
    try {
      await onDarCiencia(registro);
    } catch (err) {
      console.error("Erro ao dar ciência:", err);
      setErro("Não foi possível registrar a ciência. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (tipo === "ciencia") {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#15754c]">
        <Check size={13} strokeWidth={3} className="shrink-0" />
        <span>
          <strong>{registro.usuarioNome}</strong> deu ciência
          {mencionados[0] ? ` do registro de ${mencionados[0].nome}` : ""}
        </span>
        <span className="text-brand-faint">· {formatarDataHoraCurta(registro.criadoEm)}</span>
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11.5px] font-semibold text-brand-faint">
          {formatarDataHoraCurta(registro.criadoEm)} · {registro.usuarioNome}
        </p>
        {tipo !== "atualizacao" && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}
          >
            {cfg.label}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] leading-relaxed whitespace-pre-line text-brand-navy-2">
        <TextoComMencoes registro={registro} />
      </p>

      {mencionados.length > 0 && !compacto && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {mencionados.map((m) => {
            const quando = ciencias?.get(m.uid);
            return quando ? (
              <span
                key={m.uid}
                className="rounded-full bg-[#e3f5ea] px-2 py-0.5 text-[10.5px] font-semibold text-[#15754c]"
              >
                ✓ {m.nome} ciente · {formatarDataHoraCurta(quando)}
              </span>
            ) : (
              <span
                key={m.uid}
                className="rounded-full bg-[#fff2de] px-2 py-0.5 text-[10.5px] font-semibold text-[#a4650d]"
              >
                {m.nome} · aguardando ciência
              </span>
            );
          })}
        </div>
      )}

      {euMarcado && !euJaCiente && onDarCiencia && !compacto && (
        <div className="mt-2">
          <Button variant="secondary" onClick={ciente} disabled={enviando}>
            <Check size={14} /> {enviando ? "Registrando..." : "Dar ciência"}
          </Button>
          {erro && <p className="mt-1 text-[12px] font-medium text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
