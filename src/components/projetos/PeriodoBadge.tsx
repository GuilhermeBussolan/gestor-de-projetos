import { formatarPeriodoProjeto } from "@/lib/projeto";

export function PeriodoBadge({
  dataInicio,
  dataFim,
  className = "",
}: {
  dataInicio?: string | null;
  dataFim?: string | null;
  className?: string;
}) {
  const periodo = formatarPeriodoProjeto(dataInicio, dataFim);
  if (!periodo) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span className="rounded-full bg-brand-hover px-1.5 py-[1px] font-bold text-brand-faint">
          Sem data de início
        </span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {periodo.inicio} –{" "}
      {periodo.fim ? (
        periodo.fim
      ) : (
        <span className="rounded-full bg-[#fff2de] px-1.5 py-[1px] font-bold text-[#a4650d]">
          Em andamento
        </span>
      )}
    </span>
  );
}
