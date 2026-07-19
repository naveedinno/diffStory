#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
SOURCE_DIR="$PROJECT_DIR/macos/DiffStoryApp"
INSTALL_DIR="$HOME/Applications"
APP_PATH="$INSTALL_DIR/diffStory.app"
BUILD_DIR="$(mktemp -d "${TMPDIR%/}/diffstory-macos.XXXXXX")"
BUILD_APP="$BUILD_DIR/diffStory.app"
CARGO_TARGET_DIR="$PROJECT_DIR/.macos-build/target"

trap '/bin/rm -rf "$BUILD_DIR"' EXIT

cd "$PROJECT_DIR"
npm run build

mkdir -p "$BUILD_APP/Contents/MacOS" "$BUILD_APP/Contents/Resources"
/usr/bin/ditto "$SOURCE_DIR/Info.plist" "$BUILD_APP/Contents/Info.plist"
CARGO_TARGET_DIR="$CARGO_TARGET_DIR" cargo build \
  --offline \
  --release \
  --manifest-path "$SOURCE_DIR/Cargo.toml"
/usr/bin/ditto "$CARGO_TARGET_DIR/release/diffstory-macos" "$BUILD_APP/Contents/MacOS/diffStory"

ICON_SOURCE="$SOURCE_DIR/icons/icon.png"
ICONSET="$BUILD_DIR/diffStory.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  /usr/bin/sips -z "$size" "$size" "$ICON_SOURCE" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double_size=$((size * 2))
  /usr/bin/sips -z "$double_size" "$double_size" "$ICON_SOURCE" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
/usr/bin/iconutil -c icns "$ICONSET" -o "$BUILD_APP/Contents/Resources/diffStory.icns"

/usr/bin/codesign --force --deep --sign - "$BUILD_APP"
mkdir -p "$INSTALL_DIR"
/usr/bin/ditto "$BUILD_APP" "$APP_PATH"

echo "Installed or updated diffStory at $APP_PATH"
echo "Open it from Spotlight, Finder, or Launchpad."
