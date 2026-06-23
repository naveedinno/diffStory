#!/bin/sh
set -eu

VENV_DIR="${DIFFSTORY_KOKORO_VENV:-$HOME/.diffstory/kokoro-venv}"
PYTHON_BIN="${DIFFSTORY_KOKORO_BOOTSTRAP_PYTHON:-}"

say() {
  printf '%s\n' "$*"
}

note() {
  printf '%s\n' "$*" >&2
}

fail() {
  note "Error: $*"
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

brew_prefix() {
  brew --prefix "$1" 2>/dev/null || true
}

find_python312() {
  if [ -n "$PYTHON_BIN" ]; then
    [ -x "$PYTHON_BIN" ] || fail "DIFFSTORY_KOKORO_BOOTSTRAP_PYTHON is not executable: $PYTHON_BIN"
    printf '%s\n' "$PYTHON_BIN"
    return
  fi

  if has_cmd python3.12; then
    command -v python3.12
    return
  fi

  for candidate in \
    "/opt/homebrew/opt/python@3.12/bin/python3.12" \
    "/usr/local/opt/python@3.12/bin/python3.12"
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  if has_cmd brew; then
    note "Installing Python 3.12 with Homebrew..."
    brew install python@3.12 >&2
    prefix="$(brew_prefix python@3.12)"
    if [ -n "$prefix" ] && [ -x "$prefix/bin/python3.12" ]; then
      printf '%s\n' "$prefix/bin/python3.12"
      return
    fi
  fi

  fail "Python 3.12 is required because current Kokoro wheels require Python >=3.10,<3.13. Install it with: brew install python@3.12"
}

ensure_espeak() {
  if has_cmd espeak-ng; then
    return
  fi
  has_cmd brew || fail "espeak-ng is missing. Install Homebrew or run: brew install espeak-ng"
  say "Installing espeak-ng with Homebrew..."
  brew install espeak-ng
}

reset_wrong_venv() {
  if [ ! -x "$VENV_DIR/bin/python" ]; then
    return
  fi

  existing_version="$("$VENV_DIR/bin/python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
  if [ "$existing_version" = "3.12" ]; then
    return
  fi

  case "$VENV_DIR" in
    ""|"/"|"$HOME")
      fail "Refusing to remove unsafe venv path: $VENV_DIR"
      ;;
  esac

  note "Replacing existing Kokoro venv built with Python ${existing_version:-unknown}; Kokoro needs Python 3.12."
  rm -rf "$VENV_DIR"
}

ensure_espeak
PY312="$(find_python312)"

say "Using Python: $PY312"
say "Creating Kokoro venv: $VENV_DIR"
reset_wrong_venv
mkdir -p "$(dirname "$VENV_DIR")"
"$PY312" -m venv "$VENV_DIR"

say "Installing Kokoro packages..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install --upgrade --no-cache-dir "kokoro>=0.9.4" soundfile

cat <<EOF

Kokoro is ready.

diffStory will auto-use:
  $VENV_DIR/bin/python

If you run from another shell and want to force it:
  export DIFFSTORY_KOKORO_PYTHON="$VENV_DIR/bin/python"

Now start diffStory, choose Kokoro AI, and press Preview.
EOF
