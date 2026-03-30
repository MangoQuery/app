#!/bin/bash
# Capture real Mango screenshots from Android device/emulator for all 13 languages.
#
# Prerequisites:
#   - Android device or emulator connected (adb devices)
#   - Perry compiler built
#   - NDK installed
#
# Usage:
#   bash screenshots/capture-android.sh
#   bash screenshots/capture-android.sh --skip-build
#
# Output: playstore/screenshots/{play_locale}/screenshot_{scene}.png (65 files)

set -e

PERRY_DIR="$(cd "$(dirname "$0")/../../perry/perry" && pwd)"
MANGO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="mango-android"
PACKAGE_ID="com.skelpo.mango"
ACTIVITY="com.perry.app.PerryActivity"
NDK_VERSION="28.0.12433566"
BUILD_DIR="$MANGO_DIR/${APP_NAME}-build"
SRC="$MANGO_DIR/src/app.ts"
OUTDIR="$MANGO_DIR/playstore/screenshots"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"
NDK_BIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"
export PATH="$NDK_BIN:$PATH"
export CC_aarch64_linux_android="$NDK_BIN/aarch64-linux-android24-clang"
export AR_aarch64_linux_android="$NDK_BIN/llvm-ar"

# Android locale codes → Play Store directory names
ANDROID_LOCALES=(en-US de-DE ja-JP zh-CN es-MX fr-FR pt-BR ko-KR it-IT tr-TR th-TH id-ID vi-VN)
PLAY_DIRS=(en-US de-DE ja-JP zh-CN es-419 fr-FR pt-BR ko-KR it-IT tr-TR th id vi)

# Scene configs
MODES=(1 2 3 4 5)
SUFFIXES=(1_welcome 2_browse 3_query 4_edit 5_about)
SLEEPS=(4 4 4 6 4)

SKIP_BUILD=0
if [ "$1" = "--skip-build" ]; then
  SKIP_BUILD=1
fi

# Verify device is connected
if ! adb devices 2>/dev/null | grep -q "device$"; then
  echo "Error: No Android device/emulator connected."
  echo "Start an emulator or connect a device via USB."
  exit 1
fi

# Step 1: Build Perry runtime for Android
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "==> Building perry-stdlib + perry-ui-android for Android (aarch64)..."
  cd "$PERRY_DIR"
  cargo build --release \
    -p perry-stdlib --no-default-features --features "http-server,http-client,database,compression,websocket,image,scheduler,ids,html-parser,rate-limit,validation,crypto" \
    -p perry-ui-android \
    --target aarch64-linux-android 2>&1 | grep -E '(Compiling|Finished|error)'
fi

# Ensure Gradle project exists (reuse from android.sh build dir)
setup_gradle_project() {
  TEMPLATE_DIR="$PERRY_DIR/crates/perry-ui-android/template"

  mkdir -p "$BUILD_DIR/app/src/main/java/com/perry/app"
  mkdir -p "$BUILD_DIR/app/src/main/res/values"
  mkdir -p "$BUILD_DIR/app/src/main/jniLibs/arm64-v8a"
  mkdir -p "$BUILD_DIR/app/src/main/assets"

  cp "$TEMPLATE_DIR/build.gradle.kts" "$BUILD_DIR/"
  cp "$TEMPLATE_DIR/settings.gradle.kts" "$BUILD_DIR/"
  cp "$TEMPLATE_DIR/gradle.properties" "$BUILD_DIR/"
  cp "$TEMPLATE_DIR/app/src/main/java/com/perry/app/PerryActivity.kt" "$BUILD_DIR/app/src/main/java/com/perry/app/"
  cp "$TEMPLATE_DIR/app/src/main/java/com/perry/app/PerryBridge.kt" "$BUILD_DIR/app/src/main/java/com/perry/app/"
  cp "$TEMPLATE_DIR/app/src/main/java/com/perry/app/HoneEditorView.kt" "$BUILD_DIR/app/src/main/java/com/perry/app/"
  cp "$TEMPLATE_DIR/app/src/main/res/values/themes.xml" "$BUILD_DIR/app/src/main/res/values/"

  # Launcher icons
  ICON_SRC="$MANGO_DIR/logo/mango-app-icon-512.png"
  for density_size in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
    density="${density_size%% *}"
    size="${density_size##* }"
    mkdir -p "$BUILD_DIR/app/src/main/res/mipmap-$density"
    sips -z "$size" "$size" "$ICON_SRC" --out "$BUILD_DIR/app/src/main/res/mipmap-$density/ic_launcher.png" >/dev/null 2>&1
  done

  # Splash screen
  mkdir -p "$BUILD_DIR/app/src/main/res/drawable"
  cp "$MANGO_DIR/logo/mango-app-icon-256.png" "$BUILD_DIR/app/src/main/res/drawable/splash_image.png"

  cat > "$BUILD_DIR/app/src/main/res/drawable/splash_background.xml" << 'SPLASH'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><color android:color="#FFF5EE"/></item>
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_image"/>
    </item>
</layer-list>
SPLASH

  cat > "$BUILD_DIR/app/src/main/res/values/themes.xml" << 'THEMES'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.Perry" parent="android:Theme.Material.Light.NoActionBar">
    </style>
    <style name="Theme.Perry.Splash" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_background</item>
    </style>
</resources>
THEMES

  if [ -d "$MANGO_DIR/logo" ]; then
    cp -r "$MANGO_DIR/logo" "$BUILD_DIR/app/src/main/assets/"
  fi
  if [ -d "$MANGO_DIR/assets" ]; then
    mkdir -p "$BUILD_DIR/app/src/main/assets/assets"
    cp "$MANGO_DIR"/assets/*.png "$BUILD_DIR/app/src/main/assets/assets/" 2>/dev/null || true
  fi

  cat > "$BUILD_DIR/app/build.gradle.kts" << 'GRADLE'
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.perry.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.skelpo.mango"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        ndk { abiFilters += "arm64-v8a" }
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets { getByName("main") { jniLibs.srcDirs("src/main/jniLibs") } }
}
dependencies { implementation("androidx.core:core-ktx:1.12.0") }
GRADLE

  cat > "$BUILD_DIR/app/src/main/AndroidManifest.xml" << 'MANIFEST'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.perry.app">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:allowBackup="true"
        android:label="Mango"
        android:icon="@mipmap/ic_launcher"
        android:theme="@android:style/Theme.Material.Light.NoActionBar"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".PerryActivity"
            android:exported="true"
            android:theme="@style/Theme.Perry.Splash"
            android:configChanges="orientation|screenSize|keyboardHidden|locale|layoutDirection">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
MANIFEST

  # Gradle wrapper
  if [ ! -f "$BUILD_DIR/gradlew" ]; then
    cd "$BUILD_DIR"
    gradle wrapper --gradle-version 8.10.2 2>&1 | tail -1
  fi
}

build_and_install_apk() {
  local so_file="$MANGO_DIR/$APP_NAME"
  cp "$so_file" "$BUILD_DIR/app/src/main/jniLibs/arm64-v8a/libperry_app.so"

  # Copy hone editor .so if present
  local hone_so="$PERRY_DIR/../hone/hone-editor/native/android/target/aarch64-linux-android/release/libhone_editor_android.so"
  if [ -f "$hone_so" ]; then
    cp "$hone_so" "$BUILD_DIR/app/src/main/jniLibs/arm64-v8a/"
  fi

  cd "$BUILD_DIR"
  ./gradlew assembleDebug 2>&1 | grep -E '(BUILD|error|FAILED)' || true

  local apk="$BUILD_DIR/app/build/outputs/apk/debug/app-debug.apk"
  if [ ! -f "$apk" ]; then
    echo "ERROR: APK not found at $apk"
    exit 1
  fi

  adb install -r "$apk" 2>&1 | tail -1
}

# Setup Gradle project once
echo "==> Setting up Gradle project..."
setup_gradle_project

# Step 2: For each scene, compile once and capture across all languages
for mode_idx in 0 1 2 3 4; do
  MODE=${MODES[$mode_idx]}
  SUFFIX=${SUFFIXES[$mode_idx]}
  SLEEP_TIME=${SLEEPS[$mode_idx]}

  echo ""
  echo "========================================"
  echo "  Scene $MODE: $SUFFIX (sleep ${SLEEP_TIME}s)"
  echo "========================================"

  # Patch SCREENSHOT_MODE
  sed -i '' "s/const SCREENSHOT_MODE = .*/const SCREENSHOT_MODE = $MODE;/" "$SRC"

  # Compile for Android
  echo "  Compiling for Android..."
  cd "$PERRY_DIR"
  cargo run --release -- compile --target android "$SRC" -o "$MANGO_DIR/$APP_NAME" 2>&1 | tail -3

  # Build APK and install
  echo "  Building APK and installing..."
  build_and_install_apk

  # Capture for each language
  for lang_idx in $(seq 0 $((${#ANDROID_LOCALES[@]} - 1))); do
    LOCALE="${ANDROID_LOCALES[$lang_idx]}"
    DIR_NAME="${PLAY_DIRS[$lang_idx]}"

    mkdir -p "$OUTDIR/$DIR_NAME"

    # Set device language
    adb shell settings put system system_locales "$LOCALE"

    # Force-stop and relaunch
    adb shell am force-stop "$PACKAGE_ID" 2>/dev/null || true
    sleep 1
    adb shell am start -n "$PACKAGE_ID/$ACTIVITY" 2>/dev/null

    # Wait for UI to render
    sleep "$SLEEP_TIME"

    # Capture screenshot
    OUTFILE="$OUTDIR/$DIR_NAME/screenshot_${SUFFIX}.png"
    adb exec-out screencap -p > "$OUTFILE"
    echo "  [$DIR_NAME] screenshot_${SUFFIX}.png"

    # Force-stop
    adb shell am force-stop "$PACKAGE_ID" 2>/dev/null || true
  done
done

# Restore source and device language
sed -i '' "s/const SCREENSHOT_MODE = .*/const SCREENSHOT_MODE = 0;/" "$SRC"
adb shell settings put system system_locales "en-US"

TOTAL=$(find "$OUTDIR" -name 'screenshot_*.png' 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Done! $TOTAL Android screenshots captured."
echo "Next: python playstore/upload.py screenshots"
