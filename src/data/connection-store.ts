import Database from 'better-sqlite3';

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  useConnectionString: boolean;
  connectionString: string;
  authEnabled: boolean;
  username: string;
  password: string;
  authDatabase: string;
  authMechanism: string;
  tlsEnabled: boolean;
  tlsCaFile: string;
  tlsCertFile: string;
  tlsAllowInvalidCertificates: boolean;
  color: string;
  createdAt: number;
  updatedAt: number;
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Escape single quotes for SQL string literals
function esc(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === "'") {
      result += "''";
    } else {
      result += c;
    }
  }
  return result;
}

function initDb(): any {
  const d: any = new Database('mango.db');
  d.prepare(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL DEFAULT 'localhost',
      port INTEGER NOT NULL DEFAULT 27017,
      use_connection_string INTEGER NOT NULL DEFAULT 0,
      connection_string TEXT NOT NULL DEFAULT '',
      auth_enabled INTEGER NOT NULL DEFAULT 0,
      username TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      auth_database TEXT NOT NULL DEFAULT '',
      auth_mechanism TEXT NOT NULL DEFAULT 'SCRAM-SHA-256',
      tls_enabled INTEGER NOT NULL DEFAULT 0,
      tls_ca_file TEXT NOT NULL DEFAULT '',
      tls_cert_file TEXT NOT NULL DEFAULT '',
      tls_allow_invalid_certs INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#FF9F1C',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();
  d.prepare(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();
  return d;
}

// Initialize at module load time
initDb();

function rowToProfile(row: any): any {
  const r = row as any;
  return {
    id: r.id,
    name: r.name,
    host: r.host,
    port: r.port,
    useConnectionString: r.use_connection_string === 1,
    connectionString: r.connection_string || '',
    authEnabled: r.auth_enabled === 1,
    username: r.username || '',
    password: r.password || '',
    authDatabase: r.auth_database || '',
    authMechanism: r.auth_mechanism || 'SCRAM-SHA-256',
    tlsEnabled: r.tls_enabled === 1,
    tlsCaFile: r.tls_ca_file || '',
    tlsCertFile: r.tls_cert_file || '',
    tlsAllowInvalidCertificates: r.tls_allow_invalid_certs === 1,
    color: r.color || '#FF9F1C',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getAllConnections(): any[] {
  const db: any = initDb();
  const rows: any = db.prepare(
    'SELECT * FROM connections ORDER BY updated_at DESC'
  ).all();
  const result: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as any;
    if (r && r.id) {
      result.push(rowToProfile(r));
    }
  }
  return result;
}

export function createConnection(data: any): any {
  const db: any = initDb();
  const now = Date.now();
  const id = generateId();
  const name = esc(data.name || 'Untitled');
  const host = esc(data.host || 'localhost');
  const port = data.port || 27017;
  const color = esc(data.color || '#FF9F1C');
  const connStr = esc(data.connectionString || '');

  // Use direct SQL values — Perry's codegen only passes first arg to stmt.run()
  db.prepare(
    "INSERT INTO connections (id, name, host, port, use_connection_string, connection_string, auth_enabled, username, password, auth_database, auth_mechanism, tls_enabled, tls_ca_file, tls_cert_file, tls_allow_invalid_certs, color, created_at, updated_at) VALUES ('" + id + "', '" + name + "', '" + host + "', " + port + ", " + (connStr ? '1' : '0') + ", '" + connStr + "', 0, '', '', '', 'SCRAM-SHA-256', 0, '', '', 0, '" + color + "', " + now + ", " + now + ")"
  ).run();

  return {
    id: id, name: data.name || 'Untitled', host: data.host || 'localhost', port: port,
    connectionString: data.connectionString || '',
    createdAt: now, updatedAt: now,
  };
}

export function deleteConnection(id: string): boolean {
  const db: any = initDb();
  db.prepare("DELETE FROM connections WHERE id = '" + esc(id) + "'").run();
  return true;
}

// --- App state persistence ---

export function saveState(key: string, value: string): void {
  const db: any = initDb();
  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('" + esc(key) + "', '" + esc(value) + "')").run();
}

export function getState(key: string): string {
  const db: any = initDb();
  const row: any = db.prepare("SELECT value FROM app_state WHERE key = '" + esc(key) + "'").get();
  if (row) return (row as any).value;
  return '';
}
