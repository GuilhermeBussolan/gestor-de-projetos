"use client";

import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useCollection } from "@/lib/useCollection";
import { comentarNaTarefa, type AtorWorkspace } from "@/lib/workspaceDb";
import type { Anotacao, ComentarioAnotacao } from "@/types";

const dataHora = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Conversa de uma tarefa compartilhada (admin/financeiro): cada um registra atualizações — atividades, pendências,
 * correções, pagamentos — e os demais participantes recebem o aviso no sino.
 */
export function ConversaTarefa({ anotacao, ator }: { anotacao: Anotacao; ator: AtorWorkspace }) {
  const { data: comentarios, loading } = useCollection<ComentarioAnotacao>(
    `anotacoes/${anotacao.id}/comentarios`,
    [orderBy("criadoEm", "asc")],
    true,
    [anotacao.id]
  );
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      await comentarNaTarefa(anotacao, ator, texto);
      setTexto("");
    } catch (err) {
      console.error("Erro ao registrar a atualização:", err);
      setErro("Não foi possível registrar. Confira se as regras do Firestore foram publicadas e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#e4dafc] bg-[#faf7ff] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#5b21b6]">
        <MessageSquare size={14} />
        Atualizações da tarefa
      </p>
      <ul className="mb-2.5 max-h-56 space-y-2 overflow-y-auto">
        {loading && <li className="text-[12px] text-brand-faint">Carregando…</li>}
        {!loading && comentarios.length === 0 && (
          <li className="text-[12px] text-brand-faint">Nenhuma atualização ainda. Registre o andamento, uma pendência ou um pagamento.</li>
        )}
        {comentarios.map((c) => {
          const meu = c.usuarioId === ator.uid;
          return (
            <li key={c.id} className={`rounded-lg px-3 py-2 text-[12.5px] ${meu ? "ml-6 bg-white" : "mr-6 bg-[#f1ebff]"}`}>
              <p className="mb-0.5 text-[11px] text-brand-faint">
                <strong className="text-brand-navy-2">{meu ? "Você" : c.usuarioNome}</strong> · {dataHora(c.criadoEm)}
              </p>
              <p className="whitespace-pre-wrap text-brand-navy-2">{c.texto}</p>
            </li>
          );
        })}
      </ul>
      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void enviar();
            }
          }}
          maxLength={2000}
          placeholder="Registrar uma atualização (Ctrl+Enter envia)…"
          className="min-w-0 flex-1"
        />
        <Button type="button" disabled={enviando || !texto.trim()} onClick={() => void enviar()} className="shrink-0">
          <Send size={14} />
          {enviando ? "Enviando..." : "Registrar"}
        </Button>
      </div>
      {erro && <p className="mt-1.5 text-[12px] font-semibold text-red-600">{erro}</p>}
    </div>
  );
}
