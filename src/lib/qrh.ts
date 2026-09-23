import type { Projeto } from "@/types";

/** Sistemas do cliente informados no módulo QRH (folha, estoque, e-Social) — vazio se não for QRH ou nada foi preenchido. */
export function sistemasQrh(projeto: Pick<Projeto, "modulo" | "detalhesQRH">): { rotulo: string; valor: string }[] {
  if (projeto.modulo !== "QRH" || !projeto.detalhesQRH) return [];
  const d = projeto.detalhesQRH;
  const candidatos: { rotulo: string; valor: string | null | undefined }[] = [
    { rotulo: "Folha", valor: d.folha },
    { rotulo: "Estoque", valor: d.estoque },
    { rotulo: "e-Social", valor: d.esocial },
  ];
  return candidatos.flatMap((c) => (c.valor ? [{ rotulo: c.rotulo, valor: c.valor }] : []));
}
