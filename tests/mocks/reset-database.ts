// Helper to reset the database singleton between tests.
// We reach into the database module and clear its cached instance
// so the next getDatabase() call creates a fresh in-memory SQLite.

export function resetDatabase(): void {
  // Drop tables from all cached in-memory databases.
  // The better-sqlite3 mock (in preload.ts) caches DB instances on globalThis.__sqliteDbCache.
  const dbCache = (globalThis as any).__sqliteDbCache as Map<string, any> | undefined;
  if (dbCache) {
    for (const db of dbCache.values()) {
      try { db.exec('DROP TABLE IF EXISTS connections'); } catch {}
      try { db.exec('DROP TABLE IF EXISTS app_state'); } catch {}
      try { db.exec('DROP TABLE IF EXISTS preferences'); } catch {}
    }
  }
}
