#!/bin/bash
set -e

PERRY_DIR="$(cd "$(dirname "$0")/../perry/perry" && pwd)"
MANGO_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="mango-android"
PACKAGE_ID="com.skelpo.mango"
NDK_VERSION="28.0.12433566"
BUILD_DIR="$MANGO_DIR/${APP_NAME}-build"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"

# NDK toolchain must be in PATH for ring/cc-rs cross-compilation
NDK_BIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"
export PATH="$NDK_BIN:$PATH"
export CC_aarch64_linux_android="$NDK_BIN/aarch64-linux-android24-clang"
export AR_aarch64_linux_android="$NDK_BIN/llvm-ar"

echo "==> Building perry-stdlib + perry-ui-android for Android (aarch64)..."
cd "$PERRY_DIR"
# Build without email feature to avoid OpenSSL cross-compile dependency
cargo build --release \
  -p perry-stdlib --no-default-features --features "http-server,http-client,database,compression,websocket,image,scheduler,ids,html-parser,rate-limit,validation,crypto" \
  -p perry-ui-android \
  --target aarch64-linux-android 2>&1 | grep -E '(Compiling|Finished|error)'

echo "==> Compiling mango for Android..."
cargo run --release -- compile --target android "$MANGO_DIR/src/app.ts" -o "$MANGO_DIR/$APP_NAME" 2>&1 | grep -v '^$'

echo "==> Setting up Gradle project..."
TEMPLATE_DIR="$PERRY_DIR/crates/perry-ui-android/template"

mkdir -p "$BUILD_DIR/app/src/main/java/com/perry/app"
mkdir -p "$BUILD_DIR/app/src/main/res/values"
mkdir -p "$BUILD_DIR/app/src/main/jniLibs/arm64-v8a"
mkdir -p "$BUILD_DIR/app/src/main/assets"

# Copy template structure
cp "$TEMPLATE_DIR/build.gradle.kts" "$BUILD_DIR/"
cp "$TEMPLATE_DIR/settings.gradle.kts" "$BUILD_DIR/"
cp "$TEMPLATE_DIR/gradle.properties" "$BUILD_DIR/"
cp "$TEMPLATE_DIR/app/src/main/java/com/perry/app/PerryActivity.kt" "$BUILD_DIR/app/src/main/java/com/perry/app/"
cp "$TEMPLATE_DIR/app/src/main/java/com/perry/app/PerryBridge.kt" "$BUILD_DIR/app/src/main/java/com/perry/app/"
cp "$TEMPLATE_DIR/app/src/main/java/com/perry/app/HoneEditorView.kt" "$BUILD_DIR/app/src/main/java/com/perry/app/"
cp "$TEMPLATE_DIR/app/src/main/res/values/themes.xml" "$BUILD_DIR/app/src/main/res/values/"

# Generate launcher icon mipmap resources
ICON_SRC="$MANGO_DIR/logo/mango-app-icon-512.png"
for density_size in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
    density="${density_size%% *}"
    size="${density_size##* }"
    mkdir -p "$BUILD_DIR/app/src/main/res/mipmap-$density"
    sips -z "$size" "$size" "$ICON_SRC" --out "$BUILD_DIR/app/src/main/res/mipmap-$density/ic_launcher.png" >/dev/null 2>&1
done
echo "  Generated launcher icon mipmaps"

# Generate splash screen resources
mkdir -p "$BUILD_DIR/app/src/main/res/drawable"
cp "$MANGO_DIR/logo/mango-app-icon-256.png" "$BUILD_DIR/app/src/main/res/drawable/splash_image.png"

cat > "$BUILD_DIR/app/src/main/res/drawable/splash_background.xml" << 'SPLASH_DRAWABLE'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><color android:color="#FFF5EE"/></item>
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_image"/>
    </item>
</layer-list>
SPLASH_DRAWABLE

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
echo "  Generated splash screen resources"

# Copy app assets (logo images, etc.) into APK assets directory
if [ -d "$MANGO_DIR/logo" ]; then
    cp -r "$MANGO_DIR/logo" "$BUILD_DIR/app/src/main/assets/"
    echo "  Copied logo/ -> assets/logo/"
fi
# Copy assets/ directory (contains ImageFile references like 'assets/mango-app-icon-128.png')
if [ -d "$MANGO_DIR/assets" ]; then
    mkdir -p "$BUILD_DIR/app/src/main/assets/assets"
    cp "$MANGO_DIR"/assets/*.png "$BUILD_DIR/app/src/main/assets/assets/" 2>/dev/null || true
    echo "  Copied assets/*.png -> assets/assets/"
fi

# Write customized app/build.gradle.kts with mango package ID
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

        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("src/main/jniLibs")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
}
GRADLE

# Write AndroidManifest with mango branding + internet permission
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
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
MANIFEST

# Copy the compiled .so into jniLibs (Perry outputs without .so extension)
SO_FILE="$MANGO_DIR/$APP_NAME"
if [ -f "$SO_FILE" ]; then
    cp "$SO_FILE" "$BUILD_DIR/app/src/main/jniLibs/arm64-v8a/libperry_app.so"
    echo "  Copied $APP_NAME -> jniLibs/arm64-v8a/libperry_app.so"
else
    echo "ERROR: $SO_FILE not found!"
    exit 1
fi

# Copy any additional native library .so files needed by the app
# (e.g. hone-editor-android from @honeide/editor dependency)
HONE_SO="$PERRY_DIR/../hone/hone-editor/native/android/target/aarch64-linux-android/release/libhone_editor_android.so"
if [ -f "$HONE_SO" ]; then
    cp "$HONE_SO" "$BUILD_DIR/app/src/main/jniLibs/arm64-v8a/"
    echo "  Copied libhone_editor_android.so"
fi

# Generate Gradle wrapper if missing
if [ ! -f "$BUILD_DIR/gradlew" ]; then
    echo "==> Generating Gradle wrapper..."
    cd "$BUILD_DIR"
    gradle wrapper --gradle-version 8.10.2 2>&1 | tail -1
fi

echo "==> Building APK..."
cd "$BUILD_DIR"
./gradlew assembleDebug 2>&1 | grep -E '(BUILD|error|FAILED|Task)'

APK_PATH="$BUILD_DIR/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "ERROR: APK not found at $APK_PATH"
    exit 1
fi

echo "==> Installing on device/emulator..."
adb install -r "$APK_PATH"

echo "==> Launching..."
adb shell am start -n "$PACKAGE_ID/com.perry.app.PerryActivity"

echo "Done. Use 'adb logcat -s PerryDebug PerryJNI' to see logs."
