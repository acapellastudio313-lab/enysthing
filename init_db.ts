import Database from 'better-sqlite3';
const db = new Database('app.db');
db.exec('PRAGMA foreign_keys = ON');
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
    is_verified INTEGER DEFAULT 0,
    is_approved INTEGER DEFAULT 1,
    password TEXT
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
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    actor_id INTEGER,
    type TEXT,
    post_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    story_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(actor_id) REFERENCES users(id),
    FOREIGN KEY(post_id) REFERENCES posts(id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);
console.log('Tables created');
