// Preload script for bun test — registers module mocks for perry/*, better-sqlite3
import { plugin } from 'bun';
import { Database as BunDatabase } from 'bun:sqlite';
import { SQLite } from './mocks/perry-sqlite';
import { Platform, Application, Window } from './mocks/perry';

plugin({
  name: 'perry-mock',
  setup(build) {
    // Mock 'perry/sqlite'
    build.module('perry/sqlite', () => ({
      exports: { SQLite },
      loader: 'object',
    }));

    // Mock 'perry' (the main perry package)
    build.module('perry', () => ({
      exports: { Platform, Application, Window },
      loader: 'object',
    }));

    // Mock 'perry/ui' — not needed by tests, but prevents import errors
    // if any transitive import pulls it in
    build.module('perry/ui', () => ({
      exports: new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === '__esModule') return true;
            return () => ({});
          },
        }
      ),
      loader: 'object',
    }));

    // Mock 'better-sqlite3' using bun:sqlite with in-memory databases
    build.module('better-sqlite3', () => ({
      exports: {
        default: function (_filename: string) {
          return new BunDatabase(':memory:');
        },
      },
      loader: 'object',
    }));

    // Mock 'perry/system'
    build.module('perry/system', () => ({
      exports: {
        isDarkMode: () => false,
        isLightMode: () => true,
      },
      loader: 'object',
    }));

    // Mock 'perry-styling'
    build.module('perry-styling', () => ({
      exports: {
        isMac: true,
        isIOS: false,
        isAndroid: false,
        isWindows: false,
        isLinux: false,
        isWeb: false,
      },
      loader: 'object',
    }));

    // Mock 'perry/thread' — run everything single-threaded in tests
    build.module('perry/thread', () => ({
      exports: {
        parallelMap: (arr: any[], fn: (item: any) => any) => arr.map(fn),
        parallelFilter: (arr: any[], fn: (item: any) => boolean) => arr.filter(fn),
        spawn: (fn: () => any) => Promise.resolve(fn()),
      },
      loader: 'object',
    }));

    // No mock for 'mongodb' — use the real npm package for integration tests
  },
});
