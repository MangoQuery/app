#!/bin/bash
# Usage: bash take-screenshot.sh <name> <device-type>
# device-type: phone | tablet-7 | tablet-10
set -e

NAME="$1"
TYPE="${2:-phone}"
DIR="/Users/amlug/projects/mango/assets/screenshots/$TYPE"
RAW="$DIR/raw-$NAME.png"
FINAL="$DIR/$NAME.png"

SERIAL="${3:-}"
ADB="adb"
if [ -n "$SERIAL" ]; then
  ADB="adb -s $SERIAL"
fi

echo "Taking screenshot: $NAME ($TYPE)..."
$ADB exec-out screencap -p > "$RAW"

# Get dimensions
W=$(sips -g pixelWidth "$RAW" | tail -1 | awk '{print $2}')
H=$(sips -g pixelHeight "$RAW" | tail -1 | awk '{print $2}')
echo "  Raw: ${W}x${H}"

# Crop to 9:16 aspect ratio
TARGET_H=$((W * 16 / 9))

if [ "$TARGET_H" -gt "$H" ]; then
  # Too tall for 9:16, crop width instead
  TARGET_W=$((H * 9 / 16))
  OFFSET_X=$(( (W - TARGET_W) / 2 ))
  sips -c "$H" "$TARGET_W" --cropOffset 0 "$OFFSET_X" "$RAW" -o "$FINAL"
else
  # Crop height, keeping top content (trim status bar + nav bar)
  OFFSET_Y=$(( (H - TARGET_H) / 3 ))  # bias toward top
  sips -c "$TARGET_H" "$W" --cropOffset "$OFFSET_Y" 0 "$RAW" -o "$FINAL"
fi

FINAL_W=$(sips -g pixelWidth "$FINAL" | tail -1 | awk '{print $2}')
FINAL_H=$(sips -g pixelHeight "$FINAL" | tail -1 | awk '{print $2}')
echo "  Final: ${FINAL_W}x${FINAL_H}"
echo "  Saved: $FINAL"
