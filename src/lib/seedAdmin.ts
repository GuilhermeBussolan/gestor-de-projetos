import {
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { DOCUMENTOS_PADRAO, SEED_ADMIN } from "@/lib/constants";
import { firebaseErrorCode } from "@/lib/errors";

async function seedTiposDocumento() {
  const snap = await getDocs(collection(db, "tiposDocumento"));
  if (!snap.empty) return;
  await Promise.all(
    DOCUMENTOS_PADRAO.map((docPadrao, index) =>
      setDoc(doc(collection(db, "tiposDocumento")), {
        codigo: docPadrao.codigo,
        descricao: docPadrao.descricao,
        pesoIndividual: docPadrao.pesoIndividual,
        ordem: index,
      })
    )
  );
}

/**
 * Garante que exista ao menos um administrador. Executa uma única vez:
 * lê config/bootstrap (leitura pública); se não existe, cria o usuário
 * admin@empresa.com no Auth + Firestore e marca o bootstrap como feito.
 */
export async function seedAdminIfNeeded(): Promise<void> {
  const bootstrapRef = doc(db, "config", "bootstrap");
  const bootstrapSnap = await getDoc(bootstrapRef);
  if (bootstrapSnap.exists() && bootstrapSnap.data()?.adminCreated) {
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      SEED_ADMIN.email,
      SEED_ADMIN.senha
    );
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nomeCompleto: SEED_ADMIN.nomeCompleto,
      email: SEED_ADMIN.email,
      perfil: SEED_ADMIN.perfil,
      recursoId: null,
      createdAt: Date.now(),
    });
    await seedTiposDocumento();
    await setDoc(bootstrapRef, {
      adminCreated: true,
      createdAt: serverTimestamp(),
    });
    await signOut(auth);
  } catch (err) {
    if (firebaseErrorCode(err) === "auth/email-already-in-use") {
      await setDoc(bootstrapRef, {
        adminCreated: true,
        createdAt: serverTimestamp(),
      });
      return;
    }
    console.error("Falha ao criar admin seed:", err);
  }
}
