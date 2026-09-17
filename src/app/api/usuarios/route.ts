import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import type { Perfil } from "@/types";

const PERFIS_VALIDOS: Perfil[] = ["administrador", "coordenador", "consultor", "financeiro"];

/** Cria uma conta nova (Auth + doc em usuarios). Só um administrador pode chamar. */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let uidChamador: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uidChamador = decoded.uid;
  } catch (err) {
    if (err instanceof Error && err.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
      console.error("Firebase Admin sem credenciais configuradas:", err.message);
      return NextResponse.json(
        { erro: "Servidor sem credenciais do Firebase Admin configuradas (FIREBASE_SERVICE_ACCOUNT_KEY)." },
        { status: 500 }
      );
    }
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }

  const db = getAdminDb();
  const chamadorSnap = await db.collection("usuarios").doc(uidChamador).get();
  if (!chamadorSnap.exists || chamadorSnap.data()?.perfil !== "administrador") {
    return NextResponse.json({ erro: "Apenas administradores podem criar usuários." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nomeCompleto = typeof body?.nomeCompleto === "string" ? body.nomeCompleto.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const senha = typeof body?.senha === "string" ? body.senha : "";
  const perfil = body?.perfil as string | undefined;
  const recursoId = typeof body?.recursoId === "string" && body.recursoId ? body.recursoId : null;

  if (!nomeCompleto || !email || senha.length < 6) {
    return NextResponse.json(
      { erro: "Preencha nome, e-mail e uma senha com ao menos 6 caracteres." },
      { status: 400 }
    );
  }
  if (!perfil || !PERFIS_VALIDOS.includes(perfil as Perfil)) {
    return NextResponse.json({ erro: "Perfil inválido." }, { status: 400 });
  }

  try {
    const userRecord = await getAdminAuth().createUser({
      email,
      password: senha,
      displayName: nomeCompleto,
    });

    await db.collection("usuarios").doc(userRecord.uid).set({
      nomeCompleto,
      email,
      perfil,
      recursoId,
      createdAt: Date.now(),
    });

    return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ erro: "Este e-mail já está cadastrado." }, { status: 409 });
    }
    if (code === "auth/invalid-password") {
      return NextResponse.json({ erro: "Senha inválida (mínimo 6 caracteres)." }, { status: 400 });
    }
    console.error("Erro ao criar usuário:", err);
    return NextResponse.json({ erro: "Não foi possível criar o usuário." }, { status: 500 });
  }
}
