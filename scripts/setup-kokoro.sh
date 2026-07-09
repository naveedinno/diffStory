#!/bin/sh
set -eu

VENV_DIR="${DIFFSTORY_KOKORO_VENV:-$HOME/.diffstory/kokoro-venv}"
PYTHON_BIN="${DIFFSTORY_KOKORO_BOOTSTRAP_PYTHON:-}"
SUPPORTED_PYTHON="Python 3.10-3.12"

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

python_version() {
  "$1" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true
}

python_is_compatible() {
  "$1" -c 'import sys; raise SystemExit(0 if sys.version_info.major == 3 and 10 <= sys.version_info.minor < 13 else 1)' >/dev/null 2>&1
}

print_if_compatible() {
  candidate="$1"
  if [ -x "$candidate" ] && python_is_compatible "$candidate"; then
    printf '%s\n' "$candidate"
    return 0
  fi
  return 1
}

find_compatible_python() {
  if [ -n "$PYTHON_BIN" ]; then
    candidate="$PYTHON_BIN"
    if has_cmd "$candidate"; then
      candidate="$(command -v "$candidate")"
    fi
    [ -x "$candidate" ] || fail "DIFFSTORY_KOKORO_BOOTSTRAP_PYTHON is not executable: $PYTHON_BIN"
    if python_is_compatible "$candidate"; then
      printf '%s\n' "$candidate"
      return
    fi
    version="$(python_version "$candidate")"
    fail "DIFFSTORY_KOKORO_BOOTSTRAP_PYTHON must be $SUPPORTED_PYTHON (found ${version:-unknown})."
  fi

  for cmd in python3 python3.12 python3.11 python3.10
  do
    if has_cmd "$cmd" && print_if_compatible "$(command -v "$cmd")"; then
      return
    fi
  done

  for candidate in \
    "/opt/homebrew/opt/python@3.12/bin/python3.12" \
    "/usr/local/opt/python@3.12/bin/python3.12" \
    "/opt/homebrew/opt/python@3.11/bin/python3.11" \
    "/usr/local/opt/python@3.11/bin/python3.11" \
    "/opt/homebrew/opt/python@3.10/bin/python3.10" \
    "/usr/local/opt/python@3.10/bin/python3.10"
  do
    if print_if_compatible "$candidate"; then
      return
    fi
  done

  if has_cmd brew; then
    note "Installing a Kokoro-compatible Python with Homebrew..."
    brew install python@3.12 >&2
    prefix="$(brew_prefix python@3.12)"
    if [ -n "$prefix" ] && [ -x "$prefix/bin/python3.12" ] && python_is_compatible "$prefix/bin/python3.12"; then
      printf '%s\n' "$prefix/bin/python3.12"
      return
    fi
  fi

  fail "Kokoro AI voice setup needs $SUPPORTED_PYTHON. Install a compatible Python (for example: brew install python@3.12) or set DIFFSTORY_KOKORO_BOOTSTRAP_PYTHON=/path/to/python."
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

  if python_is_compatible "$VENV_DIR/bin/python"; then
    return
  fi
  existing_version="$(python_version "$VENV_DIR/bin/python")"

  case "$VENV_DIR" in
    ""|"/"|"$HOME")
      fail "Refusing to remove unsafe venv path: $VENV_DIR"
      ;;
  esac

  note "Replacing existing Kokoro venv built with Python ${existing_version:-unknown}; Kokoro needs $SUPPORTED_PYTHON."
  rm -rf "$VENV_DIR"
}

ensure_espeak
PYTHON="$(find_compatible_python)"

say "Using Python: $PYTHON"
say "Creating Kokoro venv: $VENV_DIR"
reset_wrong_venv
mkdir -p "$(dirname "$VENV_DIR")"
"$PYTHON" -m venv "$VENV_DIR"

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
