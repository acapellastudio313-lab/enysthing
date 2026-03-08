import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD7xhsEmyPM5aKV1M9zvuQitnG1KRGdNsE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "koys-92fd5.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "koys-92fd5",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "koys-92fd5.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "60255465436",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:60255465436:web:c2b5530dde6ededfd2a919",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-W1NTF2JTGP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
