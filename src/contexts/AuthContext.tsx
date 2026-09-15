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
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { seedAdminIfNeeded } from "@/lib/seedAdmin";
import type { Perfil, Usuario } from "@/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (
    nomeCompleto: string,
    email: string,
    senha: string,
    perfil: Perfil,
    recursoId?: string | null
  ) => Promise<void>;
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
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function login(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha);
  }

  async function registrar(
    nomeCompleto: string,
    email: string,
    senha: string,
    perfil: Perfil,
    recursoId: string | null = null
  ) {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nomeCompleto,
      email,
      perfil,
      recursoId,
      createdAt: Date.now(),
    });
    setUsuario({ uid: cred.user.uid, nomeCompleto, email, perfil, recursoId, createdAt: Date.now() });
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
      value={{ firebaseUser, usuario, loading, login, registrar, logout, trocarSenha }}
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
