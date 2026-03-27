import { describe, it, expect, beforeEach } from 'bun:test';
import { resetDatabase } from './mocks/reset-database';
import { getAllConnections, createConnection, deleteConnection, saveState, getState } from '../src/data/connection-store';

describe('ConnectionStore', () => {
  beforeEach(() => {
    resetDatabase();
  });

  describe('createConnection', () => {
    it('should create a connection with defaults', () => {
      const profile = createConnection({ name: 'Test' });

      expect(profile.name).toBe('Test');
      expect(profile.host).toBe('localhost');
      expect(profile.port).toBe(27017);
      expect(profile.id).toBeDefined();
      expect(profile.id.length).toBe(16);
      expect(profile.createdAt).toBeGreaterThan(0);
      expect(profile.updatedAt).toBe(profile.createdAt);
    });

    it('should create a connection with custom fields', () => {
      const profile = createConnection({
        name: 'Production',
        host: 'mongo.example.com',
        port: 27018,
      });

      expect(profile.name).toBe('Production');
      expect(profile.host).toBe('mongo.example.com');
      expect(profile.port).toBe(27018);
    });

    it('should generate unique IDs', () => {
      const p1 = createConnection({ name: 'First' });
      const p2 = createConnection({ name: 'Second' });

      expect(p1.id).not.toBe(p2.id);
    });

    it('should use default name when not provided', () => {
      const profile = createConnection({});

      expect(profile.name).toBe('Untitled');
    });
  });

  describe('getAllConnections', () => {
    it('should return empty array when no connections', () => {
      expect(getAllConnections()).toEqual([]);
    });

    it('should return all created connections', () => {
      createConnection({ name: 'First' });
      createConnection({ name: 'Second' });

      const all = getAllConnections();
      expect(all.length).toBe(2);
    });

    it('should return connections sorted by updatedAt desc', async () => {
      createConnection({ name: 'First' });
      await Bun.sleep(2); // Ensure different timestamps
      createConnection({ name: 'Second' });

      const all = getAllConnections();
      expect(all.length).toBe(2);
      // Most recently created should come first
      expect(all[0].name).toBe('Second');
      expect(all[1].name).toBe('First');
    });
  });

  describe('deleteConnection', () => {
    it('should delete a connection', () => {
      const created = createConnection({ name: 'ToDelete' });
      deleteConnection(created.id);

      expect(getAllConnections().length).toBe(0);
    });

    it('should not affect other connections', () => {
      const p1 = createConnection({ name: 'Keep' });
      const p2 = createConnection({ name: 'Delete' });
      deleteConnection(p2.id);

      const all = getAllConnections();
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Keep');
    });
  });

  describe('app state', () => {
    it('should save and retrieve state', () => {
      saveState('testKey', 'testValue');
      expect(getState('testKey')).toBe('testValue');
    });

    it('should return empty string for missing keys', () => {
      expect(getState('nonexistent')).toBe('');
    });

    it('should overwrite existing state', () => {
      saveState('key', 'first');
      saveState('key', 'second');
      expect(getState('key')).toBe('second');
    });
  });
});
