#!/bin/bash
set -e

PERRY_DIR="$(cd "$(dirname "$0")/../perry" && pwd)"
MANGO_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="app-ios-sim"
BUNDLE_ID="com.perry.$APP_NAME"

echo "==> Building perry-stdlib + perry-ui-ios for iOS simulator..."
cd "$PERRY_DIR"
cargo build --release -p perry-stdlib -p perry-ui-ios --target aarch64-apple-ios-sim 2>&1 | grep -E '(Compiling|Finished|error)'

echo "==> Compiling mango for iOS simulator..."
cargo run --release -- compile --target ios-simulator "$MANGO_DIR/src/app.ts" -o "$MANGO_DIR/$APP_NAME" 2>&1 | grep -v '^ld: warning'

echo "==> Installing on simulator..."
xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install booted "$MANGO_DIR/$APP_NAME.app"

echo "==> Launching..."
xcrun simctl launch booted "$BUNDLE_ID"

echo "Done."
