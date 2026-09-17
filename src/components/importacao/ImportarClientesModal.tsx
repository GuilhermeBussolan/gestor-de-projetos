"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ImportModal, type LinhaValidada } from "@/components/importacao/ImportModal";
import { pegarCampo, type LinhaImportada } from "@/lib/importarArquivo";
import { cnpjValido, formatarCnpj, somenteDigitos } from "@/lib/cnpj";
import type { Cliente } from "@/types";

interface ClienteImportado {
  nome: string;
  nomeFantasia: string;
  cnpj: string;
  codigoCI: string;
}

function processar(linhas: LinhaImportada[], clientesExistentes: Cliente[]): LinhaValidada<ClienteImportado>[] {
  const cnpjsExistentes = new Set(
    clientesExistentes.map((c) => somenteDigitos(c.cnpj ?? "")).filter(Boolean)
  );
  const cnpjsNoArquivo = new Set<string>();

  return linhas.map((l) => {
    const nome = pegarCampo(l.valores, "Nome");
    const nomeFantasia = pegarCampo(l.valores, "Nome Fantasia", "Nome fantasia");
    const cnpjBruto = pegarCampo(l.valores, "CNPJ");
    const codigoCI = pegarCampo(l.valores, "Código C.I", "Codigo C.I", "Código CI", "Codigo CI", "Código C I");
    const cnpjDigitos = somenteDigitos(cnpjBruto);

    const erros: string[] = [];
    if (!nome) erros.push("Nome vazio");
    if (!nomeFantasia) erros.push("Nome Fantasia vazio");
    if (!codigoCI) erros.push("Código C.I vazio");
    if (!cnpjBruto) {
      erros.push("CNPJ vazio");
    } else if (!cnpjValido(cnpjBruto)) {
      erros.push("CNPJ inválido");
    } else if (cnpjsExistentes.has(cnpjDigitos)) {
      erros.push("CNPJ já cadastrado");
    } else if (cnpjsNoArquivo.has(cnpjDigitos)) {
      erros.push("CNPJ duplicado no arquivo");
    }

    if (erros.length === 0) cnpjsNoArquivo.add(cnpjDigitos);

    return {
      linha: l.linha,
      ok: erros.length === 0,
      erros,
      dados:
        erros.length === 0
          ? { nome, nomeFantasia, cnpj: formatarCnpj(cnpjBruto), codigoCI }
          : null,
      resumo: nome || nomeFantasia || `(linha ${l.linha})`,
    };
  });
}

export function ImportarClientesModal({
  open,
  onClose,
  clientesExistentes,
}: {
  open: boolean;
  onClose: () => void;
  clientesExistentes: Cliente[];
}) {
  return (
    <ImportModal<ClienteImportado>
      open={open}
      onClose={onClose}
      titulo="Importar clientes"
      instrucoes={
        <>
          Colunas esperadas (primeira linha do arquivo): <strong>Nome</strong>,{" "}
          <strong>Nome Fantasia</strong>, <strong>CNPJ</strong>, <strong>Código C.I</strong>. Todas
          obrigatórias — o CNPJ precisa ter um formato válido e não pode repetir um cliente já
          cadastrado.
        </>
      }
      processarLinhas={(linhas) => processar(linhas, clientesExistentes)}
      onConfirmar={async (validos) => {
        for (const c of validos) {
          await addDoc(collection(db, "clientes"), {
            nome: c.nome,
            nomeFantasia: c.nomeFantasia || null,
            cnpj: c.cnpj || null,
            codigoCI: c.codigoCI || null,
            createdAt: serverTimestamp(),
          });
        }
      }}
    />
  );
}
