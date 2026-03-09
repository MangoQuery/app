import { db } from './database';

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  useConnectionString: boolean;
  color: string;
  createdAt: number;
  updatedAt: number;
}

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL DEFAULT 'localhost',
    port INTEGER NOT NULL DEFAULT 27017,
    use_connection_string INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#FF9F1C',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function getAllConnections(): ConnectionProfile[] {
  const stmt = db.prepare('SELECT id, name, host, port, use_connection_string, color, created_at, updated_at FROM connections ORDER BY updated_at DESC');
  const rows = stmt.all();
  const result: ConnectionProfile[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row: any = rows[i];
    result.push({
      id: row.id as string,
      name: row.name as string,
      host: row.host as string,
      port: row.port as number,
      useConnectionString: (row.use_connection_string as number) === 1,
      color: row.color as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    });
  }
  return result;
}

export function createConnection(data: Partial<ConnectionProfile>): ConnectionProfile {
  const d: any = data;
  const now = Date.now();
  const id = 'conn-' + String(now);
  const name = d.name || 'Untitled';
  const host = d.host || 'localhost';
  const port = d.port || 27017;
  const color = d.color || '#FF9F1C';

  const stmt = db.prepare(
    `INSERT INTO connections (id, name, host, port, use_connection_string, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const params = JSON.stringify([id, name, host, port, 0, color, now, now]);
  stmt.run(params);

  return {
    id: id, name: name, host: host, port: port,
    useConnectionString: false,
    color: color, createdAt: now, updatedAt: now,
  };
}

export function deleteConnection(id: string): void {
  const stmt = db.prepare('DELETE FROM connections WHERE id = ?');
  const params = JSON.stringify([id]);
  stmt.run(params);
}
