# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mango is a native desktop MongoDB GUI built with Perry (TypeScript-to-native compiler). It produces ~7 MB cross-platform binaries targeting macOS (AppKit), iOS (UIKit), Android (Views), Linux (GTK4), and Windows (Win32) from a single TypeScript codebase.

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

- **Perry, not Electron:** UI uses Perry's native bindings, not DOM/HTML. No `document`, `window`, or CSS — use Perry widget types and RGBA colors.
- **Path alias:** `@/*` maps to `src/*` in imports.
- **External editor widget:** `@honeide/editor` is a local dependency (`file:../hone/hone-editor`) used for document editing.
- **Test mocks:** Perry APIs and MongoDB are mocked in `tests/mocks/`. Tests preload `tests/preload.ts` via bunfig.toml. Use `reset-database.ts` to clear state between tests.
- **Connection URI building:** `ConnectionStore.buildConnectionUri()` handles auth mechanisms (SCRAM-SHA-256, etc.) and TLS options. Always use this rather than constructing URIs manually.
