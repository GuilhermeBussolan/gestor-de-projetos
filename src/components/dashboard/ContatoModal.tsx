"use client";

import { useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import { useCollection } from "@/lib/useCollection";
import { useAuth } from "@/contexts/AuthContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CampoMencao } from "@/components/timeline/CampoMencao";
import { RegistroItem } from "@/components/timeline/RegistroItem";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { TIPO_REGISTRO_CONFIG, TIPO_REGISTRO_ORDEM } from "@/lib/constants";
import { darCiencia, registrarContato } from "@/lib/contato";
import { cienciasPorRegistro, mencionadosPresentes } from "@/lib/mencoes";
import { usePessoasMencionaveis } from "@/lib/usePessoasMencionaveis";
import type { Cliente, ContatoProjeto, Mencionado, Projeto, TipoRegistro } from "@/types";

type FiltroTempo = "todos" | "problema" | "decisao";

function ContatoForm({ projeto, cliente }: { projeto: Projeto; cliente: Cliente | undefined }) {
  const { usuario } = useAuth();
  const { data: contatos, loading } = useCollection<ContatoProjeto>(
    `projetos/${projeto.id}/contatos`,
    [orderBy("criadoEm", "desc")]
  );
  const { pessoas, erroLista } = usePessoasMencionaveis(projeto, usuario);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoRegistro>("atualizacao");
  const [mencionados, setMencionados] = useState<Mencionado[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<FiltroTempo>("todos");

  const projetoNome = `${nomeExibicaoCliente(cliente)} — ${projeto.codigoProposta}`;
  const ciencias = useMemo(() => cienciasPorRegistro(contatos), [contatos]);
  const exibidos = useMemo(
    () => (filtro === "todos" ? contatos : contatos.filter((c) => (c.tipo ?? "atualizacao") === filtro)),
    [contatos, filtro]
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !texto.trim()) return;
    setErro("");
    setSalvando(true);
    try {
      await registrarContato(projeto.id, texto.trim(), usuario, {
        tipo,
        mencionados: mencionadosPresentes(texto, mencionados),
        projetoNome,
      });
      setTexto("");
      setTipo("atualizacao");
      setMencionados([]);
    } catch (err) {
      console.error("Erro ao registrar atualização:", err);
      setErro(
        mencionadosPresentes(texto, mencionados).length > 0
          ? "Não foi possível registrar. Se você marcou alguém, confirme que as regras do Firestore foram publicadas."
          : "Não foi possível registrar. Tente de novo."
      );
    } finally {
      setSalvando(false);
    }
  }

  const contagem = (t: FiltroTempo) =>
    t === "todos" ? contatos.length : contatos.filter((c) => (c.tipo ?? "atualizacao") === t).length;

  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {TIPO_REGISTRO_ORDEM.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold ring-2 transition-all ${
                tipo === t ? "ring-brand-accent" : "opacity-55 ring-transparent hover:opacity-90"
              }`}
              style={{ backgroundColor: TIPO_REGISTRO_CONFIG[t].bg, color: TIPO_REGISTRO_CONFIG[t].text }}
            >
              {TIPO_REGISTRO_CONFIG[t].label}
            </button>
          ))}
        </div>
        <CampoMencao
          value={texto}
          onChange={setTexto}
          pessoas={pessoas}
          erroLista={erroLista}
          mencionados={mencionados}
          onMencionadosChange={setMencionados}
          placeholder={
            tipo === "problema"
              ? "Qual foi o problema? Marque com @ quem precisa saber."
              : "Qual foi a atualização? Use @ para marcar alguém."
          }
        />
        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={salvando || !texto.trim()}>
            {salvando ? "Registrando..." : `Registrar ${TIPO_REGISTRO_CONFIG[tipo].label.toLowerCase()}`}
          </Button>
        </div>
      </form>

      <div className="border-t border-brand-border-soft pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[.08em] text-brand-faint">
            Linha do tempo — {nomeExibicaoCliente(cliente)}
          </p>
          <div className="flex gap-1">
            {(["todos", "problema", "decisao"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  filtro === f ? "bg-brand-navy-2 text-white" : "bg-brand-hover text-brand-muted hover:bg-brand-accent-soft"
                }`}
              >
                {f === "todos" ? "Todos" : f === "problema" ? "Problemas" : "Decisões"} ({contagem(f)})
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-96 space-y-4 overflow-y-auto border-l-2 border-brand-border pl-4">
          {exibidos.map((c) => {
            const cor = TIPO_REGISTRO_CONFIG[c.tipo ?? "atualizacao"];
            return (
              <div key={c.id} className="relative">
                <span
                  className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full border-2 border-white"
                  style={{ backgroundColor: c.tipo && c.tipo !== "atualizacao" ? cor.text : "#2f6fe4" }}
                />
                <RegistroItem
                  registro={c}
                  ciencias={ciencias.get(c.id)}
                  meuUid={usuario?.uid}
                  onDarCiencia={usuario ? (r) => darCiencia(projeto.id, projetoNome, r, usuario) : undefined}
                />
              </div>
            );
          })}
          {!loading && exibidos.length === 0 && (
            <p className="text-sm text-brand-faint">
              {contatos.length === 0 ? "Nenhuma atualização registrada ainda." : "Nada neste filtro."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContatoModal({
  projeto,
  cliente,
  onClose,
}: {
  projeto: Projeto | null;
  cliente: Cliente | undefined;
  onClose: () => void;
}) {
  return (
    <Modal open={!!projeto} onClose={onClose} title="Linha do tempo do projeto" wide>
      {projeto && <ContatoForm key={projeto.id} projeto={projeto} cliente={cliente} />}
    </Modal>
  );
}
