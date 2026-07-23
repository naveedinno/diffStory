#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h:h}"
SOURCE_DIR="$PROJECT_DIR/macos/DiffStoryApp"
INSTALL_DIR="$HOME/Applications"
APP_PATH="$INSTALL_DIR/diffStory.app"
BUILD_DIR="$(mktemp -d "${TMPDIR%/}/diffstory-macos.XXXXXX")"
BUILD_APP="$BUILD_DIR/diffStory.app"
CARGO_TARGET_DIR="$PROJECT_DIR/.macos-build/target"
INSTALLED_EXECUTABLE="$APP_PATH/Contents/MacOS/diffStory"
SERVER_ENTRY="$PROJECT_DIR/dist/app-server.js"
INTEL_SERVER_COMMAND="/usr/local/bin/node $SERVER_ENTRY --no-open --port 7787"
ARM_SERVER_COMMAND="/opt/homebrew/bin/node $SERVER_ENTRY --no-open --port 7787"
RELAUNCH_APP=0

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
node "$PROJECT_DIR/scripts/build-icns.mjs" "$ICONSET" "$BUILD_APP/Contents/Resources/diffStory.icns"

/usr/bin/codesign --force --deep --sign - "$BUILD_APP"
mkdir -p "$INSTALL_DIR"

if /usr/bin/pgrep -f -x "$INSTALLED_EXECUTABLE" >/dev/null 2>&1; then
  RELAUNCH_APP=1
  /usr/bin/osascript -e 'tell application id "local.diffstory.desktop" to quit' >/dev/null 2>&1 || \
    /usr/bin/pkill -TERM -f -x "$INSTALLED_EXECUTABLE"
  for _attempt in {1..50}; do
    if ! /usr/bin/pgrep -f -x "$INSTALLED_EXECUTABLE" >/dev/null 2>&1; then
      break
    fi
    /bin/sleep 0.1
  done
  if /usr/bin/pgrep -f -x "$INSTALLED_EXECUTABLE" >/dev/null 2>&1; then
    echo "Could not close the running diffStory app. Quit it manually and run this installer again." >&2
    exit 1
  fi
fi

# A shell terminated by an older installer can leave the exact project-owned
# server orphaned. Stop only that known command; never kill an arbitrary owner
# of the port.
for _server_command in "$INTEL_SERVER_COMMAND" "$ARM_SERVER_COMMAND"; do
  if /usr/bin/pgrep -f -x "$_server_command" >/dev/null 2>&1; then
    /usr/bin/pkill -TERM -f -x "$_server_command"
  fi
done
for _attempt in {1..50}; do
  if ! /usr/bin/pgrep -f -x "$INTEL_SERVER_COMMAND" >/dev/null 2>&1 && \
    ! /usr/bin/pgrep -f -x "$ARM_SERVER_COMMAND" >/dev/null 2>&1; then
    break
  fi
  /bin/sleep 0.1
done
if /usr/bin/pgrep -f -x "$INTEL_SERVER_COMMAND" >/dev/null 2>&1 || \
  /usr/bin/pgrep -f -x "$ARM_SERVER_COMMAND" >/dev/null 2>&1; then
  echo "Could not close the running diffStory server. Stop it manually and run this installer again." >&2
  exit 1
fi

/usr/bin/ditto "$BUILD_APP" "$APP_PATH"
if (( RELAUNCH_APP )); then
  /usr/bin/open "$APP_PATH"
fi

echo "Installed or updated diffStory at $APP_PATH"
echo "Open it from Spotlight, Finder, or Launchpad."
