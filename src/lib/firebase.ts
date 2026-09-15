import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
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

export const auth: Auth = isBrowser ? getAuth(app) : (undefined as unknown as Auth);
export const db: Firestore = isBrowser ? getFirestore(app) : (undefined as unknown as Firestore);
