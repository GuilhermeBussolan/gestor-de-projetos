"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { seedAdminIfNeeded } from "@/lib/seedAdmin";
import type { Usuario } from "@/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedAdminIfNeeded();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      try {
        if (fbUser) {
          const snap = await getDoc(doc(db, "usuarios", fbUser.uid));
          if (snap.exists()) {
            setUsuario({ uid: fbUser.uid, ...(snap.data() as Omit<Usuario, "uid">) });
          } else {
            setUsuario(null);
          }
        } else {
          setUsuario(null);
        }
      } catch (err) {
        console.error("Falha ao carregar o perfil do usuário:", err);
        setUsuario(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function login(email: string, senha: string) {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    // Conta no Auth sem perfil em "usuarios": não adianta manter a sessão aberta.
    const perfil = await getDoc(doc(db, "usuarios", cred.user.uid));
    if (!perfil.exists()) {
      await firebaseSignOut(auth);
      throw Object.assign(new Error("Conta sem perfil cadastrado."), { code: "perfil-ausente" });
    }
  }

  async function logout() {
    await firebaseSignOut(auth);
  }

  async function trocarSenha(senhaAtual: string, novaSenha: string) {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error("Usuário não autenticado.");
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, senhaAtual);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, novaSenha);
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, usuario, loading, login, logout, trocarSenha }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
