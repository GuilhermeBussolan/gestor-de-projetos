"use client";

import { useRouter } from "next/navigation";
import { useCollection } from "@/lib/useCollection";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { calcularPercentualProjeto, corFaixaProgresso } from "@/lib/dashboardCalc";
import { nomeExibicaoCliente } from "@/lib/cliente";
import type { Cliente, Projeto } from "@/types";

function DashboardPageContent() {
  const { data: projetos } = useCollection<Projeto>("projetos");
  const { data: clientes } = useCollection<Cliente>("clientes");
  const router = useRouter();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projetos.map((p) => {
          const cliente = clientes.find((c) => c.id === p.clienteId);
          const percentual = calcularPercentualProjeto(p.documentos);
          const cor = corFaixaProgresso(percentual);
          return (
            <button
              key={p.id}
              onClick={() => router.push(`/projetos?projetoId=${p.id}`)}
              className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="mb-1 font-semibold text-slate-900">{nomeExibicaoCliente(cliente)}</p>
              <p className="mb-3 text-xs text-slate-500">
                {p.codigoProposta} · {p.modulo} · {p.tipoAtendimento} · {p.documentos.length}{" "}
                documento(s)
              </p>
              <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percentual}%`, backgroundColor: cor }}
                />
              </div>
              <p className="text-sm font-semibold" style={{ color: cor }}>
                {percentual}%
              </p>
            </button>
          );
        })}
        {projetos.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
            Nenhum projeto cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedPage perfis={["administrador", "coordenador"]}>
      <DashboardPageContent />
    </ProtectedPage>
  );
}
