"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { useAuth } from "@/contexts/AuthContext";
import { registrarPagamento } from "@/lib/fechamentoNfDb";
import { MENSAGEM_ERRO_ARQUIVO, TAMANHO_MAXIMO_BYTES } from "@/lib/arquivosFechamento";
import { FORMAS_PAGAMENTO, totalPago } from "@/lib/fechamentoNf";
import type { FechamentoParceiro, FormaPagamento } from "@/types";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Registro de um pagamento: valor, data, forma (TED, boleto ou cheque), referência e comprovante (opcional). */
export function RegistrarPagamentoModal({ f, onFechar }: { f: FechamentoParceiro; onFechar: () => void }) {
  const { usuario } = useAuth();
  const restante = Math.max(0, Math.round((f.valor - totalPago(f)) * 100) / 100);
  const [valor, setValor] = useState(String(restante || f.valor));
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState<FormaPagamento>("TED");
  const [referencia, setReferencia] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || !data) {
      setErro("Informe o valor e a data do pagamento.");
      return;
    }
    if (comprovante && comprovante.size > TAMANHO_MAXIMO_BYTES) {
      setErro("O comprovante passa de 3 MB.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await registrarPagamento({
        fechamento: f,
        dados: { valor: v, data, forma, referencia },
        comprovante,
        ator: { uid: usuario.uid, nomeCompleto: usuario.nomeCompleto },
      });
      onFechar();
    } catch (err) {
      console.error("Erro ao registrar o pagamento:", err);
      setErro(comprovante ? MENSAGEM_ERRO_ARQUIVO : "Não foi possível registrar o pagamento. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open onClose={onFechar} title={`Registrar pagamento — ${f.parceiraNome}`}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-[13px] text-brand-muted">
          Valor calculado do fechamento: <strong className="text-brand-navy-2">{moeda(f.valor)}</strong> · já pago:{" "}
          <strong className="text-brand-navy-2">{moeda(totalPago(f))}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Valor pago (R$)">
            <Input type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </FormRow>
          <FormRow label="Data do pagamento">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </FormRow>
          <FormRow label="Forma">
            <Select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              {FORMAS_PAGAMENTO.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Referência do comprovante">
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Nº do TED, boleto ou cheque" />
          </FormRow>
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-brand-navy-2">Comprovante (opcional)</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            className="block w-full text-[12.5px] text-brand-muted file:mr-3 file:rounded-[8px] file:border file:border-brand-border file:bg-white file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-brand-navy-2"
          />
        </div>
        {erro && <p className="text-[12.5px] font-semibold text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Registrar pagamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
