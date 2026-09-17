"use client";

import { useState } from "react";
import { writeBatch, collection, doc } from "firebase/firestore";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormRow, Input, Select } from "@/components/ui/Field";
import { nomeExibicaoCliente } from "@/lib/cliente";
import { calcularTotalHoras } from "@/lib/horas";
import type { Cliente, Projeto, Recurso, Usuario } from "@/types";

const DIAS_SEMANA = [
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
] as const;

const LIMITE_OCORRENCIAS = 300;

function RecorrenciaForm({
  onClose,
  projetos,
  clientes,
  recursos,
  usuario,
}: {
  onClose: () => void;
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
  usuario: Usuario;
}) {
  const souConsultor = usuario.perfil === "consultor";
  const meuRecursoId = usuario.recursoId ?? "";

  const [recursoId, setRecursoId] = useState(souConsultor ? meuRecursoId : "");
  const [projetoId, setProjetoId] = useState("");
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("12:00");
  const [horaDesconto, setHoraDesconto] = useState("00:00");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const hojeISO = new Date().toISOString().slice(0, 10);

  const projetosDisponiveis = souConsultor
    ? projetos.filter((p) => p.consultorIds?.includes(meuRecursoId) && p.status !== "finalizado")
    : projetos;

  function toggleDia(valor: number) {
    setDiasSemana((prev) => (prev.includes(valor) ? prev.filter((d) => d !== valor) : [...prev, valor]));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!recursoId || !projetoId || diasSemana.length === 0 || !dataInicio || !dataFim) return;
    if (dataFim < dataInicio) {
      setErro("A data final precisa ser depois da data inicial.");
      return;
    }
    if (souConsultor && dataFim > hojeISO) {
      setErro("Você só pode lançar agenda fixa para dias que já passaram — nada no futuro.");
      return;
    }

    const todosOsDias = eachDayOfInterval({ start: parseISO(dataInicio), end: parseISO(dataFim) });
    const datasOcorrencias = todosOsDias
      .filter((d) => diasSemana.includes(d.getDay()))
      .map((d) => format(d, "yyyy-MM-dd"));

    if (datasOcorrencias.length === 0) {
      setErro("Nenhuma data cai nos dias da semana escolhidos dentro desse período.");
      return;
    }
    if (datasOcorrencias.length > LIMITE_OCORRENCIAS) {
      setErro(
        `Esse período geraria ${datasOcorrencias.length} ocorrências — reduza o intervalo (máximo ${LIMITE_OCORRENCIAS}).`
      );
      return;
    }

    setSalvando(true);
    try {
      const seriesId =
        typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `serie-${Date.now()}`;
      const totalHorasPadrao = calcularTotalHoras(horaInicio, horaFim, horaDesconto);
      const batch = writeBatch(db);
      for (const data of datasOcorrencias) {
        const ref = doc(collection(db, "eventosCalendario"));
        batch.set(ref, {
          data,
          projetoId,
          recursoId,
          horaInicio,
          horaFim,
          horaDesconto,
          totalHoras: totalHorasPadrao,
          descricao: "",
          origem: "recorrencia",
          seriesId,
          status: "previsto",
          createdAt: Date.now(),
        });
      }
      await batch.commit();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {!souConsultor && (
        <FormRow label="Recurso">
          <Select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} required>
            <option value="">Selecione...</option>
            {recursos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nomeCompleto}
              </option>
            ))}
          </Select>
        </FormRow>
      )}

      <FormRow label="Projeto (cliente)">
        <Select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} required>
          <option value="">Selecione...</option>
          {projetosDisponiveis.map((p) => {
            const cliente = clientes.find((c) => c.id === p.clienteId);
            return (
              <option key={p.id} value={p.id}>
                {nomeExibicaoCliente(cliente)} — {p.codigoProposta}
              </option>
            );
          })}
        </Select>
      </FormRow>

      <div>
        <p className="mb-1 text-sm font-medium text-brand-navy-2">Dias da semana</p>
        <div className="flex gap-2">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.valor}
              type="button"
              onClick={() => toggleDia(d.valor)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                diasSemana.includes(d.valor)
                  ? "border-brand-accent bg-brand-accent text-white"
                  : "border-brand-border text-brand-muted hover:bg-brand-hover"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FormRow label="Hora início">
          <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />
        </FormRow>
        <FormRow label="Hora fim">
          <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required />
        </FormRow>
        <FormRow label="Desconto">
          <Input type="time" value={horaDesconto} onChange={(e) => setHoraDesconto(e.target.value)} />
        </FormRow>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Data início">
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            max={souConsultor ? hojeISO : undefined}
            required
          />
        </FormRow>
        <FormRow label="Data fim">
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            max={souConsultor ? hojeISO : undefined}
            required
          />
        </FormRow>
      </div>

      {souConsultor ? (
        <p className="text-xs text-brand-muted">
          Só dá pra lançar dias que já passaram — depois de criar, confirme cada um como realizado em
          &quot;Horas previstas&quot;.
        </p>
      ) : (
        <p className="text-xs text-brand-muted">
          Cada ocorrência entra no calendário como <strong>pendente</strong> — quando chegar o dia, é só
          confirmar se foi realizada ou cancelada.
        </p>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? "Criando..." : "Criar agenda fixa"}
        </Button>
      </div>
    </form>
  );
}

export function RecorrenciaModal({
  aberto,
  onClose,
  projetos,
  clientes,
  recursos,
  usuario,
}: {
  aberto: boolean;
  onClose: () => void;
  projetos: Projeto[];
  clientes: Cliente[];
  recursos: Recurso[];
  usuario: Usuario;
}) {
  return (
    <Modal open={aberto} onClose={onClose} title="Nova agenda fixa (recorrente)">
      {aberto && (
        <RecorrenciaForm
          onClose={onClose}
          projetos={projetos}
          clientes={clientes}
          recursos={recursos}
          usuario={usuario}
        />
      )}
    </Modal>
  );
}
