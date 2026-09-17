import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

function criarAppAdmin(): App {
  if (getApps().length) return getApps()[0];

  const chaveServico = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!chaveServico) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não configurada.");
  }

  return initializeApp({
    credential: cert(JSON.parse(chaveServico)),
  });
}

export function getAdminDb(): Firestore {
  return getFirestore(criarAppAdmin());
}

export function getAdminAuth(): Auth {
  return getAuth(criarAppAdmin());
}
