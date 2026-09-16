"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { TIPO_FATURAMENTO_CONFIG, TIPO_FATURAMENTO_ORDEM } from "@/lib/constants";
import type { Financeiro, TipoDocumento, TipoFaturamento } from "@/types";

export interface FinanceiroFieldsHandle {
  obterFinanceiro(): Financeiro;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface MarcoLinha {
  tipoDocumentoId: string; // "" = manual
  descricao: string;
  valor: string;
}

export const FinanceiroFields = forwardRef<
  FinanceiroFieldsHandle,
  { financeiroInicial?: Financeiro; tiposDocumento: TipoDocumento[] }
>(function FinanceiroFields({ financeiroInicial, tiposDocumento }, ref) {
  // Projetos criados antes do campo tipoFaturamento existir não têm esse valor salvo —
  // tratamos como "parcelado" (comportamento padrão anterior) para carregar os dados certos.
  const tipoInicial: TipoFaturamento = financeiroInicial?.tipoFaturamento ?? "parcelado";

  const [tipoFaturamento, setTipoFaturamento] = useState<TipoFaturamento>(tipoInicial);
  const [valorTotal, setValorTotal] = useState(
    tipoInicial === "parcelado" && financeiroInicial?.valorTotal
      ? String(financeiroInicial.valorTotal)
      : ""
  );
  const [numeroParcelas, setNumeroParcelas] = useState(
    tipoInicial === "parcelado" && financeiroInicial?.numeroParcelas
      ? String(financeiroInicial.numeroParcelas)
      : ""
  );
  const [marcos, setMarcos] = useState<MarcoLinha[]>(
    tipoInicial === "marco_faturamento" && (financeiroInicial?.parcelas.length ?? 0) > 0
      ? financeiroInicial!.parcelas.map((p) => ({
          tipoDocumentoId: p.tipoDocumentoId ?? "",
          descricao: p.descricao ?? "",
          valor: String(p.valor),
        }))
      : [{ tipoDocumentoId: "", descricao: "", valor: "" }]
  );

  const valorTotalNumero = Number(valorTotal) || 0;
  const numeroParcelasNumero = Math.max(1, Number(numeroParcelas) || 1);
  const totalMarcos = marcos.reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

  function adicionarMarco() {
    setMarcos((prev) => [...prev, { tipoDocumentoId: "", descricao: "", valor: "" }]);
  }

  function removerMarco(index: number) {
    setMarcos((prev) => prev.filter((_, i) => i !== index));
  }

  function atualizarMarco(index: number, campo: "descricao" | "valor", valor: string) {
    setMarcos((prev) => prev.map((m, i) => (i === index ? { ...m, [campo]: valor } : m)));
  }

  function selecionarDocumentoDoMarco(index: number, tipoDocumentoId: string) {
    setMarcos((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        if (!tipoDocumentoId) return { ...m, tipoDocumentoId: "" };
        const tipo = tiposDocumento.find((t) => t.id === tipoDocumentoId);
        return {
          ...m,
          tipoDocumentoId,
          descricao: tipo ? `${tipo.codigo} — ${tipo.descricao}` : m.descricao,
        };
      })
    );
  }

  useImperativeHandle(ref, () => ({
    obterFinanceiro(): Financeiro {
      if (tipoFaturamento === "apontamento_horas") {
        return { tipoFaturamento, valorTotal: 0, numeroParcelas: 0, parcelas: [] };
      }

      if (tipoFaturamento === "parcelado") {
        const valorParcela = Math.round((valorTotalNumero / numeroParcelasNumero) * 100) / 100;
        const parcelas = Array.from({ length: numeroParcelasNumero }, (_, i) => ({
          numero: i + 1,
          valor: valorParcela,
          status: "LIBERADO" as const,
        }));
        return {
          tipoFaturamento,
          valorTotal: valorTotalNumero,
          numeroParcelas: numeroParcelasNumero,
          parcelas,
        };
      }

      const marcosValidos = marcos.filter((m) => m.descricao.trim() || m.valor.trim());
      const parcelas = marcosValidos.map((m, i) => ({
        numero: i + 1,
        descricao: m.descricao,
        tipoDocumentoId: m.tipoDocumentoId || undefined,
        valor: Number(m.valor) || 0,
        status: "LIBERADO" as const,
      }));
      return {
        tipoFaturamento,
        valorTotal: parcelas.reduce((acc, p) => acc + p.valor, 0),
        numeroParcelas: parcelas.length,
        parcelas,
      };
    },
  }));

  return (
    <div className="rounded-md border border-brand-border bg-brand-hover p-4">
      <p className="mb-3 text-sm font-semibold text-brand-navy-2">Financeiro</p>

      <FormRow label="Tipo de faturamento">
        <Select
          value={tipoFaturamento}
          onChange={(e) => setTipoFaturamento(e.target.value as TipoFaturamento)}
        >
          {TIPO_FATURAMENTO_ORDEM.map((t) => (
            <option key={t} value={t}>
              {TIPO_FATURAMENTO_CONFIG[t].label}
            </option>
          ))}
        </Select>
      </FormRow>
      <p className="mt-1 text-xs text-brand-muted">
        {TIPO_FATURAMENTO_CONFIG[tipoFaturamento].descricao}
      </p>

      {tipoFaturamento === "parcelado" && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          <FormRow label="Valor total do projeto (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              required
            />
          </FormRow>
          <FormRow label="Número de parcelas">
            <Input
              type="number"
              min="1"
              placeholder="1"
              value={numeroParcelas}
              onChange={(e) => setNumeroParcelas(e.target.value)}
              required
            />
          </FormRow>
          <p className="col-span-2 text-xs text-brand-muted">
            {numeroParcelasNumero}x de {moeda(valorTotalNumero / numeroParcelasNumero)}
          </p>
        </div>
      )}

      {tipoFaturamento === "marco_faturamento" && (
        <div className="mt-3 space-y-2">
          {marcos.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-44 shrink-0">
                <Select
                  value={m.tipoDocumentoId}
                  onChange={(e) => selecionarDocumentoDoMarco(i, e.target.value)}
                >
                  <option value="">— Inclusão manual —</option>
                  {tiposDocumento.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.codigo} — {t.descricao}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Descrição do marco (ex: Kick-off)"
                  value={m.descricao}
                  onChange={(e) => atualizarMarco(i, "descricao", e.target.value)}
                  disabled={!!m.tipoDocumentoId}
                />
              </div>
              <div className="w-32 shrink-0">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={m.valor}
                  onChange={(e) => atualizarMarco(i, "valor", e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => removerMarco(i)}
                className="shrink-0 text-brand-faint hover:text-red-600"
                aria-label="Remover marco"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={adicionarMarco}
            className="text-sm font-medium text-brand-accent hover:underline"
          >
            + Adicionar marco
          </button>
          <p className="text-xs text-brand-muted">
            Total: {moeda(totalMarcos)} em {marcos.length} marco(s)
          </p>
        </div>
      )}
    </div>
  );
});
