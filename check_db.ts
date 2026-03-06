import Database from 'better-sqlite3';
const db = new Database('app.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
console.log('Tables:', tables);
