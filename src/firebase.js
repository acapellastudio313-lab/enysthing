// Import Firebase SDK terbaru
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigurasi Anda (Sudah sesuai dengan data pwaa-156d4)
const firebaseConfig = {
  apiKey: "AIzaSyC4JiCzv-rK2jtlgzXC1ZLS45bgyTS6bBA",
  authDomain: "pwaa-156d4.firebaseapp.com",
  projectId: "pwaa-156d4",
  storageBucket: "pwaa-156d4.firebasestorage.app",
  messagingSenderId: "255936810600",
  appId: "1:255936810600:web:09d41b1a437ef3f745f5dd",
  measurementId: "G-57Y891J2SC"
};

// Inisialisasi
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Fungsi untuk dipanggil di file lain (Otomatis Simpan)
export const dbSimpan = async (koleksi, data) => {
  try {
    const docRef = await addDoc(collection(db, koleksi), {
      ...data,
      waktu: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error("Error simpan data: ", e);
  }
};

export { db };