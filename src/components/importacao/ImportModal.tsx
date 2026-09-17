"use client";

import { useRef, useState, type ReactNode } from "react";
import { Upload, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { lerArquivoTabular } from "@/lib/importarArquivo";

export interface LinhaValidada<T> {
  linha: number;
  ok: boolean;
  erros: string[];
  dados: T | null;
  resumo: string;
}

type Etapa = "escolher" | "processando" | "revisao" | "importando" | "concluido" | "erro";

export function ImportModal<T>({
  open,
  onClose,
  titulo,
  instrucoes,
  processarLinhas,
  onConfirmar,
  textoConfirmar = "Confirmar importação",
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  instrucoes: ReactNode;
  processarLinhas: (linhas: Awaited<ReturnType<typeof lerArquivoTabular>>) => Promise<LinhaValidada<T>[]> | LinhaValidada<T>[];
  onConfirmar: (validos: T[]) => Promise<void>;
  textoConfirmar?: string;
}) {
  const [etapa, setEtapa] = useState<Etapa>("escolher");
  const [linhas, setLinhas] = useState<LinhaValidada<T>[]>([]);
  const [erroGeral, setErroGeral] = useState("");
  const [resultado, setResultado] = useState<{ inseridos: number; ignorados: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validas = linhas.filter((l) => l.ok);
  const invalidas = linhas.filter((l) => !l.ok);

  function reiniciar() {
    setEtapa("escolher");
    setLinhas([]);
    setErroGeral("");
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fechar() {
    reiniciar();
    onClose();
  }

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEtapa("processando");
    setErroGeral("");
    try {
      const brutas = await lerArquivoTabular(file);
      if (brutas.length === 0) {
        setErroGeral("O arquivo não tem nenhuma linha de dados (só o cabeçalho, ou está vazio).");
        setEtapa("erro");
        return;
      }
      const processadas = await processarLinhas(brutas);
      setLinhas(processadas);
      setEtapa("revisao");
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      setEtapa("erro");
    }
  }

  async function confirmar() {
    setEtapa("importando");
    try {
      const dados = validas.map((l) => l.dados as T);
      await onConfirmar(dados);
      setResultado({ inseridos: dados.length, ignorados: invalidas.length });
      setEtapa("concluido");
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : "Erro ao importar os dados.");
      setEtapa("erro");
    }
  }

  return (
    <Modal open={open} onClose={fechar} title={titulo} wide>
      {etapa === "escolher" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-brand-hover p-4 text-[13px] text-brand-muted">
            {instrucoes}
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-brand-border bg-white p-8 text-center hover:border-brand-accent hover:bg-brand-accent-soft/30">
            <Upload size={22} className="text-brand-faint" />
            <span className="text-sm font-semibold text-brand-navy-2">
              Clique para escolher o arquivo (.csv ou .xlsx)
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xlsm"
              onChange={aoEscolherArquivo}
              className="hidden"
            />
          </label>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {etapa === "processando" && (
        <p className="py-10 text-center text-sm text-brand-muted">Lendo o arquivo...</p>
      )}

      {etapa === "erro" && (
        <div className="space-y-4">
          <p className="rounded-md bg-[#fdeceb] p-3 text-sm text-[#b5392a]">{erroGeral}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Fechar
            </Button>
            <Button type="button" onClick={reiniciar}>
              Tentar outro arquivo
            </Button>
          </div>
        </div>
      )}

      {etapa === "revisao" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-[#e3f5ea] px-3 py-1.5 text-[12.5px] font-bold text-[#15754c]">
              <CheckCircle2 size={14} /> {validas.length} prontos para importar
            </span>
            {invalidas.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#fdeceb] px-3 py-1.5 text-[12.5px] font-bold text-[#b5392a]">
                <XCircle size={14} /> {invalidas.length} com erro (serão ignorados)
              </span>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-brand-border">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-brand-hover text-left text-[10.5px] font-bold tracking-[.06em] text-brand-faint uppercase">
                  <th className="px-3 py-2.5">Linha</th>
                  <th className="px-3 py-2.5">Registro</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className="border-t border-brand-border-soft">
                    <td className="px-3 py-2 text-brand-faint">{l.linha}</td>
                    <td className="px-3 py-2 text-brand-navy-2">{l.resumo}</td>
                    <td className="px-3 py-2">
                      {l.ok ? (
                        <span className="flex items-center gap-1 font-semibold text-[#15754c]">
                          <CheckCircle2 size={13} /> OK
                        </span>
                      ) : (
                        <span className="flex items-start gap-1 font-semibold text-[#b5392a]">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                          {l.erros.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmar} disabled={validas.length === 0}>
              {textoConfirmar} ({validas.length})
            </Button>
          </div>
        </div>
      )}

      {etapa === "importando" && (
        <p className="py-10 text-center text-sm text-brand-muted">Importando...</p>
      )}

      {etapa === "concluido" && resultado && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#92D050]/40 bg-[#e3f5ea] p-5 text-center">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-[#15754c]" />
            <p className="font-bold text-[#15754c]">
              {resultado.inseridos} registro{resultado.inseridos === 1 ? "" : "s"} importado
              {resultado.inseridos === 1 ? "" : "s"} com sucesso
            </p>
            {resultado.ignorados > 0 && (
              <p className="mt-1 text-[12.5px] text-[#15754c]/80">
                {resultado.ignorados} linha{resultado.ignorados === 1 ? "" : "s"} ignorada
                {resultado.ignorados === 1 ? "" : "s"} por erro de validação.
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={fechar}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
