"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

/** Valor usado para ordenar uma coluna: texto (A–Z, sem diferenciar acento/maiúscula), número ou data ISO. */
export type ValorOrdenacao = string | number | null | undefined;

export interface EstadoOrdenacao<K extends string> {
  chave: K | null;
  asc: boolean;
}

const comparador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function comparar(a: ValorOrdenacao, b: ValorOrdenacao): number {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  // Vazios sempre no fim, em qualquer direção.
  if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return comparador.compare(String(a), String(b));
}

/**
 * Ordenação de tabela por clique no cabeçalho: 1º clique = crescente (A→Z, menor→maior), 2º = decrescente, 3º = volta
 * à ordem original da tela. `colunas` diz, para cada chave, de onde vem o valor de cada linha.
 */
export function useOrdenacao<T, K extends string>(
  itens: T[],
  colunas: Record<K, (item: T) => ValorOrdenacao>,
  inicial: EstadoOrdenacao<K> = { chave: null, asc: true }
) {
  const [ordem, setOrdem] = useState<EstadoOrdenacao<K>>(inicial);

  function ordenar(chave: K) {
    setOrdem((o) => (o.chave !== chave ? { chave, asc: true } : o.asc ? { chave, asc: false } : { chave: null, asc: true }));
  }

  const chave = ordem.chave;
  const ordenados =
    chave === null
      ? itens
      : [...itens].sort((x, y) => {
          const r = comparar(colunas[chave](x), colunas[chave](y));
          const vazio = (v: ValorOrdenacao) => v === null || v === undefined || v === "";
          // Mantém vazios no fim também na ordem decrescente.
          if (vazio(colunas[chave](x)) || vazio(colunas[chave](y))) return r;
          return ordem.asc ? r : -r;
        });

  return { ordenados, ordem, ordenar };
}

/** Cabeçalho de coluna clicável (use dentro de <tr>). Mostra a seta da direção atual. */
export function ThOrdenavel<K extends string>({
  chave,
  ordem,
  onOrdenar,
  className = "",
  alinhar = "esquerda",
  rowSpan,
  title,
  children,
}: {
  chave: K;
  ordem: EstadoOrdenacao<K>;
  onOrdenar: (chave: K) => void;
  className?: string;
  alinhar?: "esquerda" | "direita";
  /** Para cabeçalhos de duas linhas (ex.: faixa de anos em cima dos meses). */
  rowSpan?: number;
  /** Dica ao passar o mouse sobre o nome da coluna. */
  title?: string;
  children: React.ReactNode;
}) {
  const ativa = ordem.chave === chave;
  const Icone = !ativa ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown;
  return (
    <th className={className} rowSpan={rowSpan} aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onOrdenar(chave)}
        title={`${title ? `${title} — ` : ""}Clique para ordenar (de novo inverte; na terceira volta ao normal)`}
        className={`inline-flex items-center gap-1 font-[inherit] tracking-[inherit] [text-transform:inherit] transition-colors ${
          alinhar === "direita" ? "flex-row-reverse" : ""
        } ${ativa ? "text-brand-navy-2" : "hover:text-brand-navy-2"}`}
      >
        {children}
        <Icone size={11} className={ativa ? "text-brand-accent" : "opacity-40"} />
      </button>
    </th>
  );
}
