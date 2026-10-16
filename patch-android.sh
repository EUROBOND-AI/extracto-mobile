#!/usr/bin/env bash
# Runs after `cap add android` — injects our icons + camera permission.
set -e
RES="android/app/src/main/res"
MANIFEST="android/app/src/main/AndroidManifest.xml"

# 1. copy launcher icons (overwrite Capacitor defaults)
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  if [ -d "android-res/mipmap-$d" ]; then
    mkdir -p "$RES/mipmap-$d"
    cp -f android-res/mipmap-$d/*.png "$RES/mipmap-$d/" || true
  fi
done
# remove adaptive-icon XML so our PNG icons are used
rm -f "$RES/mipmap-anydpi-v26/ic_launcher.xml" "$RES/mipmap-anydpi-v26/ic_launcher_round.xml" || true

# 2. add CAMERA permission if missing
if ! grep -q 'android.permission.CAMERA' "$MANIFEST"; then
  sed -i 's#<application#<uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <application#' "$MANIFEST"
fi
echo "Android patched."
