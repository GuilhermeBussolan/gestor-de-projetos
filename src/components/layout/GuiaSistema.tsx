"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { GuiaPrevia } from "@/components/layout/GuiaPrevias";
import { FLUXO_GERAL, GUIA_POR_PERFIL, type ModuloGuia } from "@/lib/guiaSistema";
import type { Perfil } from "@/types";

type Tela = { tipo: "boasvindas" } | { tipo: "hub" } | { tipo: "modulo"; moduloId: string; func: number };

const PERFIL_FLUXO: Record<Perfil, string> = {
  administrador: "Administrador",
  coordenador: "Coordenador",
  consultor: "Consultor",
  financeiro: "Financeiro",
};

const chaveFunc = (moduloId: string, i: number) => `${moduloId}:${i}`;

/** Guia interativo do sistema: boas-vindas, hub de módulos e funcionalidades com prévia visual. */
export function GuiaSistema({
  open,
  perfil,
  onClose,
}: {
  open: boolean;
  perfil: Perfil;
  onClose: () => void;
}) {
  const router = useRouter();
  const guia = GUIA_POR_PERFIL[perfil];
  const [tela, setTela] = useState<Tela>({ tipo: "boasvindas" });
  const [vistas, setVistas] = useState<Set<string>>(new Set());

  const moduloExplorado = (m: ModuloGuia) => m.funcionalidades.every((_, i) => vistas.has(chaveFunc(m.id, i)));
  const totalExplorados = guia.modulos.filter(moduloExplorado).length;

  function fechar() {
    setTela({ tipo: "hub" });
    onClose();
  }

  function abrirModulo(m: ModuloGuia, func = 0) {
    setVistas((v) => new Set(v).add(chaveFunc(m.id, func)));
    setTela({ tipo: "modulo", moduloId: m.id, func });
  }

  function irParaTela(href: string) {
    fechar();
    router.push(href);
  }

  function conteudo() {
    if (tela.tipo === "boasvindas") return telaBoasVindas();
    if (tela.tipo === "hub") return telaHub();
    const modulo = guia.modulos.find((m) => m.id === tela.moduloId);
    return modulo ? telaModulo(modulo, tela.func) : telaHub();
  }

  function telaBoasVindas() {
    return (
      <div>
        <h3 className="text-xl font-extrabold tracking-[-0.01em] text-brand-navy-2">Bem-vindo ao Gestor de Projetos</h3>
        <p className="mt-1.5 text-sm text-brand-muted">{guia.boasVindas}</p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-4">
          {FLUXO_GERAL.map((etapa, i) => {
            const meu = etapa.quem === PERFIL_FLUXO[perfil];
            return (
              <div
                key={etapa.quem}
                className={`relative rounded-xl border p-3.5 ${
                  meu ? "border-brand-accent bg-brand-accent-soft/60" : "border-brand-border bg-white"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy-2 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-2 text-[13px] font-bold text-brand-navy-2">{etapa.quem}</p>
                <p className="mt-1 text-[12px] leading-snug text-brand-muted">{etapa.o_que}</p>
                {meu && (
                  <span className="mt-2 inline-block rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-bold text-white">
                    Você
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-brand-border-soft pt-4">
          <button type="button" onClick={fechar} className="text-[12.5px] font-semibold text-brand-faint hover:text-brand-muted">
            Pular guia
          </button>
          <Button onClick={() => setTela({ tipo: "hub" })}>
            Explorar os módulos <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    );
  }

  function telaHub() {
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold tracking-[-0.01em] text-brand-navy-2">O que você quer conhecer?</h3>
            <p className="mt-1 text-sm text-brand-muted">Clique em um módulo para ver o que ele faz.</p>
          </div>
          <p className="text-[12px] font-semibold text-brand-faint">
            {totalExplorados} de {guia.modulos.length} explorados
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-border">
          <div
            className="h-full rounded-full bg-brand-accent transition-all"
            style={{ width: `${(totalExplorados / guia.modulos.length) * 100}%` }}
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guia.modulos.map((m) => {
            const Icone = m.icone;
            const explorado = moduloExplorado(m);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => abrirModulo(m)}
                className="group relative flex flex-col items-start justify-start rounded-2xl border border-brand-border bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-accent hover:shadow-card-lg"
              >
                {explorado && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#15754c] text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent-soft text-brand-accent group-hover:bg-brand-accent group-hover:text-white">
                  <Icone size={22} />
                </span>
                <p className="mt-3 text-[14px] font-bold text-brand-navy-2">{m.titulo}</p>
                <p className="mt-1 text-[12px] leading-snug text-brand-muted">{m.resumo}</p>
                <p className="mt-2.5 text-[11px] font-semibold text-brand-accent">
                  {m.funcionalidades.length} funcionalidades
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-brand-border-soft pt-4">
          <button
            type="button"
            onClick={() => setTela({ tipo: "boasvindas" })}
            className="text-[12.5px] font-semibold text-brand-accent hover:underline"
          >
            Rever o fluxo entre os perfis
          </button>
          <Button onClick={fechar}>{totalExplorados === guia.modulos.length ? "Concluir" : "Fechar"}</Button>
        </div>
      </div>
    );
  }

  function telaModulo(modulo: ModuloGuia, func: number) {
    const Icone = modulo.icone;
    const atual = modulo.funcionalidades[func];
    const ultima = func === modulo.funcionalidades.length - 1;
    return (
      <div>
        <button
          type="button"
          onClick={() => setTela({ tipo: "hub" })}
          className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-accent hover:underline"
        >
          <ArrowLeft size={14} /> Todos os módulos
        </button>

        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent text-white">
            <Icone size={22} />
          </span>
          <div>
            <h3 className="text-lg font-extrabold tracking-[-0.01em] text-brand-navy-2">{modulo.titulo}</h3>
            <p className="text-sm text-brand-muted">{modulo.resumo}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[230px_1fr]">
          <div className="space-y-1.5">
            {modulo.funcionalidades.map((f, i) => {
              const ativa = i === func;
              const vista = vistas.has(chaveFunc(modulo.id, i));
              return (
                <button
                  key={f.titulo}
                  type="button"
                  onClick={() => abrirModulo(modulo, i)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold transition-colors ${
                    ativa ? "bg-brand-navy-2 text-white" : "bg-brand-hover text-brand-navy-2 hover:bg-brand-accent-soft"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      ativa ? "bg-white/20" : vista ? "bg-[#15754c] text-white" : "bg-white text-brand-faint"
                    }`}
                  >
                    {vista && !ativa ? <Check size={11} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="leading-snug">{f.titulo}</span>
                </button>
              );
            })}
          </div>

          <div key={`${modulo.id}-${func}`}>
            <GuiaPrevia id={atual.previa} />
            <h4 className="mt-4 text-[15px] font-bold text-brand-navy-2">{atual.titulo}</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-muted">{atual.descricao}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border-soft pt-4">
          <button
            type="button"
            onClick={() => irParaTela(modulo.href)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
          >
            {modulo.hrefLabel} <ArrowRight size={15} />
          </button>
          {ultima ? (
            <Button onClick={() => setTela({ tipo: "hub" })}>Concluir módulo</Button>
          ) : (
            <Button onClick={() => abrirModulo(modulo, func + 1)}>
              Próxima funcionalidade <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={fechar} title="Guia do sistema" extraWide>
      {conteudo()}
    </Modal>
  );
}
