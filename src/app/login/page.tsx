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
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-sky-600 text-sm font-bold text-white">
            GP
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Gestor de Projetos</h1>
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
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setErro("");
                setModo("cadastro");
              }}
              className="w-full text-center text-sm text-sky-600 hover:underline"
            >
              Criar uma conta
            </button>
          </form>
        ) : (
          <form onSubmit={handleCadastro} className="space-y-4">
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
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setErro("");
                setModo("login");
              }}
              className="w-full text-center text-sm text-sky-600 hover:underline"
            >
              Já tenho conta, fazer login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
