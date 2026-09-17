import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import type { Perfil } from "@/types";

const PERFIS_VALIDOS: Perfil[] = ["administrador", "coordenador", "consultor", "financeiro"];

function erroServidor(err: unknown, prefixo: string) {
  const code = (err as { code?: string } | null)?.code;
  const detalhe = err instanceof Error ? err.message : String(err);
  console.error(prefixo, err);
  return NextResponse.json({ erro: `${prefixo} [${code ?? "sem código"}] ${detalhe}` }, { status: 500 });
}

/** Cria uma conta nova (Auth + doc em usuarios). Só um administrador pode chamar. */
export async function POST(request: NextRequest) {
  try {
    return await handlePOST(request);
  } catch (err) {
    return erroServidor(err, "Erro inesperado ao criar o usuário.");
  }
}

async function handlePOST(request: NextRequest) {
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

  let db: ReturnType<typeof getAdminDb>;
  try {
    db = getAdminDb();
  } catch (err) {
    return erroServidor(err, "Falha ao inicializar o Firestore Admin.");
  }

  let chamadorSnap;
  try {
    chamadorSnap = await db.collection("usuarios").doc(uidChamador).get();
  } catch (err) {
    return erroServidor(err, "Falha ao ler o usuário chamador.");
  }
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

  let userRecord;
  try {
    userRecord = await getAdminAuth().createUser({
      email,
      password: senha,
      displayName: nomeCompleto,
    });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ erro: "Este e-mail já está cadastrado." }, { status: 409 });
    }
    if (code === "auth/invalid-password") {
      return NextResponse.json({ erro: "Senha inválida (mínimo 6 caracteres)." }, { status: 400 });
    }
    return erroServidor(err, "Falha ao criar o usuário no Firebase Auth.");
  }

  try {
    await db.collection("usuarios").doc(userRecord.uid).set({
      nomeCompleto,
      email,
      perfil,
      recursoId,
      createdAt: Date.now(),
    });
  } catch (err) {
    return erroServidor(err, "Usuário criado no Auth, mas falhou ao gravar o perfil no Firestore.");
  }

  return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
}
