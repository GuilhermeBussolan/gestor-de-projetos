"use client";

import { FormRow, Input, Select, Textarea } from "@/components/ui/Field";
import { FORMAS_RECEBIMENTO, type DadosRecebimento, type FormaRecebimento } from "@/types";

export const RECEBIMENTO_VAZIO: DadosRecebimento = {
  forma: "PIX",
  titular: "",
  documentoTitular: "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "corrente",
  chavePix: "",
  linhaDigitavel: "",
  observacoes: "",
};

/** Confere os campos obrigatórios de cada forma; devolve a mensagem de erro ou "" quando está tudo certo. */
export function validarRecebimento(r: DadosRecebimento): string {
  if (!r.titular.trim() || !r.documentoTitular.trim()) return "Informe o titular/favorecido e o CPF ou CNPJ dele.";
  if (r.forma === "PIX" && !r.chavePix?.trim()) return "Informe a chave PIX.";
  if (r.forma === "Depósito/TED" && (!r.banco?.trim() || !r.agencia?.trim() || !r.conta?.trim()))
    return "Informe banco, agência e conta para o depósito.";
  if (r.forma === "Boleto" && !r.linhaDigitavel?.trim()) return "Informe a linha digitável do boleto.";
  return "";
}

/** Grava só o que vale para a forma escolhida (não guarda uma conta antiga quando a forma é PIX, por exemplo). */
export function limparRecebimento(r: DadosRecebimento): DadosRecebimento {
  const base: DadosRecebimento = {
    forma: r.forma,
    titular: r.titular.trim(),
    documentoTitular: r.documentoTitular.trim(),
    observacoes: r.observacoes?.trim() || null,
  };
  if (r.forma === "PIX") return { ...base, chavePix: r.chavePix?.trim() || null };
  if (r.forma === "Boleto") return { ...base, linhaDigitavel: r.linhaDigitavel?.trim() || null };
  return {
    ...base,
    banco: r.banco?.trim() || null,
    agencia: r.agencia?.trim() || null,
    conta: r.conta?.trim() || null,
    tipoConta: r.tipoConta ?? "corrente",
  };
}

/** Formulário "Dados para recebimento" (forma + titular + campos da forma). */
export function DadosRecebimentoFields({ valor, onChange }: { valor: DadosRecebimento; onChange: (v: DadosRecebimento) => void }) {
  const set = <K extends keyof DadosRecebimento>(campo: K, v: DadosRecebimento[K]) => onChange({ ...valor, [campo]: v });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FormRow label="Forma de recebimento">
        <Select value={valor.forma} onChange={(e) => set("forma", e.target.value as FormaRecebimento)}>
          {FORMAS_RECEBIMENTO.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Titular / favorecido">
        <Input value={valor.titular} onChange={(e) => set("titular", e.target.value)} required />
      </FormRow>
      <FormRow label="CPF ou CNPJ do titular">
        <Input value={valor.documentoTitular} onChange={(e) => set("documentoTitular", e.target.value)} required />
      </FormRow>

      {valor.forma === "PIX" && (
        <div className="sm:col-span-3">
          <FormRow label="Chave PIX">
            <Input value={valor.chavePix ?? ""} onChange={(e) => set("chavePix", e.target.value)} placeholder="CNPJ, e-mail, telefone ou chave aleatória" required />
          </FormRow>
        </div>
      )}
      {valor.forma === "Depósito/TED" && (
        <>
          <FormRow label="Banco">
            <Input value={valor.banco ?? ""} onChange={(e) => set("banco", e.target.value)} placeholder="Ex.: 341 - Itaú" required />
          </FormRow>
          <FormRow label="Agência">
            <Input value={valor.agencia ?? ""} onChange={(e) => set("agencia", e.target.value)} required />
          </FormRow>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <FormRow label="Conta">
              <Input value={valor.conta ?? ""} onChange={(e) => set("conta", e.target.value)} placeholder="Com dígito" required />
            </FormRow>
            <FormRow label="Tipo">
              <Select value={valor.tipoConta ?? "corrente"} onChange={(e) => set("tipoConta", e.target.value as "corrente" | "poupanca")}>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </Select>
            </FormRow>
          </div>
        </>
      )}
      {valor.forma === "Boleto" && (
        <div className="sm:col-span-3">
          <FormRow label="Linha digitável do boleto">
            <Input value={valor.linhaDigitavel ?? ""} onChange={(e) => set("linhaDigitavel", e.target.value)} required />
          </FormRow>
        </div>
      )}
      <div className="sm:col-span-3">
        <FormRow label="Observações para o pagamento (opcional)">
          <Textarea rows={2} value={valor.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} />
        </FormRow>
      </div>
    </div>
  );
}

/** Exibição (só leitura) dos dados de recebimento. */
export function ResumoRecebimento({ r }: { r: DadosRecebimento }) {
  const linhas: [string, string][] = [["Forma", r.forma], ["Favorecido", `${r.titular} · ${r.documentoTitular}`]];
  if (r.forma === "PIX" && r.chavePix) linhas.push(["Chave PIX", r.chavePix]);
  if (r.forma === "Depósito/TED")
    linhas.push(["Conta", `${r.banco ?? "—"} · ag. ${r.agencia ?? "—"} · ${r.tipoConta === "poupanca" ? "poupança" : "c/c"} ${r.conta ?? "—"}`]);
  if (r.forma === "Boleto" && r.linhaDigitavel) linhas.push(["Linha digitável", r.linhaDigitavel]);
  if (r.observacoes) linhas.push(["Observações", r.observacoes]);
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="contents">
          <dt className="text-brand-faint">{rotulo}</dt>
          <dd className="break-words text-brand-navy-2">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
