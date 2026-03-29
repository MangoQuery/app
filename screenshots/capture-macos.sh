#!/bin/bash
# Capture real Mango screenshots on macOS for all 13 languages.
#
# Prerequisites:
#   - Perry compiler available (perry CLI or cargo build)
#   - Screen recording permission granted for Terminal
#
# Usage:
#   bash screenshots/capture-macos.sh
#   bash screenshots/capture-macos.sh --skip-build
#
# Output: appstore/screenshots/{locale}/mac_screenshot_{scene}.png (65 files)

set -e

PERRY_DIR="$(cd "$(dirname "$0")/../../perry/perry" && pwd)"
MANGO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="screenshot-mac"
BUNDLE_ID="com.skelpo.mango"
SRC="$MANGO_DIR/src/app.ts"

# Parallel arrays: Perry locale → App Store directory
PERRY_LOCALES=(en de ja zh-Hans es-MX fr pt ko it tr th id vi)
STORE_DIRS=(en-US de-DE ja zh-Hans es-MX fr-FR pt-BR ko it tr th id vi)

# Scene configs
MODES=(1 2 3 4 5)
SUFFIXES=(1_welcome 2_browse 3_query 4_edit 5_about)
SLEEPS=(2 2 2 3 2)

SKIP_BUILD=0
if [ "$1" = "--skip-build" ]; then
  SKIP_BUILD=1
fi

# Step 1: Build Perry runtime for macOS
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "==> Building perry-stdlib + perry-ui-macos..."
  cd "$PERRY_DIR"
  cargo build --release -p perry-stdlib -p perry-ui-macos 2>&1 | grep -E '(Compiling|Finished|error)'
fi

# Helper: find window ID by PID using Quartz
find_window_id() {
  local pid=$1
  python3 -c "
import Quartz, sys
wl = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
for w in wl:
    if w.get('kCGWindowOwnerPID') == $pid:
        bounds = w.get('kCGWindowBounds', {})
        width = bounds.get('Width', 0)
        height = bounds.get('Height', 0)
        if width > 100 and height > 100:
            print(w.get('kCGWindowNumber', 0))
            sys.exit(0)
print(0)
" 2>/dev/null
}

# Step 2: For each scene, compile once and capture across all languages
for mode_idx in 0 1 2 3 4; do
  MODE=${MODES[$mode_idx]}
  SUFFIX=${SUFFIXES[$mode_idx]}
  SLEEP_TIME=${SLEEPS[$mode_idx]}

  echo ""
  echo "========================================"
  echo "  Scene $MODE: $SUFFIX (sleep ${SLEEP_TIME}s)"
  echo "========================================"

  # Clean stale database
  rm -f "$MANGO_DIR/mango.db"

  # Patch SCREENSHOT_MODE
  sed -i '' "s/const SCREENSHOT_MODE = .*/const SCREENSHOT_MODE = $MODE;/" "$SRC"

  # Compile for macOS
  echo "  Compiling for macOS..."
  cd "$PERRY_DIR"
  cargo run --release -- compile "$SRC" -o "$MANGO_DIR/$APP_NAME" 2>&1 | tail -3

  # Capture for each language
  for lang_idx in $(seq 0 $((${#PERRY_LOCALES[@]} - 1))); do
    LANG_CODE="${PERRY_LOCALES[$lang_idx]}"
    DIR_NAME="${STORE_DIRS[$lang_idx]}"

    mkdir -p "$MANGO_DIR/appstore/screenshots/$DIR_NAME"

    # Clean db for fresh state each language
    rm -f "$MANGO_DIR/mango.db"

    # Launch app with language override
    cd "$MANGO_DIR"
    "./$APP_NAME" -AppleLanguages "($LANG_CODE)" &
    APP_PID=$!

    # Wait for window to render
    sleep "$SLEEP_TIME"

    # Find window ID
    WID=$(find_window_id $APP_PID)

    if [ "$WID" -gt 0 ] 2>/dev/null; then
      OUTFILE="$MANGO_DIR/appstore/screenshots/$DIR_NAME/mac_screenshot_${SUFFIX}.png"
      screencapture -l"$WID" -x "$OUTFILE"
      echo "  [$DIR_NAME] mac_screenshot_${SUFFIX}.png"
    else
      echo "  [$DIR_NAME] WARNING: could not find window (PID=$APP_PID)"
    fi

    # Kill the app
    kill $APP_PID 2>/dev/null || true
    wait $APP_PID 2>/dev/null || true
  done

  # Clean up
  rm -f "$MANGO_DIR/$APP_NAME"
done

# Restore source
sed -i '' "s/const SCREENSHOT_MODE = .*/const SCREENSHOT_MODE = 0;/" "$SRC"
rm -f "$MANGO_DIR/mango.db"
rm -f "$MANGO_DIR"/*.o "$MANGO_DIR"/_perry_* 2>/dev/null

TOTAL=$(find "$MANGO_DIR/appstore/screenshots" -name 'mac_screenshot_*.png' 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Done! $TOTAL macOS screenshots captured."
echo "Next: python appstore/upload.py screenshots --mac"
