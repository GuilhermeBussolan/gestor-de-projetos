"use client";

import { FormRow, Select } from "@/components/ui/Field";
import {
  SISTEMAS_ERP,
  SISTEMAS_ESOCIAL,
  SISTEMAS_ESTOQUE,
  type DetalhesQRH,
  type SistemaErp,
  type SistemaEsocial,
  type SistemaEstoque,
} from "@/types";

/** Sistemas do cliente que só interessam ao módulo de atendimento QRH: folha, estoque e e-Social. */
export function QrhFields({
  valor,
  onChange,
}: {
  valor: DetalhesQRH;
  onChange: (valor: DetalhesQRH) => void;
}) {
  return (
    <div className="rounded-md border border-brand-border p-3">
      <p className="mb-2 text-sm font-medium text-brand-navy-2">Módulo QRH — sistemas do cliente</p>
      <div className="grid grid-cols-3 gap-3">
        <FormRow label="Folha">
          <Select
            value={valor.folha ?? ""}
            onChange={(e) => onChange({ ...valor, folha: (e.target.value || null) as SistemaErp | null })}
          >
            <option value="">Selecione...</option>
            {SISTEMAS_ERP.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Estoque">
          <Select
            value={valor.estoque ?? ""}
            onChange={(e) => onChange({ ...valor, estoque: (e.target.value || null) as SistemaEstoque | null })}
          >
            <option value="">Selecione...</option>
            {SISTEMAS_ESTOQUE.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="e-Social">
          <Select
            value={valor.esocial ?? ""}
            onChange={(e) => onChange({ ...valor, esocial: (e.target.value || null) as SistemaEsocial | null })}
          >
            <option value="">Selecione...</option>
            {SISTEMAS_ESOCIAL.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>
    </div>
  );
}
