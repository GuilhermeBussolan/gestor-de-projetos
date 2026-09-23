/** Bolinha vermelha com uma contagem (pendências). Não renderiza nada quando a contagem é zero. */
export function BolinhaContagem({
  quantidade,
  titulo,
  className = "",
}: {
  quantidade: number;
  titulo?: string;
  className?: string;
}) {
  if (quantidade <= 0) return null;
  return (
    <span
      title={titulo}
      className={`inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#e0543c] px-1 text-[10px] leading-none font-bold text-white ${className}`}
    >
      {quantidade > 99 ? "99+" : quantidade}
    </span>
  );
}
