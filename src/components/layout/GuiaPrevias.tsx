"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Bell, Check, Minus, Upload } from "lucide-react";
import {
  ABA_STATUS_PROJETO_CONFIG,
  ABA_STATUS_PROJETO_ORDEM,
  STATUS_DOCUMENTO_CONFIG,
  STATUS_PARCELA_CONFIG,
  TERMOMETRO_CONFIG,
  TERMOMETRO_ORDEM,
  TIPO_BOX_CONFIG,
} from "@/lib/constants";
import { STATUS_HORA_CONFIG } from "@/lib/statusHora";
import type { StatusHora, Termometro } from "@/types";
import type { PreviaId } from "@/lib/guiaSistema";

/** Miniaturas ilustrativas do sistema. Dados fictícios: nada aqui lê ou grava no banco. */

function Moldura({ children, dica }: { children: ReactNode; dica?: string }) {
  return (
    <div>
      <div className="rounded-xl border border-brand-border bg-white p-4 shadow-card">{children}</div>
      {dica && <p className="mt-2 text-center text-[11.5px] text-brand-faint">{dica}</p>}
    </div>
  );
}

function Pilula({ bg, cor, children }: { bg: string; cor: string; children: ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: bg, color: cor }}>
      {children}
    </span>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold tracking-[.08em] text-brand-faint uppercase">{children}</p>;
}

function BotaoFalso({ children, escuro = false }: { children: ReactNode; escuro?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold ${
        escuro ? "bg-brand-accent text-white" : "border border-brand-border bg-white text-brand-navy-2"
      }`}
    >
      {children}
    </span>
  );
}

// ---------- Calendário ----------

function BotoesMT() {
  const [lancados, setLancados] = useState<("M" | "T")[]>([]);
  const alternar = (t: "M" | "T") =>
    setLancados((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  return (
    <Moldura dica="Clique em +M ou +T para testar">
      <div className="mx-auto w-52 rounded-lg border border-brand-border-soft bg-brand-hover/50 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-brand-navy-2">17</span>
          <div className="flex gap-1">
            {(["M", "T"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => alternar(t)}
                className="rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-brand-accent shadow-sm hover:bg-brand-accent hover:text-white"
              >
                +{t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 min-h-[54px] space-y-1">
          {lancados.includes("M") && (
            <div className="rounded-md bg-[#e8efff] px-2 py-1 text-[11px] font-semibold text-[#2456b8]">08:00–12:00 · Projeto</div>
          )}
          {lancados.includes("T") && (
            <div className="rounded-md bg-[#e8efff] px-2 py-1 text-[11px] font-semibold text-[#2456b8]">13:00–17:00 · Projeto</div>
          )}
          {lancados.length === 0 && <p className="pt-3 text-center text-[11px] text-brand-faint">Sem lançamentos</p>}
        </div>
      </div>
    </Moldura>
  );
}

function ConflitoHorario() {
  return (
    <Moldura>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between rounded-lg bg-brand-hover px-3 py-2 text-[12px] text-brand-navy-2">
          <span>Projeto A</span>
          <span className="font-bold">08:00–12:00</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-dashed border-brand-border px-3 py-2 text-[12px] text-brand-muted">
          <span>Novo lançamento no Projeto B</span>
          <span className="font-bold">10:00–13:00</span>
        </div>
        <p className="flex items-center gap-1.5 rounded-lg bg-[#fdeceb] px-3 py-2 text-[12px] font-medium text-[#b5392a]">
          <AlertTriangle size={14} className="shrink-0" />
          Já existe um apontamento para esse mesmo dia e horário.
        </p>
      </div>
    </Moldura>
  );
}

// ---------- Escopo ----------

const ITENS_ESCOPO = [
  { id: "1", texto: "1. Levantamento", filhos: ["1.1", "1.2"] },
  { id: "1.1", texto: "1.1 Reunião de kick-off", pai: "1" },
  { id: "1.2", texto: "1.2 Mapeamento de processos", pai: "1" },
  { id: "2", texto: "2. Configuração", filhos: ["2.1", "2.2"] },
  { id: "2.1", texto: "2.1 Parametrização", pai: "2" },
  { id: "2.2", texto: "2.2 Integrações", pai: "2" },
] as const;

function CaixaMarca({ estado }: { estado: "marcada" | "parcial" | "vazia" }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        estado === "vazia" ? "border-brand-border bg-white" : "border-brand-accent bg-brand-accent text-white"
      }`}
    >
      {estado === "marcada" && <Check size={11} strokeWidth={3} />}
      {estado === "parcial" && <Minus size={11} strokeWidth={3} />}
    </span>
  );
}

function EscopoHierarquia() {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(["1.1"]));

  function estadoDe(item: (typeof ITENS_ESCOPO)[number]): "marcada" | "parcial" | "vazia" {
    if ("filhos" in item) {
      const n = item.filhos.filter((f) => marcadas.has(f)).length;
      return n === 0 ? "vazia" : n === item.filhos.length ? "marcada" : "parcial";
    }
    return marcadas.has(item.id) ? "marcada" : "vazia";
  }

  function alternar(item: (typeof ITENS_ESCOPO)[number]) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if ("filhos" in item) {
        const todas = item.filhos.every((f) => novo.has(f));
        item.filhos.forEach((f) => (todas ? novo.delete(f) : novo.add(f)));
      } else if (novo.has(item.id)) novo.delete(item.id);
      else novo.add(item.id);
      return novo;
    });
  }

  return (
    <Moldura dica="Clique no item pai e depois em um filho">
      <div className="space-y-1">
        {ITENS_ESCOPO.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => alternar(item)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-brand-hover ${
              "pai" in item ? "ml-6 w-[calc(100%-1.5rem)] text-brand-muted" : "font-bold text-brand-navy-2"
            }`}
          >
            <CaixaMarca estado={estadoDe(item)} />
            {item.texto}
          </button>
        ))}
      </div>
    </Moldura>
  );
}

function EscopoEditor() {
  const linhas = [
    { nivel: 0, texto: "1. Levantamento" },
    { nivel: 1, texto: "1.1 Reunião de kick-off" },
    { nivel: 1, texto: "1.2 Mapeamento de processos" },
    { nivel: 0, texto: "2. Configuração" },
  ];
  return (
    <Moldura>
      <div className="space-y-1.5">
        {linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-brand-border-soft px-2.5 py-1.5">
            <span className="flex-1 truncate text-[12.5px] text-brand-navy-2" style={{ paddingLeft: l.nivel * 20 }}>
              {l.texto}
            </span>
            {["↑", "↓", "⇤", "⇥", "✕"].map((s) => (
              <span key={s} className="flex h-5 w-5 items-center justify-center rounded bg-brand-hover text-[11px] text-brand-muted">
                {s}
              </span>
            ))}
          </div>
        ))}
        <p className="pt-1 text-center text-[11px] text-brand-faint">subir · descer · recuar · tirar recuo · excluir</p>
      </div>
    </Moldura>
  );
}

function AtividadesDatas() {
  return (
    <Moldura>
      <p className="mb-2 text-[12px] font-bold text-brand-navy-2">Escopo · 2/4 concluídas</p>
      {[
        { t: "1.1 Reunião de kick-off", d: "Feito em: 05/08/2026", ok: true },
        { t: "1.2 Mapeamento de processos", d: "Feito em: 10/08/2026, 12/08/2026", ok: true },
        { t: "2.1 Parametrização", d: "", ok: false },
        { t: "2.2 Integrações", d: "", ok: false },
      ].map((a) => (
        <div key={a.t} className="flex items-start gap-2 py-1">
          <CaixaMarca estado={a.ok ? "marcada" : "vazia"} />
          <div>
            <p className="text-[12.5px] text-brand-navy-2">{a.t}</p>
            {a.d && <p className="text-[11px] text-brand-faint">{a.d}</p>}
          </div>
        </div>
      ))}
    </Moldura>
  );
}

// ---------- Projetos e Dashboard ----------

function StatusProjeto() {
  const exemplos = ["Projeto Alfa", "Projeto Beta", "Projeto Gama", "Projeto Delta"];
  return (
    <Moldura>
      <div className="space-y-2">
        {ABA_STATUS_PROJETO_ORDEM.map((s, i) => (
          <div
            key={s}
            className="flex items-center justify-between rounded-lg border border-brand-border-soft bg-white px-3 py-2"
            style={{ borderLeft: `4px solid ${ABA_STATUS_PROJETO_CONFIG[s].cor}` }}
          >
            <span className="text-[12.5px] font-semibold text-brand-navy-2">{exemplos[i]}</span>
            <span className="text-[11.5px] font-bold" style={{ color: ABA_STATUS_PROJETO_CONFIG[s].texto }}>
              {ABA_STATUS_PROJETO_CONFIG[s].label}
            </span>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

function TermometroPrevia() {
  const [atual, setAtual] = useState<Termometro>("normal");
  return (
    <Moldura dica="Clique para mudar o termômetro">
      <div className="flex flex-wrap gap-2">
        {TERMOMETRO_ORDEM.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAtual(t)}
            className={`rounded-full px-3 py-1 text-[12px] font-bold ring-2 transition-all ${
              atual === t ? "ring-brand-accent" : "ring-transparent opacity-60"
            }`}
            style={{ backgroundColor: TERMOMETRO_CONFIG[t].bg, color: TERMOMETRO_CONFIG[t].text }}
          >
            {TERMOMETRO_CONFIG[t].label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-brand-hover px-3 py-2 text-[12px] text-brand-muted">
        <strong className="text-brand-navy-2">Observação (obrigatória):</strong>{" "}
        {atual === "normal" ? "Projeto dentro do prazo." : atual === "atencao" ? "Cliente atrasou a validação." : "Marco de go-live em risco."}
      </div>
    </Moldura>
  );
}

function CancelarProjeto() {
  return (
    <Moldura>
      <div className="rounded-lg border border-brand-border-soft px-3 py-2.5" style={{ borderLeft: "4px solid #8b94ad" }}>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-brand-navy-2">Projeto Beta</span>
          <Pilula bg="#eef1f8" cor="#6a7594">Cancelado</Pilula>
        </div>
        <p className="mt-2 text-[11.5px] text-brand-muted">
          <strong className="text-brand-navy-2">Motivo:</strong> Cliente suspendeu o investimento.
        </p>
      </div>
      <div className="mt-3 flex justify-end">
        <BotaoFalso>Reabrir projeto</BotaoFalso>
      </div>
    </Moldura>
  );
}

function FiltrosDashboard() {
  const campos = [
    { l: "Status dos projetos", v: "Em andamento" },
    { l: "Consultores/Coordenadores", v: "Todos" },
    { l: "Projetos", v: "Todos" },
  ];
  return (
    <Moldura>
      <div className="flex flex-wrap gap-2.5">
        {campos.map((c) => (
          <div key={c.l}>
            <Rotulo>{c.l}</Rotulo>
            <div className="mt-1 min-w-[120px] rounded-lg border border-brand-border px-2.5 py-1.5 text-[12px] text-brand-navy-2">
              {c.v} <span className="float-right text-brand-faint">▾</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["Projetos: 12", "Horas no mês: 84:00", "Atenção: 3"].map((k) => (
          <div key={k} className="rounded-lg bg-brand-hover px-2 py-2 text-center text-[11.5px] font-bold text-brand-navy-2">
            {k}
          </div>
        ))}
      </div>
    </Moldura>
  );
}

function Pizza() {
  const partes = [
    { t: "normal" as const, v: 60 },
    { t: "atencao" as const, v: 28 },
    { t: "critico" as const, v: 12 },
  ];
  const cores: Record<Termometro, string> = { normal: "#15754c", atencao: "#e0a11e", critico: "#d64545" };
  const fatias = partes.map((p, i) => {
    const ini = partes.slice(0, i).reduce((soma, x) => soma + x.v, 0);
    return `${cores[p.t]} ${ini}% ${ini + p.v}%`;
  });
  return (
    <Moldura>
      <div className="flex items-center justify-center gap-6">
        <div className="h-28 w-28 rounded-full" style={{ background: `conic-gradient(${fatias.join(", ")})` }} />
        <div className="space-y-1.5">
          {partes.map((p) => (
            <div key={p.t} className="flex items-center gap-2 text-[12px] text-brand-navy-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cores[p.t] }} />
              {TERMOMETRO_CONFIG[p.t].label} · {p.v}%
            </div>
          ))}
        </div>
      </div>
    </Moldura>
  );
}

// ---------- Horas ----------

const ETAPAS_HORA: { status: StatusHora; quem: string }[] = [
  { status: "previsto", quem: "Você lança no Calendário" },
  { status: "aguardando_aprovacao", quem: "Consultor confirma o realizado" },
  { status: "aprovado", quem: "Coordenador aprova" },
];

function FluxoHoras() {
  const [etapa, setEtapa] = useState(0);
  return (
    <Moldura dica="Clique nas etapas para acompanhar">
      <div className="flex items-center justify-center gap-1.5">
        {ETAPAS_HORA.map((e, i) => (
          <div key={e.status} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEtapa(i)}
              className={`rounded-full ring-2 transition-all ${etapa === i ? "ring-brand-accent" : "ring-transparent opacity-55"}`}
            >
              <Pilula bg={STATUS_HORA_CONFIG[e.status].bg} cor={STATUS_HORA_CONFIG[e.status].text}>
                {STATUS_HORA_CONFIG[e.status].label}
              </Pilula>
            </button>
            {i < ETAPAS_HORA.length - 1 && <ArrowRight size={14} className="text-brand-faint" />}
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-brand-hover px-3 py-2 text-center text-[12px] text-brand-navy-2">
        {ETAPAS_HORA[etapa].quem}
        {etapa === 2 ? " — a hora passa a contar no projeto." : "."}
      </p>
      <p className="mt-2 text-center text-[11.5px] text-brand-faint">
        Se rejeitada, volta com o motivo para o consultor ajustar.
      </p>
    </Moldura>
  );
}

function AprovarRejeitar() {
  return (
    <Moldura>
      <div className="rounded-lg border border-brand-border-soft p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[12.5px] font-bold text-brand-navy-2">Projeto Alfa</p>
            <p className="text-[11.5px] text-brand-muted">17/09/2026 · 08:00–12:00 · Ana Souza</p>
          </div>
          <span className="text-[14px] font-extrabold text-brand-navy-2">04:00</span>
        </div>
        <div className="mt-3 flex gap-2">
          <BotaoFalso escuro>Aprovar</BotaoFalso>
          <span className="inline-flex items-center rounded-lg px-3 py-1.5 text-[12px] font-bold text-red-600">Rejeitar</span>
        </div>
      </div>
      <p className="mt-2.5 rounded-lg bg-[#fdeceb] px-3 py-2 text-[11.5px] text-[#b5392a]">
        Ao rejeitar, o motivo é obrigatório.
      </p>
    </Moldura>
  );
}

function KpisHorasPrevia() {
  return (
    <Moldura>
      <div className="mb-3 flex flex-wrap gap-2">
        {["Projeto: Todos", "Status: Todos", "Mês: 09/2026"].map((f) => (
          <span key={f} className="rounded-lg border border-brand-border px-2.5 py-1 text-[11.5px] text-brand-navy-2">
            {f}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Total de horas", "18:00"],
          ["Dias com lançamento", "4"],
          ["Projetos atendidos", "2"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-brand-hover px-2 py-2.5 text-center">
            <p className="text-[9.5px] font-bold tracking-[.06em] text-brand-faint uppercase">{l}</p>
            <p className="mt-1 text-[18px] font-extrabold text-brand-navy-2">{v}</p>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

function Importar() {
  return (
    <Moldura>
      <div className="flex items-center justify-between gap-3">
        <BotaoFalso>
          <Upload size={14} /> Importar horas retroativas
        </BotaoFalso>
        <span className="text-[11.5px] text-brand-muted">planilha → horas já aprovadas</span>
      </div>
    </Moldura>
  );
}

function ConfirmarLote() {
  return (
    <Moldura>
      <div className="mb-3 flex justify-end">
        <BotaoFalso escuro>
          <Check size={14} /> Confirmar todos os realizados (5)
        </BotaoFalso>
      </div>
      {["15/09/2026 · 08:00–12:00", "16/09/2026 · 13:00–17:00"].map((l) => (
        <div key={l} className="mb-1.5 flex items-center justify-between rounded-lg bg-brand-hover px-3 py-2 text-[12px] text-brand-navy-2">
          <span>{l}</span>
          <Pilula bg={STATUS_HORA_CONFIG.previsto.bg} cor={STATUS_HORA_CONFIG.previsto.text}>Previsto</Pilula>
        </div>
      ))}
    </Moldura>
  );
}

function Rejeicao() {
  return (
    <Moldura>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-bold text-brand-navy-2">Projeto Alfa</p>
        <Pilula bg={STATUS_HORA_CONFIG.rejeitado.bg} cor={STATUS_HORA_CONFIG.rejeitado.text}>Rejeitado</Pilula>
      </div>
      <p className="mt-2 rounded-md bg-[#fdeceb] px-3 py-2 text-[12px] text-[#b5392a]">
        <strong>Motivo da rejeição:</strong> Horário diferente do combinado com o cliente.
      </p>
      <p className="mt-2 text-[11.5px] text-brand-muted">Ajuste no Calendário e confirme de novo.</p>
    </Moldura>
  );
}

// ---------- Cadastros ----------

function Cadastros() {
  return (
    <Moldura>
      <div className="grid grid-cols-2 gap-2">
        {["Clientes", "Recursos", "Parceiras", "Documentos", "Escopos", "Usuários"].map((c) => (
          <div key={c} className="rounded-lg bg-brand-navy px-3 py-2 text-[12px] font-semibold text-white/90">
            {c}
          </div>
        ))}
      </div>
    </Moldura>
  );
}

function Box() {
  return (
    <Moldura>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TIPO_BOX_CONFIG) as (keyof typeof TIPO_BOX_CONFIG)[]).map((k) => (
          <Pilula key={k} bg="#e8efff" cor="#2456b8">{TIPO_BOX_CONFIG[k].label}</Pilula>
        ))}
      </div>
      <div className="mt-3">
        <Rotulo>Filtro no Apontamento</Rotulo>
        <div className="mt-1 inline-block rounded-lg border border-brand-border px-2.5 py-1.5 text-[12px] text-brand-navy-2">
          Todos · Próprios · Terceiros ▾
        </div>
      </div>
    </Moldura>
  );
}

function Perfis() {
  const perfis = [
    ["Administrador", "#e8efff", "#2456b8"],
    ["Coordenador", "#fff2de", "#a4650d"],
    ["Consultor", "#e3f5ea", "#15754c"],
    ["Financeiro", "#eef1f8", "#6a7594"],
  ];
  return (
    <Moldura>
      <div className="flex flex-wrap gap-2">
        {perfis.map(([n, bg, cor]) => (
          <Pilula key={n} bg={bg} cor={cor}>{n}</Pilula>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-brand-muted">Cada perfil vê apenas o que precisa para trabalhar.</p>
    </Moldura>
  );
}

// ---------- Financeiro ----------

function KpisFinanceiro() {
  return (
    <Moldura>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Total contratado", "R$ 480.000"],
          ["Recebido", "R$ 210.000"],
          ["A receber", "R$ 95.000"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-brand-hover px-2 py-2.5 text-center">
            <p className="text-[9.5px] font-bold tracking-[.06em] text-brand-faint uppercase">{l}</p>
            <p className="mt-1 text-[13px] font-extrabold text-brand-navy-2">{v}</p>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

function ParcelaStatus() {
  const [sel, setSel] = useState<keyof typeof STATUS_PARCELA_CONFIG>("LIBERADO");
  const exigencia: Record<string, string> = {
    AGUARDANDO: "Aguardando a liberação da parcela.",
    LIBERADO: "Parcela liberada para faturar.",
    FATURADO: "Informe a nota fiscal (até 200 caracteres).",
    RECEBIDO: "Informe a data do recebimento.",
    CANCELADO: "Informe a data e o motivo do cancelamento.",
  };
  return (
    <Moldura dica="Clique em um status para ver o que ele exige">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_PARCELA_CONFIG) as (keyof typeof STATUS_PARCELA_CONFIG)[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSel(s)}
            className={`rounded-full ring-2 transition-all ${sel === s ? "ring-brand-accent" : "ring-transparent opacity-60"}`}
          >
            <Pilula bg={STATUS_PARCELA_CONFIG[s].bg} cor={STATUS_PARCELA_CONFIG[s].text}>
              {STATUS_PARCELA_CONFIG[s].label}
            </Pilula>
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-brand-hover px-3 py-2 text-[12px] text-brand-navy-2">{exigencia[sel]}</p>
    </Moldura>
  );
}

function Fechamento() {
  const cab = ["Data", "Recurso", "Cliente", "Projeto", "Horas", "Repasse"];
  return (
    <Moldura>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[11px]">
          <thead>
            <tr className="border-b border-brand-border-soft text-left text-[9.5px] font-bold tracking-[.06em] text-brand-faint uppercase">
              {cab.map((c) => (
                <th key={c} className="px-1 py-1.5">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-brand-navy-2">
            <tr className="border-b border-brand-border-soft">
              <td className="px-1 py-1.5">03/09</td><td className="px-1">Ana Souza</td><td className="px-1">Cliente X</td><td className="px-1">Alfa</td><td className="px-1">08:00</td><td className="px-1">R$ 400</td>
            </tr>
            <tr>
              <td className="px-1 py-1.5">04/09</td><td className="px-1">Ana Souza</td><td className="px-1">Cliente Y</td><td className="px-1">Beta</td><td className="px-1">04:00</td><td className="px-1">R$ 200</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-brand-muted">Vencimento: dia 28 do mês seguinte (próximo dia útil) · PDF ou Excel</p>
    </Moldura>
  );
}

// ---------- Marcações e notificações ----------

function Marcacao() {
  const [ciente, setCiente] = useState(false);
  return (
    <Moldura dica="Clique em Dar ciência para testar">
      <div className="mb-2.5 flex gap-1.5">
        <Pilula bg="#eef1f8" cor="#6a7594">Atualização</Pilula>
        <Pilula bg="#fdeceb" cor="#b5392a">Problema</Pilula>
        <Pilula bg="#e8efff" cor="#2456b8">Decisão</Pilula>
      </div>
      <p className="text-[12.5px] leading-relaxed text-brand-navy-2">
        Erro na integração do pedido.{" "}
        <span className="rounded bg-brand-accent-soft px-1 font-semibold text-brand-accent">@Ana Souza</span> pode validar
        o ajuste?
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {ciente ? (
          <span className="rounded-full bg-[#e3f5ea] px-2 py-0.5 text-[10.5px] font-semibold text-[#15754c]">
            ✓ Ana Souza ciente
          </span>
        ) : (
          <>
            <span className="rounded-full bg-[#fff2de] px-2 py-0.5 text-[10.5px] font-semibold text-[#a4650d]">
              Ana Souza · aguardando ciência
            </span>
            <button type="button" onClick={() => setCiente(true)}>
              <BotaoFalso>
                <Check size={13} /> Dar ciência
              </BotaoFalso>
            </button>
          </>
        )}
      </div>
    </Moldura>
  );
}

function Sino() {
  return (
    <Moldura>
      <div className="mb-3 flex justify-end">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-hover text-brand-muted">
          <Bell size={18} />
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            2
          </span>
        </span>
      </div>
      <div className="rounded-lg border border-brand-border-soft bg-brand-accent-soft/40 p-3">
        <p className="text-[12px] text-brand-navy-2">
          <strong>Carlos Lima</strong> marcou você em <strong>Cliente X — 004646</strong>{" "}
          <Pilula bg="#fdeceb" cor="#b5392a">Problema</Pilula>
        </p>
        <p className="mt-1 text-[11.5px] text-brand-muted">Erro na integração do pedido...</p>
      </div>
    </Moldura>
  );
}

// ---------- Meus projetos ----------

function CardProjeto() {
  return (
    <Moldura dica="Clique no card para abrir o painel do projeto">
      <div
        className="rounded-xl border border-brand-border-soft bg-white p-3.5"
        style={{ borderLeft: `4px solid ${ABA_STATUS_PROJETO_CONFIG.em_andamento.cor}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[13px] font-bold text-brand-navy-2">Cliente X</p>
            <p className="text-[11px] text-brand-faint">004646 · 01/08/2026 – A definir</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TERMOMETRO_CONFIG.atencao.text }} />
            Atenção
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-border">
          <div className="h-full w-[62%] rounded-full bg-brand-accent" />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-brand-muted">
          <span>62% concluído</span>
          <span>
            Horas <strong className="text-brand-navy-2">24h</strong>/40h
          </span>
        </div>
        <p className="mt-2.5 truncate rounded-lg bg-brand-hover px-2.5 py-1.5 text-[10.5px] text-brand-muted">
          💬 18/09/2026 16:20 · Integração validada com o cliente
        </p>
      </div>
    </Moldura>
  );
}

function DocumentosMit() {
  const docs: { codigo: string; nome: string; status: keyof typeof STATUS_DOCUMENTO_CONFIG }[] = [
    { codigo: "MIT024", nome: "KICK-OFF", status: "ASSINADO" },
    { codigo: "MIT041", nome: "DIAGRAMA DE PROCESSOS", status: "ASSINADO" },
    { codigo: "MIT010A", nome: "VALIDAÇÃO DAS CONFIGURAÇÕES", status: "VALIDACAO" },
    { codigo: "MIT010B", nome: "VALIDAÇÃO DAS CAPACITAÇÕES", status: "ANDAMENTO" },
    { codigo: "MIT045", nome: "SIMULAÇÃO DE PROCESSOS", status: "A_INICIAR" },
  ];
  return (
    <Moldura>
      <div className="overflow-hidden rounded-lg border border-brand-border-soft">
        {docs.map((d) => (
          <div
            key={d.codigo}
            className="flex items-center gap-2.5 border-t border-brand-border-soft px-3 py-2 first:border-t-0"
          >
            <span className="w-[54px] shrink-0 text-[10.5px] font-bold text-brand-faint">{d.codigo}</span>
            <span className="flex-1 truncate text-[12px] text-brand-navy-2">{d.nome}</span>
            <Pilula bg={STATUS_DOCUMENTO_CONFIG[d.status].bg} cor={STATUS_DOCUMENTO_CONFIG[d.status].text}>
              {STATUS_DOCUMENTO_CONFIG[d.status].label}
            </Pilula>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-brand-muted">O progresso do projeto vem do status destes documentos.</p>
    </Moldura>
  );
}

function ContatosCliente() {
  const envolvidos = [
    { nome: "Marina Alves", email: "marina.alves@clientex.com.br", tel: "(11) 91234-5678" },
    { nome: "Paulo Ribeiro", email: "paulo.ribeiro@clientex.com.br", tel: "(11) 99876-5432" },
    { nome: "Renata Costa", email: "renata.costa@clientex.com.br", tel: "(11) 93456-7890" },
  ];
  return (
    <Moldura>
      <p className="mb-2 text-[12px] font-bold text-brand-navy-2">Principais envolvidos</p>
      <div className="overflow-hidden rounded-lg border border-brand-border-soft">
        {envolvidos.map((e) => (
          <div
            key={e.nome}
            className="flex flex-wrap items-baseline gap-x-3 border-t border-brand-border-soft px-3 py-2 first:border-t-0"
          >
            <span className="text-[12px] font-semibold text-brand-navy-2">{e.nome}</span>
            <span className="text-[11px] text-brand-muted">{e.email}</span>
            <span className="text-[11px] text-brand-muted">{e.tel}</span>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

const PREVIAS: Record<PreviaId, () => ReactNode> = {
  "card-projeto": CardProjeto,
  "documentos-mit": DocumentosMit,
  "contatos-cliente": ContatosCliente,
  marcacao: Marcacao,
  sino: Sino,
  cadastros: Cadastros,
  box: Box,
  perfis: Perfis,
  "escopo-editor": EscopoEditor,
  "escopo-hierarquia": EscopoHierarquia,
  "status-projeto": StatusProjeto,
  termometro: TermometroPrevia,
  "cancelar-projeto": CancelarProjeto,
  "atividades-datas": AtividadesDatas,
  "filtros-dashboard": FiltrosDashboard,
  pizza: Pizza,
  "botoes-mt": BotoesMT,
  "conflito-horario": ConflitoHorario,
  "fluxo-horas": FluxoHoras,
  "aprovar-rejeitar": AprovarRejeitar,
  "kpis-horas": KpisHorasPrevia,
  importar: Importar,
  "confirmar-lote": ConfirmarLote,
  rejeicao: Rejeicao,
  "kpis-financeiro": KpisFinanceiro,
  "parcela-status": ParcelaStatus,
  fechamento: Fechamento,
};

export function GuiaPrevia({ id }: { id: PreviaId }) {
  const Previa = PREVIAS[id];
  return <Previa />;
}
