import { getDatabase } from './database';
import { isDarkMode } from 'perry/system';

export type ThemeMode = 'system' | 'light' | 'dark';
export type PageSize = 20 | 50 | 100 | 500;

export interface AppPreferences {
  theme: ThemeMode;
  pageSize: PageSize;
  defaultLimit: number;
  expandDocumentsByDefault: boolean;
  showCollectionStats: boolean;
  analyticsEnabled: boolean;
  lastConnectionId: string | null;
  sidebarWidth: number;
}

const DEFAULTS: AppPreferences = {
  theme: 'system',
  pageSize: 50,
  defaultLimit: 50,
  expandDocumentsByDefault: false,
  showCollectionStats: true,
  analyticsEnabled: true,
  lastConnectionId: null,
  sidebarWidth: 260,
};

export class PreferencesStore {
  private db: any;
  private cache: Map<string, string> = new Map();

  constructor() {
    this.db = getDatabase();
    this.initialize();
    this.loadCache();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  private loadCache(): void {
    const rows = this.db.prepare('SELECT key, value FROM preferences').all();
    for (const row of rows) {
      this.cache.set(row.key as string, row.value as string);
    }
  }

  get<K extends keyof AppPreferences>(key: K): AppPreferences[K] {
    const raw = this.cache.get(key);
    if (raw === undefined) return DEFAULTS[key];

    const defaultVal = DEFAULTS[key];
    if (typeof defaultVal === 'number') return Number(raw) as AppPreferences[K];
    if (typeof defaultVal === 'boolean') return (raw === 'true') as AppPreferences[K];
    if (defaultVal === null) return (raw === 'null' ? null : raw) as AppPreferences[K];
    return raw as AppPreferences[K];
  }

  getAll(): AppPreferences {
    const result: any = {};
    for (const key of Object.keys(DEFAULTS) as (keyof AppPreferences)[]) {
      result[key] = this.get(key);
    }
    return result as AppPreferences;
  }

  set<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]): void {
    const strValue = String(value);
    this.cache.set(key, strValue);
    this.db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)').run(key, strValue);
  }

  resolveTheme(): 'light' | 'dark' {
    const pref = this.get('theme');
    if (pref === 'light' || pref === 'dark') return pref;
    return isDarkMode() ? 'dark' : 'light';
  }
}
