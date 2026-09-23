"use client";

import { useState } from "react";
import { History, Upload } from "lucide-react";
import { orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { ImportarCronogramaModal } from "@/components/importacao/ImportarCronogramaModal";
import { HistoricoCronogramaModal } from "@/components/projetos/HistoricoCronogramaModal";
import type { Projeto, Recurso } from "@/types";

/** Quem atualiza o cronograma: administrador, coordenador e o consultor alocado no projeto (não finalizado). */
export function podeImportarCronograma(
  usuario: { perfil: string; recursoId?: string | null } | null,
  projeto: Pick<Projeto, "consultorIds" | "status">
): boolean {
  if (!usuario) return false;
  if (usuario.perfil === "administrador" || usuario.perfil === "coordenador") return true;
  return (
    usuario.perfil === "consultor" &&
    !!usuario.recursoId &&
    (projeto.consultorIds ?? []).includes(usuario.recursoId) &&
    (projeto.status ?? "ativo") === "ativo"
  );
}

/** Par de botões padrão: importar nova versão (à esquerda) e ver o histórico. */
export function BotoesCronograma({
  podeImportar,
  mostrarHistorico,
  onImportar,
  onHistorico,
}: {
  podeImportar: boolean;
  mostrarHistorico: boolean;
  onImportar: () => void;
  onHistorico: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {podeImportar && (
        <Button type="button" onClick={onImportar} className="h-9 px-3.5 text-[13px]">
          <Upload size={15} />
          Importar nova versão
        </Button>
      )}
      {mostrarHistorico && (
        <Button type="button" variant="secondary" onClick={onHistorico} className="h-9 px-3.5 text-[13px]">
          <History size={15} />
          Histórico do cronograma
        </Button>
      )}
    </div>
  );
}

/** Bloco "Cronograma" do detalhe do projeto: versão atual + importar/histórico (com os modais). */
export function CronogramaAcoes({ projeto, recursos }: { projeto: Projeto; recursos: Recurso[] }) {
  const { usuario } = useAuth();
  const [importando, setImportando] = useState(false);
  const [historico, setHistorico] = useState(false);
  const podeImportar = podeImportarCronograma(usuario, projeto);
  const { data: todosProjetos } = useCollection<Projeto>("projetos", [orderBy("createdAt", "asc")], importando, [importando]);

  if (!podeImportar && !projeto.cronogramaVersao) return null;

  return (
    <div className="mb-5.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-white p-3.5 shadow-[0_8px_20px_rgba(21,40,73,0.05)]">
      <div>
        <p className="text-sm font-extrabold text-brand-navy-2">Cronograma</p>
        <p className="text-[12px] text-brand-faint">
          {projeto.cronogramaVersao ? `Versão atual: v${projeto.cronogramaVersao}` : "Nenhuma versão importada ainda"}
        </p>
      </div>
      <BotoesCronograma
        podeImportar={podeImportar}
        mostrarHistorico
        onImportar={() => setImportando(true)}
        onHistorico={() => setHistorico(true)}
      />
      {historico && (
        <HistoricoCronogramaModal
          open
          projeto={projeto}
          recursos={recursos}
          onClose={() => setHistorico(false)}
        />
      )}
      {podeImportar && (
        <ImportarCronogramaModal
          open={importando}
          projeto={projeto}
          recursos={recursos}
          outrosProjetos={todosProjetos.filter((p) => p.id !== projeto.id)}
          onClose={() => setImportando(false)}
          onImportado={() => {}}
        />
      )}
    </div>
  );
}
