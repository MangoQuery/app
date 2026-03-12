import { getDatabase } from './database';

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

const PROFILE_DEFAULTS: Omit<ConnectionProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Untitled',
  host: 'localhost',
  port: 27017,
  useConnectionString: false,
  connectionString: '',
  authEnabled: false,
  username: '',
  password: '',
  authDatabase: '',
  authMechanism: 'SCRAM-SHA-256',
  tlsEnabled: false,
  tlsCaFile: '',
  tlsCertFile: '',
  tlsAllowInvalidCertificates: false,
  color: '#FF9F1C',
};

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export class ConnectionStore {
  private db: any;

  constructor() {
    this.db = getDatabase();
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
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
    `);
  }

  private rowToProfile(row: any): ConnectionProfile {
    return {
      id: (row.id || '') as string,
      name: (row.name || 'Untitled') as string,
      host: (row.host || 'localhost') as string,
      port: (row.port || 27017) as number,
      useConnectionString: (row.use_connection_string as number) === 1,
      connectionString: (row.connection_string || '') as string,
      authEnabled: (row.auth_enabled as number) === 1,
      username: (row.username || '') as string,
      password: (row.password || '') as string,
      authDatabase: (row.auth_database || '') as string,
      authMechanism: (row.auth_mechanism || 'SCRAM-SHA-256') as string,
      tlsEnabled: (row.tls_enabled as number) === 1,
      tlsCaFile: (row.tls_ca_file || '') as string,
      tlsCertFile: (row.tls_cert_file || '') as string,
      tlsAllowInvalidCertificates: (row.tls_allow_invalid_certs as number) === 1,
      color: (row.color || '#FF9F1C') as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  create(data: Partial<ConnectionProfile>): ConnectionProfile {
    const now = Date.now();
    const id = generateId();
    const d = { ...PROFILE_DEFAULTS, ...data };

    this.db.prepare(
      `INSERT INTO connections (id, name, host, port, use_connection_string, connection_string,
        auth_enabled, username, password, auth_database, auth_mechanism,
        tls_enabled, tls_ca_file, tls_cert_file, tls_allow_invalid_certs,
        color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, d.name, d.host, d.port,
      d.useConnectionString ? 1 : 0, d.connectionString,
      d.authEnabled ? 1 : 0, d.username, d.password, d.authDatabase, d.authMechanism,
      d.tlsEnabled ? 1 : 0, d.tlsCaFile, d.tlsCertFile, d.tlsAllowInvalidCertificates ? 1 : 0,
      d.color, now, now
    );

    return {
      ...PROFILE_DEFAULTS, ...d,
      id, createdAt: now, updatedAt: now,
    };
  }

  getAll(): ConnectionProfile[] {
    const rows = this.db.prepare(
      'SELECT * FROM connections ORDER BY updated_at DESC'
    ).all();
    return rows.map((r: any) => this.rowToProfile(r));
  }

  getById(id: string): ConnectionProfile | null {
    const row = this.db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
    return row ? this.rowToProfile(row) : null;
  }

  update(id: string, data: Partial<ConnectionProfile>): ConnectionProfile | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = Date.now();
    const merged = { ...existing, ...data, id, updatedAt: now };

    this.db.prepare(
      `UPDATE connections SET name=?, host=?, port=?, use_connection_string=?, connection_string=?,
        auth_enabled=?, username=?, password=?, auth_database=?, auth_mechanism=?,
        tls_enabled=?, tls_ca_file=?, tls_cert_file=?, tls_allow_invalid_certs=?,
        color=?, updated_at=?
       WHERE id=?`
    ).run(
      merged.name, merged.host, merged.port,
      merged.useConnectionString ? 1 : 0, merged.connectionString,
      merged.authEnabled ? 1 : 0, merged.username, merged.password, merged.authDatabase, merged.authMechanism,
      merged.tlsEnabled ? 1 : 0, merged.tlsCaFile, merged.tlsCertFile, merged.tlsAllowInvalidCertificates ? 1 : 0,
      merged.color, now, id
    );

    return merged;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM connections WHERE id = ?').run(id);
    return result.changes > 0;
  }

  duplicate(id: string): ConnectionProfile | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const copy: Partial<ConnectionProfile> = { ...existing };
    delete (copy as any).id;
    delete (copy as any).createdAt;
    delete (copy as any).updatedAt;
    copy.name = existing.name + ' (copy)';

    return this.create(copy);
  }

  buildConnectionUri(profile: ConnectionProfile): string {
    if (profile.useConnectionString) {
      return profile.connectionString;
    }

    let uri = 'mongodb://';

    if (profile.authEnabled && profile.username) {
      uri += encodeURIComponent(profile.username);
      if (profile.password) {
        uri += ':' + encodeURIComponent(profile.password);
      }
      uri += '@';
    }

    uri += profile.host + ':' + profile.port;

    const params: string[] = [];

    if (profile.authEnabled) {
      if (profile.authDatabase) {
        uri += '/' + profile.authDatabase;
      }
      if (profile.authMechanism) {
        params.push('authMechanism=' + profile.authMechanism);
      }
    }

    if (profile.tlsEnabled) {
      params.push('tls=true');
      if (profile.tlsCaFile) {
        params.push('tlsCAFile=' + encodeURIComponent(profile.tlsCaFile));
      }
      if (profile.tlsCertFile) {
        params.push('tlsCertificateKeyFile=' + encodeURIComponent(profile.tlsCertFile));
      }
      if (profile.tlsAllowInvalidCertificates) {
        params.push('tlsAllowInvalidCertificates=true');
      }
    }

    if (params.length > 0) {
      // Ensure there's a path separator before query params
      const hostPortEnd = uri.indexOf('/', uri.indexOf('://') + 3);
      if (hostPortEnd < 0) {
        uri += '/';
      }
      uri += '?' + params.join('&');
    }

    return uri;
  }
}

// --- Convenience functions for backward compatibility with app.ts ---

let _store: ConnectionStore | null = null;
function store(): ConnectionStore {
  if (!_store) _store = new ConnectionStore();
  return _store;
}

export function getAllConnections(): ConnectionProfile[] {
  return store().getAll();
}

export function createConnection(data: Partial<ConnectionProfile>): ConnectionProfile {
  return store().create(data);
}

export function deleteConnection(id: string): boolean {
  return store().delete(id);
}

// --- App state persistence ---

export function saveState(key: string, value: string): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)').run(key, value);
}

export function getState(key: string): string {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  const row: any = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  if (row) return row.value as string;
  return '';
}
