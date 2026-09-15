"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormRow, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { firebaseErrorCode } from "@/lib/errors";

export function TrocarSenhaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trocarSenha } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  function fechar() {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmar("");
    setErro("");
    setSucesso(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("A confirmação não confere com a nova senha.");
      return;
    }
    setLoading(true);
    try {
      await trocarSenha(senhaAtual, novaSenha);
      setSucesso(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmar("");
    } catch (err) {
      const code = firebaseErrorCode(err);
      setErro(
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "Senha atual incorreta."
          : "Não foi possível trocar a senha. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={fechar} title="Trocar senha">
      {sucesso ? (
        <div className="space-y-4">
          <p className="text-sm text-green-700">Senha alterada com sucesso.</p>
          <Button onClick={fechar}>Fechar</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormRow label="Senha atual">
            <Input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
            />
          </FormRow>
          <FormRow label="Nova senha">
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </FormRow>
          <FormRow label="Confirmar nova senha">
            <Input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />
          </FormRow>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
