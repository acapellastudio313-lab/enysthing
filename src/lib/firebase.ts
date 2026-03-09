import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD7xhsEmyPM5aKV1M9zvuQitnG1KRGdNsE",
  authDomain: "koys-92fd5.firebaseapp.com",
  projectId: "koys-92fd5",
  storageBucket: "koys-92fd5.firebasestorage.app",
  messagingSenderId: "60255465436",
  appId: "1:60255465436:web:c2b5530dde6ededfd2a919",
  measurementId: "G-W1NTF2JTGP"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
