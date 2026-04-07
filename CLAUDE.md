# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mango is a native MongoDB GUI built with Perry (TypeScript-to-native compiler). It produces ~7 MB cross-platform binaries targeting macOS (AppKit), iOS (UIKit), Android (Views), Linux (GTK4), and Windows (Win32) from a single TypeScript codebase. It also compiles to a single self-contained HTML+WebAssembly file via `--target web` for in-browser use.

## Commands

```bash
# Development
npm run dev              # Run with hot reload (default: macOS)
npm run dev:macos        # Platform-specific dev mode
npm run dev:linux        # Build and run on Linux (GTK4)
npm run check            # Type-check via Perry

# Build
npm run build            # All platforms
npm run build:macos      # Platform-specific builds
npm run build:linux
npm run build:windows

# Web (WebAssembly + DOM bridge in a single self-contained HTML file)
perry compile src/app.ts --target web -o dist/mango.html
# Serve over HTTP so fetch() works (file:// hits CORS)
python3 -m http.server 8765 -d dist
open http://localhost:8765/mango.html

# Testing (uses Bun, not Node)
npm test                 # All tests
npm run test:unit        # Unit tests only
npm run test:integration # MongoDB integration tests
bun test tests/connection-store.test.ts  # Run a single test file
```

## Architecture

**Three-layer design:**

1. **UI Layer** (`src/app.ts`) — Single-file UI using Perry's native widget bindings (VStack, HStack, TextField, etc.). Uses manual screen indexing and global state arrays for navigation, not a reactive framework. All UI updates are direct Perry API calls.

2. **Data Layer** (`src/data/`) — Class-based stores:
   - `ConnectionStore` — SQLite CRUD for connection profiles; passwords stored in platform Keychain, never SQLite
   - `MangoClient` — MongoDB driver wrapper with query, document CRUD, stats, and index operations
   - `PreferencesStore` — SQLite-backed user settings with in-memory cache
   - `database.ts` — SQLite singleton via `getDatabase()`

3. **Theme Layer** (`src/theme/`) — RGBA-based color system with light/dark themes and platform-specific typography (SF Mono on macOS, JetBrains Mono on Linux, etc.)

## Key Conventions

- **Perry, not Electron:** UI uses Perry's native bindings, not DOM/HTML. No `document`, `window`, or CSS — use Perry widget types and RGBA colors. (On the `--target web` build, Perry's WASM runtime maps every widget to a DOM element under the hood, but the source code stays the same — you never write HTML.)
- **Path alias:** `@/*` maps to `src/*` in imports.
- **External editor widget:** `@honeide/editor` is a local dependency (`file:../hone/hone-editor`) used for document editing.
- **Test mocks:** Perry APIs and MongoDB are mocked in `tests/mocks/`. Tests preload `tests/preload.ts` via bunfig.toml. Use `reset-database.ts` to clear state between tests.
- **Connection URI building:** `ConnectionStore.buildConnectionUri()` handles auth mechanisms (SCRAM-SHA-256, etc.) and TLS options. Always use this rather than constructing URIs manually.

## Web Target Notes

`perry compile src/app.ts --target web` produces a single ~4 MB self-contained HTML file with the WebAssembly binary, the JS bridge for DOM widgets, and all string/data sections embedded. It's the same backend as `--target wasm`; both flags produce identical output.

Platform branches with `__platform__ === 5` cover the web case:

- **Connection storage**: `connection-store.ts` falls back to an in-memory `webTransient` store on web instead of SQLite (which doesn't compile to WASM). Connection profiles are not persisted across reloads in the browser.
- **Keychain**: maps to `localStorage` (Perry's web bridge). Fine for connection metadata but **not** for production secrets — anything in localStorage is readable by other scripts in the same origin.
- **Hone code editor**: requires native FFI (`hone_editor_*`) that has no browser implementation. Perry's WASM bridge auto-stubs these to no-ops via a `Proxy`, so the editor area shows up but key/mouse handling is inactive. Document editing works with the plain `<textarea>` fallback.
- **MongoDB driver**: native MongoDB doesn't run in the browser. The web build needs to talk to a Mango Server proxy (`web-mongo-client.ts` over `fetch`). For local testing, run mongod + mango-server alongside the served HTML and update the connection string.
- **fetch / CORS**: any third-party URL (telemetry, public APIs) must allow your origin. Mango's `trackEvent` will silently fail with a CORS error from `file://` and from origins not whitelisted by `api.chirp247.com` — this is expected and the catch in `trackEvent` swallows it.
- **Serving**: must be served over HTTP, not opened directly via `file://` (browsers reject `fetch()` from file URLs). Any static server works (`python3 -m http.server`, `npx serve`, etc.).
