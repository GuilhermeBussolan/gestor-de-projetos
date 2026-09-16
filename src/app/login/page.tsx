"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input, FormRow, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { firebaseErrorCode } from "@/lib/errors";
import type { Perfil } from "@/types";

export default function LoginPage() {
  const { login, registrar } = useAuth();
  const router = useRouter();
  const [modo, setModo] = useState<"login" | "cadastro">("login");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [emailCadastro, setEmailCadastro] = useState("");
  const [senhaCadastro, setSenhaCadastro] = useState("");
  const [perfilCadastro, setPerfilCadastro] = useState<Perfil>("consultor");

  function destinoPorPerfil(perfil: Perfil) {
    return perfil === "consultor" ? "/calendario" : "/projetos";
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      await login(email, senha);
      router.push("/");
    } catch {
      setErro("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastro(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (senhaCadastro.length < 6) {
      setErro("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await registrar(nomeCompleto, emailCadastro, senhaCadastro, perfilCadastro);
      router.push(destinoPorPerfil(perfilCadastro));
    } catch (err) {
      setErro(
        firebaseErrorCode(err) === "auth/email-already-in-use"
          ? "Este e-mail já está cadastrado."
          : "Não foi possível concluir o cadastro."
      );
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

        {modo === "login" ? (
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
              <button
                type="button"
                onClick={() => {
                  setErro("");
                  setModo("cadastro");
                }}
                className="w-full text-center text-sm font-semibold text-brand-accent hover:underline"
              >
                Criar uma conta
              </button>
            </form>
          ) : (
            <form onSubmit={handleCadastro} className="space-y-4">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-brand-navy-2">
                  Criar acesso
                </h2>
                <p className="mt-1.5 text-sm text-brand-muted">
                  Um administrador ajusta seu perfil e recurso depois.
                </p>
              </div>
              <FormRow label="Nome completo">
                <Input
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  required
                  autoFocus
                />
              </FormRow>
              <FormRow label="E-mail de trabalho">
                <Input
                  type="email"
                  value={emailCadastro}
                  onChange={(e) => setEmailCadastro(e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label="Senha">
                <Input
                  type="password"
                  value={senhaCadastro}
                  onChange={(e) => setSenhaCadastro(e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label="Perfil">
                <Select
                  value={perfilCadastro}
                  onChange={(e) => setPerfilCadastro(e.target.value as Perfil)}
                >
                  <option value="consultor">Consultor</option>
                  <option value="coordenador">Coordenador</option>
                </Select>
              </FormRow>
              {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Cadastrando..." : "Cadastrar"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setErro("");
                  setModo("login");
                }}
                className="w-full text-center text-sm font-semibold text-brand-accent hover:underline"
              >
                Já tenho conta, fazer login
              </button>
            </form>
          )}
      </div>
    </div>
  );
}
