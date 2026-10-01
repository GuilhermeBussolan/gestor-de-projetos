import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Este app é inteiramente client-side (autenticação e dados vivem no navegador).
// O Firebase só é inicializado no browser para não quebrar a etapa de build/SSR
// do Next.js, que avalia os módulos client mesmo sem uma apiKey real disponível.
const isBrowser = typeof window !== "undefined";

export const app: FirebaseApp = isBrowser
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : (undefined as unknown as FirebaseApp);

/**
 * App Check (reCAPTCHA Enterprise): o Firebase só atende pedidos feitos de dentro deste site — bloqueia scripts e
 * robôs que usam a chave pública do Firebase por fora. Fica desligado enquanto a chave do reCAPTCHA não estiver
 * configurada (NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY). No localhost usa o token de depuração
 * (NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN, cadastrado em App Check > Gerenciar tokens de depuração), para o ambiente local
 * continuar funcionando depois que o bloqueio for ligado no console.
 */
const chaveRecaptcha = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (isBrowser && chaveRecaptcha && !(globalThis as { __appCheckIniciado?: boolean }).__appCheckIniciado) {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(chaveRecaptcha),
    isTokenAutoRefreshEnabled: true,
  });
  (globalThis as { __appCheckIniciado?: boolean }).__appCheckIniciado = true;
}

export const auth: Auth = isBrowser ? getAuth(app) : (undefined as unknown as Auth);
export const db: Firestore = isBrowser ? getFirestore(app) : (undefined as unknown as Firestore);
