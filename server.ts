import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const db = new Database('app.db');
db.exec('PRAGMA foreign_keys = ON');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    name TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'voter',
    cover_url TEXT,
    bio TEXT,
    location TEXT,
    join_date TEXT,
    cover_position TEXT DEFAULT '50% 50%',
    avatar_position TEXT DEFAULT '50% 50%',
    is_verified INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    vision TEXT,
    mission TEXT,
    innovation_program TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER,
    content TEXT,
    image_url TEXT,
    audio_url TEXT,
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    author_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(author_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS likes (
    post_id INTEGER,
    user_id INTEGER,
    PRIMARY KEY(post_id, user_id),
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS votes (
    voter_id INTEGER PRIMARY KEY,
    candidate_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(voter_id) REFERENCES users(id),
    FOREIGN KEY(candidate_id) REFERENCES candidates(id)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    actor_id INTEGER,
    type TEXT,
    post_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(actor_id) REFERENCES users(id),
    FOREIGN KEY(post_id) REFERENCES posts(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);
console.log('Settings table ensured');

db.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    media_url TEXT,
    media_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    text_overlays TEXT DEFAULT '[]',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);
console.log('Stories table ensured');

db.exec(`
  CREATE TABLE IF NOT EXISTS story_views (
    story_id INTEGER,
    user_id INTEGER,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (story_id, user_id),
    FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);
console.log('Story views table ensured');

db.exec(`
  CREATE TABLE IF NOT EXISTS story_tags (
    story_id INTEGER,
    tagged_user_id INTEGER,
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY(tagged_user_id) REFERENCES users(id)
  );
`);
console.log('Story tags table ensured');

// Add columns if they don't exist (for backward compatibility with existing databases)
try { db.exec(`ALTER TABLE stories ADD COLUMN text_overlays TEXT DEFAULT '[]'`); } catch (e) {}
try { db.exec(`ALTER TABLE story_tags ADD COLUMN x REAL DEFAULT 0`); } catch (e) {}
try { db.exec(`ALTER TABLE story_tags ADD COLUMN y REAL DEFAULT 0`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN cover_url TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN location TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN join_date TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN cover_position TEXT DEFAULT '50% 50%'`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar_position TEXT DEFAULT '50% 50%'`); } catch (e) {}
try { db.exec(`ALTER TABLE candidates ADD COLUMN innovation_program TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE candidates ADD COLUMN image_url TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1`); } catch (e) {}
try { db.exec(`ALTER TABLE posts ADD COLUMN audio_url TEXT`); } catch (e) {}
try { db.exec(`ALTER TABLE posts ADD COLUMN is_pinned INTEGER DEFAULT 0`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN password TEXT`); } catch (e) {}

// Set default passwords
db.prepare("UPDATE users SET password = 'password' WHERE password IS NULL AND username != 'admin'").run();
db.prepare("UPDATE users SET password = 'admins' WHERE username = 'admin'").run();

// Initialize settings
const status = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_status');
if (!status) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('election_status', 'not_started');
}

const endDate = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_end_date');
if (!endDate) {
  // Default to 7 days from now
  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 7);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('election_end_date', defaultEndDate.toISOString());
}

const leaderboardTitle = db.prepare('SELECT value FROM settings WHERE key = ?').get('leaderboard_title');
if (!leaderboardTitle) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('leaderboard_title', 'Klasemen Sementara');
}

const leaderboardDesc = db.prepare('SELECT value FROM settings WHERE key = ?').get('leaderboard_description');
if (!leaderboardDesc) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('leaderboard_description', 'Pemilihan Agen Perubahan 2024');
}

const exploreTitle = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_title');
if (!exploreTitle) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('explore_title', 'Informasi Pemilihan');
}

const exploreSchedule = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_schedule');
if (!exploreSchedule) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('explore_schedule', '1 - 15 November 2024');
}

const exploreRequirement = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_requirement');
if (!exploreRequirement) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('explore_requirement', 'Seluruh Pegawai PA Prabumulih');
}

const exploreHelp = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_help');
if (!exploreHelp) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('explore_help', 'Hubungi panitia jika mengalami kendala saat melakukan voting.');
}

const candidateLabel = db.prepare('SELECT value FROM settings WHERE key = ?').get('candidate_label');
if (!candidateLabel) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('candidate_label', 'Agen Perubahan');
}

const candidateDescLabel = db.prepare('SELECT value FROM settings WHERE key = ?').get('candidate_desc_label');
if (!candidateDescLabel) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('candidate_desc_label', 'Visi & Misi');
}

const appName = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_name');
if (!appName) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('app_name', 'E-Voting App');
}

const appIcon = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_icon');
if (!appIcon) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('app_icon', 'Shield');
}

// Seed data
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (username, name, avatar, role, password) VALUES (?, ?, ?, ?, ?)');
  insertUser.run('admin', 'Administrator', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'admin', 'admins');
  insertUser.run('ahmad', 'Ahmad Hakim', 'https://api.dicebear.com/7.x/avataaars/svg?seed=ahmad', 'candidate', 'password');
  insertUser.run('budi', 'Budi Santoso', 'https://api.dicebear.com/7.x/avataaars/svg?seed=budi', 'candidate', 'password');
  insertUser.run('citra', 'Citra Lestari', 'https://api.dicebear.com/7.x/avataaars/svg?seed=citra', 'candidate', 'password');
  insertUser.run('dina', 'Dina Mariana', 'https://api.dicebear.com/7.x/avataaars/svg?seed=dina', 'voter', 'password');
  insertUser.run('eko', 'Eko Prasetyo', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eko', 'voter', 'password');

  const insertCandidate = db.prepare('INSERT INTO candidates (user_id, vision, mission) VALUES (?, ?, ?)');
  insertCandidate.run(2, 'Mewujudkan PA Prabumulih yang Modern dan Melayani', '1. Digitalisasi layanan\\n2. Peningkatan SDM');
  insertCandidate.run(3, 'Pelayanan Prima untuk Masyarakat Pencari Keadilan', '1. Mempercepat proses administrasi\\n2. Budaya senyum sapa salam');
  insertCandidate.run(4, 'Integritas dan Transparansi dalam Setiap Layanan', '1. Keterbukaan informasi\\n2. Anti korupsi dan gratifikasi');

  const insertPost = db.prepare('INSERT INTO posts (author_id, content) VALUES (?, ?)');
  insertPost.run(2, 'Mari bersama-sama mewujudkan Pengadilan Agama Prabumulih yang lebih baik! Dukung saya menjadi Agen Perubahan 2024. 🚀 #PA_Prabumulih #AgenPerubahan');
  insertPost.run(3, 'Pelayanan prima adalah kunci. Saya berkomitmen untuk membawa perubahan positif di lingkungan kerja kita. Mohon doa dan dukungannya! 🙏');
  insertPost.run(4, 'Integritas bukan hanya kata-kata, tapi tindakan nyata. Mari kita bangun zona integritas bersama-sama! ⚖️');
  insertPost.run(5, 'Wah, calon-calon tahun ini luar biasa semua! Bingung mau pilih siapa 🤔');
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    console.log(`[WS] Broadcasting ${data.type} to ${wss.clients.size} clients`);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
  });

  app.put('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    const { name, username, avatar, cover_url, bio, location, join_date, cover_position, avatar_position } = req.body;
    
    try {
      // Check if username is already taken by another user
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, userId);
      if (existingUser) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }

      db.prepare(`
        UPDATE users 
        SET name = ?, username = ?, avatar = ?, cover_url = ?, bio = ?, location = ?, join_date = ?, cover_position = ?, avatar_position = ? 
        WHERE id = ?
      `).run(
        name, username, avatar, cover_url || null, 
        bio || null, location || null, join_date || null, 
        cover_position || '50% 50%', avatar_position || '50% 50%', 
        userId
      );
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      res.json(updatedUser);
    } catch (e) {
      res.status(500).json({ error: 'Gagal memperbarui profil' });
    }
  });

  app.post('/api/register', (req, res) => {
    const { name, username, bio, password } = req.body;
    
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username, and password are required' });
    }

    try {
      // Check if username exists
      const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
      const result = db.prepare('INSERT INTO users (name, username, avatar, bio, role, password, is_approved) VALUES (?, ?, ?, ?, ?, ?, 0)').run(name, username, avatar, bio || '', 'voter', password);
      
      const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      
      // Notify all admins
      const admins = db.prepare('SELECT id FROM users WHERE role = ?').all('admin') as { id: number }[];
      const notifyStmt = db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id, is_read) VALUES (?, ?, ?, ?, 0)');
      
      for (const admin of admins) {
        notifyStmt.run(admin.id, newUser.id, 'register', null);
      }

      broadcast({
        type: 'user:register',
        user: newUser,
        admins: admins.map(a => a.id)
      });

      res.status(201).json({ message: 'Pendaftaran berhasil. Silakan tunggu persetujuan admin.' });
    } catch (e) {
      console.error('Registration error:', e);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
      
      if (user) {
        if (user.is_approved === 0 && user.role !== 'admin') {
          return res.status(403).json({ error: 'Akun Anda belum disetujui oleh admin' });
        }
        res.json(user);
      } else {
        res.status(401).json({ error: 'Invalid username or password' });
      }
    } catch (e) {
      console.error('Login error:', e);
      res.status(500).json({ error: 'Failed to login' });
    }
  });

  app.get('/api/candidates', (req, res) => {
    const candidates = db.prepare(`
      SELECT c.*, u.name, u.avatar, u.username 
      FROM candidates c 
      JOIN users u ON c.user_id = u.id
    `).all();
    res.json(candidates);
  });

  app.post('/api/candidates', (req, res) => {
    const { user_id, vision, mission, innovation_program, image_url } = req.body;
    try {
      db.prepare('BEGIN TRANSACTION').run();
      
      const result = db.prepare('INSERT INTO candidates (user_id, vision, mission, innovation_program, image_url) VALUES (?, ?, ?, ?, ?)').run(user_id, vision, mission, innovation_program, image_url || null);
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('candidate', user_id);
      
      db.prepare('COMMIT').run();
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      db.prepare('ROLLBACK').run();
      res.status(500).json({ error: 'Failed to add candidate' });
    }
  });

  app.put('/api/candidates/:userId', (req, res) => {
    const userId = req.params.userId;
    const { vision, mission, innovation_program, image_url } = req.body;
    
    try {
      db.prepare('UPDATE candidates SET vision = ?, mission = ?, innovation_program = ?, image_url = ? WHERE user_id = ?').run(vision, mission, innovation_program, image_url || null, userId);
      const updatedCandidate = db.prepare('SELECT * FROM candidates WHERE user_id = ?').get(userId);
      res.json(updatedCandidate);
    } catch (e) {
      res.status(500).json({ error: 'Gagal memperbarui kampanye' });
    }
  });

  app.post('/api/admin/candidates', (req, res) => {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    try {
      db.prepare('BEGIN TRANSACTION').run();
      
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
      if (!user) {
        db.prepare('ROLLBACK').run();
        return res.status(404).json({ error: 'User not found' });
      }

      const existingCandidate = db.prepare('SELECT 1 FROM candidates WHERE user_id = ?').get(user_id);
      if (existingCandidate) {
        db.prepare('ROLLBACK').run();
        return res.status(400).json({ error: 'User is already a candidate' });
      }
      
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('candidate', user_id);
      const result = db.prepare('INSERT INTO candidates (user_id, vision, mission, innovation_program) VALUES (?, ?, ?, ?)').run(user_id, '', '', '');
      
      db.prepare('COMMIT').run();
      res.json({ id: result.lastInsertRowid, user_id: user_id });
    } catch (e) {
      db.prepare('ROLLBACK').run();
      console.error(e);
      res.status(500).json({ error: 'Failed to add candidate' });
    }
  });

  app.put('/api/admin/candidates/:id', (req, res) => {
    const candidateId = req.params.id;
    const { name, username, avatar, vision, mission, innovation_program, image_url } = req.body;
    
    try {
      db.prepare('BEGIN TRANSACTION').run();
      
      const candidate = db.prepare('SELECT user_id FROM candidates WHERE id = ?').get(candidateId) as { user_id: number };
      if (!candidate) {
        db.prepare('ROLLBACK').run();
        return res.status(404).json({ error: 'Kandidat tidak ditemukan' });
      }
      
      const existing = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, candidate.user_id);
      if (existing) {
        db.prepare('ROLLBACK').run();
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }
      
      db.prepare('UPDATE users SET name = ?, username = ?, avatar = ? WHERE id = ?').run(name, username, avatar, candidate.user_id);
      db.prepare('UPDATE candidates SET vision = ?, mission = ?, innovation_program = ?, image_url = ? WHERE id = ?').run(vision, mission, innovation_program, image_url || null, candidateId);
      
      db.prepare('COMMIT').run();
      res.json({ success: true });
    } catch (e) {
      db.prepare('ROLLBACK').run();
      res.status(500).json({ error: 'Gagal memperbarui kandidat' });
    }
  });

  app.delete('/api/candidates/:id', (req, res) => {
    const candidateId = Number(req.params.id);
    const adminId = Number(req.body.adminId || req.query.adminId);

    console.log(`[API] Admin ${adminId} attempting to delete candidate ${candidateId}`);

    try {
      if (!adminId || isNaN(adminId)) {
        return res.status(401).json({ error: 'Unauthorized: No valid admin ID provided' });
      }

      const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId) as { role: string } | undefined;
      if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      db.prepare('BEGIN TRANSACTION').run();
      try {
        const candidate = db.prepare('SELECT user_id FROM candidates WHERE id = ?').get(candidateId) as { user_id: number } | undefined;
        if (candidate) {
          db.prepare('UPDATE users SET role = ? WHERE id = ?').run('voter', candidate.user_id);
          db.prepare('DELETE FROM votes WHERE candidate_id = ?').run(candidateId);
          db.prepare('DELETE FROM candidates WHERE id = ?').run(candidateId);
        }
        
        db.prepare('COMMIT').run();
        console.log(`[API] Candidate ${candidateId} deleted successfully`);
        res.json({ success: true });
      } catch (transactionError) {
        db.prepare('ROLLBACK').run();
        throw transactionError;
      }
    } catch (e) {
      console.error('Error deleting candidate:', e);
      res.status(500).json({ error: 'Gagal menghapus kandidat: ' + (e instanceof Error ? e.message : String(e)) });
    }
  });

  app.get('/api/search', (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json({ posts: [], users: [] });
    
    const searchTerm = `%${q}%`;
    
    const posts = db.prepare(`
      SELECT p.id, p.content, p.created_at, u.name, u.avatar, u.username, p.author_id
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.content LIKE ? OR u.name LIKE ? OR u.username LIKE ?
      ORDER BY p.created_at DESC
      LIMIT 5
    `).all(searchTerm, searchTerm, searchTerm);
    
    const users = db.prepare(`
      SELECT id, name, username, avatar, role
      FROM users
      WHERE name LIKE ? OR username LIKE ?
      LIMIT 5
    `).all(searchTerm, searchTerm);
    
    res.json({ posts, users });
  });

  // Messaging Endpoints
  app.get('/api/messages/conversations/:userId', (req, res) => {
    const userId = req.params.userId;
    const conversations = db.prepare(`
      SELECT 
        u.id, u.name, u.username, u.avatar,
        m.content as last_message,
        m.created_at as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND sender_id = u.id AND is_read = 0) as unread_count
      FROM users u
      JOIN (
        SELECT 
          CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
          MAX(id) as max_id
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
        GROUP BY other_user_id
      ) last_msgs ON u.id = last_msgs.other_user_id
      JOIN messages m ON m.id = last_msgs.max_id
      ORDER BY m.created_at DESC
    `).all(userId, userId, userId, userId);
    res.json(conversations);
  });

  app.get('/api/messages/:userId/:otherUserId', (req, res) => {
    const { userId, otherUserId } = req.params;
    
    // Mark messages as read
    db.prepare('UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?').run(userId, otherUserId);
    
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `).all(userId, otherUserId, otherUserId, userId);
    res.json(messages);
  });

  app.post('/api/messages', (req, res) => {
    const { sender_id, receiver_id, content } = req.body;
    try {
      const result = db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)').run(sender_id, receiver_id, content);
      const newMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      
      const sender = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(sender_id) as { id: number, name: string, avatar: string };

      broadcast({
        type: 'message:received',
        sender: { id: sender.id, name: sender.name, avatar: sender.avatar },
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        recipientId: receiver_id
      });

      res.json(newMessage);
    } catch (e) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // --- STORIES API ---
  app.get('/api/stories', (req, res) => {
    try {
      const stories = db.prepare(`
        SELECT s.*, u.name as user_name, u.avatar as user_avatar 
        FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE s.expires_at > datetime('now')
        ORDER BY s.created_at DESC
      `).all();
      
      // Fetch tags and views for each story
      const storiesWithDetails = stories.map((story: any) => {
        const tags = db.prepare(`
          SELECT u.id, u.username, u.name, st.x, st.y
          FROM story_tags st
          JOIN users u ON st.tagged_user_id = u.id
          WHERE st.story_id = ?
        `).all(story.id);
        
        const views = db.prepare(`
          SELECT u.id, u.username, u.name, u.avatar, sv.viewed_at
          FROM story_views sv
          JOIN users u ON sv.user_id = u.id
          WHERE sv.story_id = ?
          ORDER BY sv.viewed_at DESC
        `).all(story.id);
        
        return {
          ...story,
          text_overlays: JSON.parse(story.text_overlays || '[]'),
          tags,
          views
        };
      });
      
      res.json(storiesWithDetails);
    } catch (e) {
      console.error('Error fetching stories:', e);
      res.status(500).json({ error: 'Failed to fetch stories' });
    }
  });

  app.post('/api/stories', (req, res) => {
    const { user_id, media_url, media_type, text_overlays, tags } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO stories (user_id, media_url, media_type, expires_at, text_overlays) 
        VALUES (?, ?, ?, datetime('now', '+24 hours'), ?)
      `);
      const info = stmt.run(user_id, media_url, media_type, JSON.stringify(text_overlays || []));
      const storyId = info.lastInsertRowid;
      
      // Insert tags
      if (tags && Array.isArray(tags)) {
        const tagStmt = db.prepare('INSERT INTO story_tags (story_id, tagged_user_id, x, y) VALUES (?, ?, ?, ?)');
        const getAuthor = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id) as { name: string };
        
        tags.forEach(tag => {
          try {
            const taggedUserId = typeof tag === 'object' ? tag.id : tag;
            const x = typeof tag === 'object' ? tag.x || 0 : 0;
            const y = typeof tag === 'object' ? tag.y || 0 : 0;
            
            tagStmt.run(storyId, taggedUserId, x, y);
            
            // Create notification for tagged user
            db.prepare(`
              INSERT INTO notifications (user_id, type, source_user_id, source_id, content) 
              VALUES (?, 'story_tag', ?, ?, ?)
            `).run(taggedUserId, user_id, storyId, `${getAuthor.name} menandai Anda dalam cerita mereka.`);
            
            broadcast({
              type: 'notification',
              recipientId: taggedUserId,
              message: `${getAuthor.name} menandai Anda dalam cerita mereka.`
            });
          } catch (e) {
            console.error('Error adding tag:', e);
          }
        });
      }

      const story = db.prepare(`
        SELECT s.*, u.name as user_name, u.avatar as user_avatar 
        FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
      `).get(storyId);
      
      const storyWithDetails = {
        ...story,
        text_overlays: JSON.parse((story as any).text_overlays || '[]'),
        tags: tags || [],
        views: []
      };
      
      broadcast({ type: 'story:created', story: storyWithDetails });
      res.json(storyWithDetails);
    } catch (e) {
      console.error('Error creating story:', e);
      res.status(500).json({ error: 'Failed to create story' });
    }
  });

  app.post('/api/stories/:id/view', (req, res) => {
    const storyId = req.params.id;
    const { user_id } = req.body;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO story_views (story_id, user_id) 
        VALUES (?, ?)
      `).run(storyId, user_id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to record view' });
    }
  });

  app.get('/api/posts', (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const posts = db.prepare(`
      SELECT p.*, u.name, u.avatar, u.username, u.is_verified,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.is_pinned DESC, p.created_at DESC
    `).all(userId);
    res.json(posts);
  });

  app.put('/api/admin/posts/:id/pin', (req, res) => {
    const postId = req.params.id;
    const { is_pinned } = req.body;
    try {
      db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?').run(is_pinned ? 1 : 0, postId);
      res.json({ success: true, is_pinned });
    } catch (e) {
      res.status(500).json({ error: 'Failed to pin post' });
    }
  });

  app.get('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    const userId = req.query.userId ? Number(req.query.userId) : null;
    
    const post = db.prepare(`
      SELECT p.*, u.name, u.avatar, u.username, u.is_verified,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(userId, postId);
    
    if (post) {
      res.json(post);
    } else {
      res.status(404).json({ error: 'Post not found' });
    }
  });

  app.post('/api/posts', (req, res) => {
    const { author_id, content, image_url, audio_url } = req.body;
    try {
      const result = db.prepare('INSERT INTO posts (author_id, content, image_url, audio_url) VALUES (?, ?, ?, ?)').run(author_id, content, image_url || null, audio_url || null);
      const postId = result.lastInsertRowid;
      
      // Fetch the full post data to broadcast
      const newPost = db.prepare(`
        SELECT p.*, u.name, u.avatar, u.username, u.is_verified,
          0 as likes_count,
          0 as comments_count,
          0 as is_liked
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.id = ?
      `).get(postId) as any;

      broadcast({ 
        type: 'post:created', 
        post: newPost,
        actor: { id: newPost.author_id, name: newPost.name, avatar: newPost.avatar }
      });
      
      res.json({ id: postId });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create post' });
    }
  });

  app.put('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    const { content, userId } = req.body;

    try {
      const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as { author_id: number };
      if (!post || post.author_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db.prepare('UPDATE posts SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, postId);
      const updatedPost = db.prepare(`
        SELECT p.*, u.name, u.avatar, u.username, u.is_verified,
          (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
          EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.id = ?
      `).get(userId, postId);

      broadcast({ type: 'post:updated', post: updatedPost });
      res.json(updatedPost);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update post' });
    }
  });

  app.delete('/api/posts/:id', (req, res) => {
    const postId = req.params.id;
    const { userId } = req.body; // ID of the user performing the action

    try {
      const requestingUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string };
      if (!requestingUser) {
        return res.status(401).json({ error: 'Unauthorized: User not found' });
      }

      const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as { author_id: number };
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const isAdmin = requestingUser.role === 'admin';
      const isAuthor = post.author_id === userId;

      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this post' });
      }

      db.prepare('BEGIN').run();
      db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
      db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
      db.prepare('DELETE FROM notifications WHERE post_id = ?').run(postId);
      db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
      db.prepare('COMMIT').run();

      broadcast({ type: 'post:deleted', postId });
      res.json({ success: true });
    } catch (e) {
      console.error(`[API] Failed to delete post ${postId}:`, e);
      db.prepare('ROLLBACK').run();
      res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  app.post('/api/posts/:id/like', (req, res) => {
    const { userId } = req.body;
    const postId = req.params.id;
    
    const existing = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
      res.json({ liked: false });
    } else {
      db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(postId, userId);
      
      const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as { author_id: number } | undefined;
      const actor = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(userId) as { id: number, name: string, avatar: string };

      if (post && post.author_id !== userId) {
        db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)').run(post.author_id, userId, 'like', postId);
        
        broadcast({
          type: 'post:liked',
          actor: { id: actor.id, name: actor.name, avatar: actor.avatar },
          postId: Number(postId),
          recipientId: post.author_id
        });
      }
      
      res.json({ liked: true });
    }
  });

  app.get('/api/posts/:id/comments', (req, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.name, u.avatar, u.username
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(req.params.id);
    res.json(comments);
  });

  app.post('/api/posts/:id/comment', (req, res) => {
    const { author_id, content } = req.body;
    const postId = req.params.id;
    const result = db.prepare('INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)').run(postId, author_id, content);
    
    const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as { author_id: number } | undefined;
    const actor = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(author_id) as { id: number, name: string, avatar: string };

    if (post && post.author_id !== author_id) {
      db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)').run(post.author_id, author_id, 'comment', postId);
      
      broadcast({
        type: 'post:commented',
        actor: { id: actor.id, name: actor.name, avatar: actor.avatar },
        postId: Number(postId),
        recipientId: post.author_id,
        content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      });
    }
    
    res.json({ id: result.lastInsertRowid });
  });

  app.delete('/api/comments/:id', (req, res) => {
    const commentId = Number(req.params.id);
    const userId = Number(req.body.userId || req.query.userId);

    console.log(`[API] Attempting to delete comment ${commentId} by user ${userId}`);

    try {
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: No user ID provided' });
      }

      const requestingUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as { id: number, role: string } | undefined;
      if (!requestingUser) {
        return res.status(401).json({ error: 'Unauthorized: User not found' });
      }

      const comment = db.prepare('SELECT author_id FROM comments WHERE id = ?').get(commentId) as { author_id: number } | undefined;
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const isAdmin = requestingUser.role === 'admin';
      const isAuthor = Number(comment.author_id) === userId;

      if (!isAdmin && !isAuthor) {
        console.log(`[API] Forbidden: User ${userId} (role: ${requestingUser.role}) tried to delete comment ${commentId} owned by ${comment.author_id}`);
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this comment' });
      }

      db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
      console.log(`[API] Comment ${commentId} deleted successfully`);
      res.json({ success: true });
    } catch (e) {
      console.error('Error deleting comment:', e);
      res.status(500).json({ error: 'Failed to delete comment: ' + (e instanceof Error ? e.message : String(e)) });
    }
  });

  app.get('/api/settings/status', (req, res) => {
    try {
      const statusRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_status') as { value: string } | undefined;
      const endDateRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_end_date') as { value: string } | undefined;
      
      let status = statusRow?.value || 'not_started';
      const endDate = endDateRow?.value || null;
      
      if (status === 'in_progress' && endDate) {
        const endDateTime = new Date(endDate);
        if (new Date() > endDateTime) {
          status = 'closed';
          db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('closed', 'election_status');
          broadcast({ type: 'election:status_changed', status: 'closed' });
        }
      }
      
      res.json({ status, endDate });
    } catch (e) {
      console.error('Error fetching status:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/settings/end-date', (req, res) => {
    try {
      const endDate = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_end_date') as { value: string } | undefined;
      res.json({ endDate: endDate?.value || null });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/settings/leaderboard', (req, res) => {
    try {
      const title = db.prepare('SELECT value FROM settings WHERE key = ?').get('leaderboard_title') as { value: string } | undefined;
      const description = db.prepare('SELECT value FROM settings WHERE key = ?').get('leaderboard_description') as { value: string } | undefined;
      res.json({ 
        title: title?.value || 'Klasemen Sementara', 
        description: description?.value || 'Pemilihan Agen Perubahan 2024' 
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/admin/settings/leaderboard', (req, res) => {
    const { title, description } = req.body;
    try {
      if (title) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('leaderboard_title', title);
      if (description) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('leaderboard_description', description);
      
      broadcast({ type: 'settings:updated', section: 'leaderboard' });
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update leaderboard settings' });
    }
  });

  app.get('/api/settings/notification', (req, res) => {
    try {
      const notification = db.prepare('SELECT value FROM settings WHERE key = ?').get('global_notification') as { value: string } | undefined;
      res.json({ notification: notification?.value || null });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/admin/settings/notification', (req, res) => {
    const { notification } = req.body;
    try {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('global_notification', notification);
      broadcast({ type: 'settings:updated', section: 'notification', notification });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update notification' });
    }
  });

  app.get('/api/settings/general', (req, res) => {
    try {
      const appName = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_name') as { value: string } | undefined;
      const appSubtitle = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_subtitle') as { value: string } | undefined;
      const appLogoUrl = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_logo_url') as { value: string } | undefined;
      const appIcon = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_icon') as { value: string } | undefined;
      const candidateLabel = db.prepare('SELECT value FROM settings WHERE key = ?').get('candidate_label') as { value: string } | undefined;
      const candidateDescLabel = db.prepare('SELECT value FROM settings WHERE key = ?').get('candidate_desc_label') as { value: string } | undefined;
      
      res.json({ 
        appName: appName?.value || 'E-Voting App',
        appSubtitle: appSubtitle?.value || 'Aplikasi Pemilihan',
        appLogoUrl: appLogoUrl?.value || '',
        appIcon: appIcon?.value || 'Shield',
        candidateLabel: candidateLabel?.value || 'Agen Perubahan',
        candidateDescLabel: candidateDescLabel?.value || 'Visi & Misi'
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/admin/settings/general', (req, res) => {
    const { appName, appSubtitle, appLogoUrl, appIcon, candidateLabel, candidateDescLabel } = req.body;
    try {
      if (appName !== undefined) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_name', appName);
      if (appSubtitle !== undefined) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_subtitle', appSubtitle);
      if (appLogoUrl !== undefined) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_logo_url', appLogoUrl);
      if (appIcon !== undefined) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_icon', appIcon);
      if (candidateLabel !== undefined) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('candidate_label', candidateLabel);
      if (candidateDescLabel !== undefined) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('candidate_desc_label', candidateDescLabel);
      
      broadcast({ type: 'settings:updated', section: 'general' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update general settings' });
    }
  });

  app.get('/api/settings/explore', (req, res) => {
    try {
      const title = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_title') as { value: string } | undefined;
      const schedule = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_schedule') as { value: string } | undefined;
      const requirement = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_requirement') as { value: string } | undefined;
      const help = db.prepare('SELECT value FROM settings WHERE key = ?').get('explore_help') as { value: string } | undefined;
      res.json({ 
        title: title?.value || 'Informasi Pemilihan', 
        schedule: schedule?.value || '1 - 15 November 2024',
        requirement: requirement?.value || 'Seluruh Pegawai PA Prabumulih',
        help: help?.value || 'Hubungi panitia jika mengalami kendala saat melakukan voting.'
      });
    } catch (e) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/settings/candidate_page', (req, res) => {
    const title = db.prepare('SELECT value FROM settings WHERE key = ?').get('candidate_page_title') as { value: string } | undefined;
    const description = db.prepare('SELECT value FROM settings WHERE key = ?').get('candidate_page_description') as { value: string } | undefined;
    res.json({ 
      title: title ? title.value : 'Kandidat Agen Perubahan',
      description: description ? description.value : 'Berikut adalah para kandidat yang akan bersaing untuk menjadi Agen Perubahan Pengadilan Agama Prabumulih periode selanjutnya. Berikan dukungan Anda!'
    });
  });

  app.put('/api/admin/settings/explore', (req, res) => {
    const { title, schedule, requirement, help } = req.body;
    try {
      if (title) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('explore_title', title);
      if (schedule) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('explore_schedule', schedule);
      if (requirement) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('explore_requirement', requirement);
      if (help) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('explore_help', help);
      
      broadcast({ type: 'settings:updated', section: 'explore' });
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update explore settings' });
    }
  });

  app.put('/api/admin/settings/candidate_page', (req, res) => {
    const { title, description } = req.body;
    try {
      if (title) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('candidate_page_title', title);
      if (description) db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('candidate_page_description', description);
      
      broadcast({ type: 'settings:updated', section: 'candidate_page' });
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update candidate page settings' });
    }
  });

  app.put('/api/admin/settings/end-date', (req, res) => {
    const { endDate } = req.body;
    try {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('election_end_date', endDate);
      
      broadcast({ type: 'settings:updated', section: 'end_date', endDate });
      
      res.json({ success: true, endDate });
    } catch (e) {
      console.error('Error updating election end date:', e);
      res.status(500).json({ error: 'Failed to update election end date' });
    }
  });

  app.put('/api/admin/settings/status', (req, res) => {
    const { status } = req.body;
    console.log('Updating election status to:', status);

    if (!['not_started', 'in_progress', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const info = stmt.run('election_status', status);
      console.log('Update result:', info);
      
      // Verify the update
      const current = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_status') as { value: string };
      if (current?.value !== status) {
        throw new Error('Verification failed: status mismatch');
      }

      broadcast({ type: 'election:status_changed', status: current.value });

      res.json({ success: true, status: current.value });
    } catch (e) {
      console.error('Error updating election status:', e);
      res.status(500).json({ error: 'Failed to update election status' });
    }
  });

  app.post('/api/vote', (req, res) => {
    const { voter_id, candidate_id } = req.body;
    
    // Check election status
    const statusRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_status') as { value: string };
    const endDateRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_end_date') as { value: string };
    
    let status = statusRow?.value || 'not_started';
    if (status === 'in_progress' && endDateRow?.value) {
      if (new Date() > new Date(endDateRow.value)) {
        status = 'closed';
        db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('closed', 'election_status');
        broadcast({ type: 'election:status_changed', status: 'closed' });
      }
    }

    if (status !== 'in_progress') {
      return res.status(403).json({ error: 'Pemilihan sedang tidak berlangsung' });
    }

    try {
      db.prepare('INSERT INTO votes (voter_id, candidate_id) VALUES (?, ?)').run(voter_id, candidate_id);
      
      const actor = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(voter_id) as { id: number, name: string, avatar: string };
      const candidate = db.prepare('SELECT u.name FROM candidates c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(candidate_id) as { name: string };

      broadcast({
        type: 'vote:cast',
        actor: { id: actor.id, name: actor.name, avatar: actor.avatar },
        candidateName: candidate.name
      });

      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'Already voted' });
    }
  });

  app.get('/api/leaderboard', (req, res) => {
    const results = db.prepare(`
      SELECT c.id, u.name, u.avatar, u.username, COUNT(v.candidate_id) as vote_count
      FROM candidates c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id
      ORDER BY vote_count DESC
    `).all();
    res.json(results);
  });

  app.get('/api/non-voters', (req, res) => {
    try {
      const nonVoters = db.prepare(`
        SELECT id, name, username, avatar
        FROM users
        WHERE id NOT IN (SELECT voter_id FROM votes)
        AND role != 'admin'
        AND is_approved = 1
      `).all();
      res.json(nonVoters);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch non-voters' });
    }
  });

  app.get('/api/my-vote', (req, res) => {
    const userId = req.query.userId;
    const vote = db.prepare('SELECT candidate_id FROM votes WHERE voter_id = ?').get(userId);
    res.json(vote || null);
  });

  app.get('/api/notifications', (req, res) => {
    const userId = req.query.userId;
    const notifications = db.prepare(`
      SELECT n.*, u.name as actor_name, u.avatar as actor_avatar 
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(userId);
    res.json(notifications);
  });

  app.get('/api/notifications/unread-count', (req, res) => {
    const userId = req.query.userId;
    const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);
    res.json(count);
  });

  app.post('/api/notifications/mark-read', (req, res) => {
    const { userId } = req.body;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
    res.json({ success: true });
  });

  // Admin Endpoints
  app.get('/api/admin/stats', (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get() as { count: number };
    const voteCount = db.prepare('SELECT COUNT(*) as count FROM votes').get() as { count: number };
    const candidateCount = db.prepare('SELECT COUNT(*) as count FROM candidates').get() as { count: number };
    
    res.json({
      users: userCount.count,
      posts: postCount.count,
      votes: voteCount.count,
      candidates: candidateCount.count
    });
  });

  app.delete('/api/admin/users/:id', (req, res) => {
    const userIdToDelete = Number(req.params.id);
    const adminId = Number(req.body.adminId || req.query.adminId);

    console.log(`[API] Admin ${adminId} attempting to delete user ${userIdToDelete}`);

    try {
      if (!adminId || isNaN(adminId)) {
        return res.status(401).json({ error: 'Unauthorized: No valid admin ID provided' });
      }

      if (isNaN(userIdToDelete)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }

      const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId) as { role: string } | undefined;
      if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      if (userIdToDelete === adminId) {
        return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri' });
      }

      // Check if user exists
      const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userIdToDelete);
      if (!userExists) {
        return res.status(404).json({ error: 'User tidak ditemukan' });
      }

      // Use a manual transaction for maximum control
      db.prepare('BEGIN TRANSACTION').run();
      try {
        // 1. Delete votes for this candidate (if they are one)
        const candidate = db.prepare('SELECT id FROM candidates WHERE user_id = ?').get(userIdToDelete) as { id: number } | undefined;
        if (candidate) {
          db.prepare('DELETE FROM votes WHERE candidate_id = ?').run(candidate.id);
        }

        // 2. Delete votes cast by this user
        db.prepare('DELETE FROM votes WHERE voter_id = ?').run(userIdToDelete);

        // 3. Delete candidates entry
        db.prepare('DELETE FROM candidates WHERE user_id = ?').run(userIdToDelete);

        // 4. Delete user's posts and their related data
        const userPosts = db.prepare('SELECT id FROM posts WHERE author_id = ?').all(userIdToDelete) as { id: number }[];
        for (const post of userPosts) {
          db.prepare('DELETE FROM likes WHERE post_id = ?').run(post.id);
          db.prepare('DELETE FROM comments WHERE post_id = ?').run(post.id);
          db.prepare('DELETE FROM notifications WHERE post_id = ?').run(post.id);
          db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
        }

        // 5. Delete other user-related data
        db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(userIdToDelete, userIdToDelete);
        db.prepare('DELETE FROM notifications WHERE user_id = ? OR actor_id = ?').run(userIdToDelete, userIdToDelete);
        db.prepare('DELETE FROM likes WHERE user_id = ?').run(userIdToDelete);
        db.prepare('DELETE FROM comments WHERE author_id = ?').run(userIdToDelete);
        
        // 6. Finally delete the user
        db.prepare('DELETE FROM users WHERE id = ?').run(userIdToDelete);
        
        db.prepare('COMMIT').run();
        console.log(`[API] User ${userIdToDelete} and all related data deleted successfully`);
        res.json({ success: true });
      } catch (transactionError) {
        db.prepare('ROLLBACK').run();
        throw transactionError;
      }
    } catch (e) {
      console.error('Error deleting user:', e);
      res.status(500).json({ error: 'Gagal menghapus pengguna: ' + (e instanceof Error ? e.message : String(e)) });
    }
  });

  app.put('/api/admin/users/:id', (req, res) => {
    const userId = req.params.id;
    const { name, username, bio, role, is_verified, is_approved } = req.body;
    
    try {
      // Check if username is taken by another user
      const existing = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, userId);
      if (existing) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }

      // Handle Role Changes
      if (role) {
        if (role === 'candidate') {
          const isCandidate = db.prepare('SELECT 1 FROM candidates WHERE user_id = ?').get(userId);
          if (!isCandidate) {
            db.prepare('INSERT INTO candidates (user_id, vision, mission) VALUES (?, ?, ?)').run(userId, '', '');
          }
        } else {
          db.prepare('DELETE FROM candidates WHERE user_id = ?').run(userId);
        }
      }

      db.prepare(`
        UPDATE users 
        SET name = COALESCE(?, name), 
            username = COALESCE(?, username), 
            bio = COALESCE(?, bio), 
            role = COALESCE(?, role),
            is_verified = COALESCE(?, is_verified),
            is_approved = COALESCE(?, is_approved)
        WHERE id = ?
      `).run(name, username, bio, role, is_verified, is_approved, userId);
      
      const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      res.json(updatedUser);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  app.put('/api/admin/users/:id/role', (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;
    
    try {
      if (role === 'candidate') {
        // Check if already candidate
        const existing = db.prepare('SELECT 1 FROM candidates WHERE user_id = ?').get(userId);
        if (!existing) {
          db.prepare('INSERT INTO candidates (user_id, vision, mission) VALUES (?, ?, ?)').run(userId, '', '');
        }
      } else {
        // If demoting from candidate, remove from candidates table
        db.prepare('DELETE FROM candidates WHERE user_id = ?').run(userId);
      }
      
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update user role' });
    }
  });

  app.delete('/api/admin/posts/:id', (req, res) => {
    const postId = Number(req.params.id);
    const adminId = Number(req.body.adminId || req.query.adminId);

    console.log(`[API] Admin ${adminId} attempting to delete post ${postId}`);

    try {
      if (!adminId || isNaN(adminId)) {
        return res.status(401).json({ error: 'Unauthorized: No valid admin ID provided' });
      }

      const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId) as { role: string } | undefined;
      if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      db.prepare('BEGIN TRANSACTION').run();
      try {
        db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM comments WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM notifications WHERE post_id = ?').run(postId);
        db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
        db.prepare('COMMIT').run();
        
        broadcast({ type: 'post:deleted', postId });
        console.log(`[API] Post ${postId} deleted successfully by admin`);
        res.json({ success: true });
      } catch (transactionError) {
        db.prepare('ROLLBACK').run();
        throw transactionError;
      }
    } catch (e) {
      console.error('Error deleting post by admin:', e);
      res.status(500).json({ error: 'Gagal menghapus postingan: ' + (e instanceof Error ? e.message : String(e)) });
    }
  });

  app.delete('/api/admin/votes', (req, res) => {
    const adminId = Number(req.body.adminId || req.query.adminId);

    console.log(`[API] Admin ${adminId} attempting to reset all votes`);

    try {
      if (!adminId || isNaN(adminId)) {
        return res.status(401).json({ error: 'Unauthorized: No valid admin ID provided' });
      }

      const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId) as { role: string } | undefined;
      if (!admin || admin.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      db.prepare('DELETE FROM votes').run();
      console.log(`[API] All votes reset successfully by admin ${adminId}`);
      res.json({ success: true });
    } catch (e) {
      console.error('Error resetting votes:', e);
      res.status(500).json({ error: 'Gagal mereset data klasemen: ' + (e instanceof Error ? e.message : String(e)) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Background task to check election status
  setInterval(() => {
    try {
      const statusRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_status') as { value: string } | undefined;
      const endDateRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('election_end_date') as { value: string } | undefined;
      
      const status = statusRow?.value || 'not_started';
      const endDate = endDateRow?.value || null;
      
      if (status === 'in_progress' && endDate) {
        const endDateTime = new Date(endDate);
        if (new Date() > endDateTime) {
          console.log('[Server] Election time is up. Automatically closing election.');
          db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('closed', 'election_status');
          broadcast({ type: 'election:status_changed', status: 'closed' });
        }
      }
    } catch (e) {
      console.error('[Server] Error checking election status:', e);
    }
  }, 10000); // Check every 10 seconds

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
