import { collection, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export const initializeDatabase = async () => {
  try {
    const settingsRef = collection(db, "settings");
    const settingsSnapshot = await getDocs(settingsRef);

    if (settingsSnapshot.empty) {
      console.log("Database is empty. Initializing default data...");
      const batch = writeBatch(db);

      // 1. Settings (Branding PA Prabumulih)
      const defaultSettings = [
        { id: "app_name", value: "E-Voting PA Prabumulih" },
        { id: "app_icon", value: "Shield" },
        { id: "candidate_label", value: "Agen Perubahan" },
        { id: "candidate_desc_label", value: "Visi & Misi" },
        { id: "voting_status", value: "open" }
      ];

      defaultSettings.forEach((setting) => {
        const ref = doc(db, "settings", setting.id);
        batch.set(ref, { value: setting.value });
      });

      // 2. Users (Admin and Candidates)
      const users = [
        { id: "admin", username: "admin", name: "Administrator", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin", role: "admin", password: "password", is_approved: 1, is_verified: 1 },
        { id: "ahmad", username: "ahmad", name: "Ahmad Hakim", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=ahmad", role: "candidate", password: "password", is_approved: 1, is_verified: 1 },
        { id: "budi", username: "budi", name: "Budi Santoso", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=budi", role: "candidate", password: "password", is_approved: 1, is_verified: 1 },
        { id: "citra", username: "citra", name: "Citra Lestari", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=citra", role: "candidate", password: "password", is_approved: 1, is_verified: 1 },
        { id: "dina", username: "dina", name: "Dina Mariana", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=dina", role: "voter", password: "password", is_approved: 1, is_verified: 1 }
      ];

      users.forEach((user) => {
        const ref = doc(db, "users", user.id);
        batch.set(ref, user);
      });

      // 3. Candidates
      const candidates = [
        { id: "ahmad", user_id: "ahmad", vision: "Mewujudkan PA Prabumulih yang Modern dan Melayani", mission: "1. Digitalisasi layanan\n2. Peningkatan SDM" },
        { id: "budi", user_id: "budi", vision: "Pelayanan Prima untuk Masyarakat Pencari Keadilan", mission: "1. Mempercepat proses administrasi\n2. Budaya senyum sapa salam" },
        { id: "citra", user_id: "citra", vision: "Integritas dan Transparansi dalam Setiap Layanan", mission: "1. Keterbukaan informasi\n2. Anti korupsi dan gratifikasi" }
      ];

      candidates.forEach((candidate) => {
        const ref = doc(db, "candidates", candidate.id);
        batch.set(ref, candidate);
      });

      await batch.commit();
      console.log("Default data initialized successfully!");
    } else {
      console.log("Database already initialized.");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};
