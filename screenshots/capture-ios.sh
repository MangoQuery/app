#!/bin/bash
# Capture real Mango screenshots from iOS Simulator for all 13 languages.
#
# Prerequisites:
#   - iPhone simulator booted (e.g. iPhone 16 Pro Max)
#   - Perry compiler built (cargo build --release in perry/)
#
# Usage:
#   bash screenshots/capture-ios.sh           # all scenes, all languages
#   bash screenshots/capture-ios.sh --skip-build  # skip Perry stdlib build
#
# Output: screenshots/raw/ios/{locale}/screenshot_{scene}.png (65 files)

set -e

PERRY_DIR="$(cd "$(dirname "$0")/../../perry/perry" && pwd)"
MANGO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="screenshot-ios-sim"
BUNDLE_ID="com.skelpo.mango"
OUTDIR="$MANGO_DIR/screenshots/raw/ios"
SRC="$MANGO_DIR/src/app.ts"

# Parallel arrays: Apple language code → output directory name
APPLE_LANGS=(en de ja zh-Hans es-MX fr pt-BR ko it tr th id vi)
STORE_DIRS=(en-US de-DE ja zh-Hans es-MX fr-FR pt-BR ko it tr th id vi)

# Scene configs: mode number, output suffix, sleep time
MODES=(1 2 3 4 5)
SUFFIXES=(1_welcome 2_browse 3_query 4_edit 5_about)
SLEEPS=(3 3 3 5 3)

SKIP_BUILD=0
if [ "$1" = "--skip-build" ]; then
  SKIP_BUILD=1
fi

mkdir -p "$OUTDIR"

# Verify simulator is booted
if ! xcrun simctl list devices booted 2>/dev/null | grep -q "Booted"; then
  echo "Error: No iOS simulator is booted."
  echo "Boot one with: xcrun simctl boot 'iPhone 16 Pro Max'"
  exit 1
fi

# Step 1: Build Perry runtime once
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "==> Building perry-stdlib + perry-ui-ios for iOS simulator..."
  cd "$PERRY_DIR"
  cargo build --release -p perry-stdlib -p perry-ui-ios --target aarch64-apple-ios-sim 2>&1 | grep -E '(Compiling|Finished|error)'
fi

# Step 2: For each scene, compile once and capture across all languages
for mode_idx in 0 1 2 3 4; do
  MODE=${MODES[$mode_idx]}
  SUFFIX=${SUFFIXES[$mode_idx]}
  SLEEP_TIME=${SLEEPS[$mode_idx]}

  echo ""
  echo "========================================"
  echo "  Scene $MODE: $SUFFIX (sleep ${SLEEP_TIME}s)"
  echo "========================================"

  # Clean stale database so screenshot mode starts fresh
  rm -f "$MANGO_DIR/mango.db"

  # Dismiss any stale system dialogs by sending home button
  xcrun simctl ui booted appearance light 2>/dev/null || true

  # Patch SCREENSHOT_MODE in source
  sed -i '' "s/const SCREENSHOT_MODE = .*/const SCREENSHOT_MODE = $MODE;/" "$SRC"

  # Compile once for this scene
  echo "  Compiling for ios-simulator..."
  cd "$PERRY_DIR"
  cargo run --release -- compile --target ios-simulator "$SRC" -o "$MANGO_DIR/$APP_NAME" 2>&1 | tail -3

  # Install once (binary is the same for all languages — i18n is runtime)
  xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true
  xcrun simctl install booted "$MANGO_DIR/$APP_NAME.app"

  # Capture for each language
  for lang_idx in $(seq 0 $((${#APPLE_LANGS[@]} - 1))); do
    LANG_CODE="${APPLE_LANGS[$lang_idx]}"
    DIR_NAME="${STORE_DIRS[$lang_idx]}"

    mkdir -p "$OUTDIR/$DIR_NAME"

    # Set simulator language
    xcrun simctl spawn booted defaults write -g AppleLanguages -array "$LANG_CODE"

    # Launch app
    xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true
    sleep 0.5
    xcrun simctl launch booted "$BUNDLE_ID"

    # Wait for UI to render
    sleep "$SLEEP_TIME"

    # Capture
    OUTFILE="$OUTDIR/$DIR_NAME/screenshot_${SUFFIX}.png"
    xcrun simctl io booted screenshot "$OUTFILE" 2>/dev/null
    echo "  [$DIR_NAME] screenshot_${SUFFIX}.png"

    # Terminate
    xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true
  done

  # Clean up compiled artifacts
  rm -rf "$MANGO_DIR/$APP_NAME" "$MANGO_DIR/$APP_NAME.app"
done

# Restore source and simulator state
sed -i '' "s/const SCREENSHOT_MODE = .*/const SCREENSHOT_MODE = 0;/" "$SRC"
xcrun simctl spawn booted defaults write -g AppleLanguages -array en
rm -f "$MANGO_DIR/mango.db"

# Clean object files
rm -f "$MANGO_DIR"/*.o "$MANGO_DIR"/_perry_* 2>/dev/null

TOTAL=$(find "$OUTDIR" -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Done! $TOTAL raw screenshots in $OUTDIR/"
echo "Next: python appstore/generate_screenshots.py"
