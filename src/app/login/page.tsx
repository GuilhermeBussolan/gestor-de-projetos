"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

function mensagemErroLogin(err: unknown) {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "E-mail ou senha inválidos.";
    case "auth/user-disabled":
      return "Este usuário está desativado no Firebase Authentication.";
    case "auth/too-many-requests":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    case "auth/network-request-failed":
      return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    case "perfil-ausente":
      return "Login válido, mas este usuário não tem perfil cadastrado no sistema. Peça a um administrador para conferir o cadastro.";
    case "permission-denied":
      return "Login válido, mas sem permissão para ler o perfil (regras do Firestore).";
    default:
      return `Não foi possível entrar${code ? ` (${code})` : ""}.`;
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      await login(email, senha);
      router.push("/");
    } catch (err) {
      setErro(mensagemErroLogin(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-brand-bg px-6 py-14">
      <div className="w-full max-w-[390px] rounded-2xl border border-brand-border bg-white p-9 shadow-card-lg">
        <div className="mb-7 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-navy.png" alt="NG" className="h-10 w-auto" />
          <span className="mt-2.5 text-sm font-bold text-brand-navy-2">Gestor de Projetos</span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <FormRow label="E-mail">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </FormRow>
          <FormRow label="Senha">
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </FormRow>
          {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
