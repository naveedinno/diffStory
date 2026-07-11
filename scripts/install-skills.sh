#!/usr/bin/env bash
#
# Install the diffStory agent skills (diffstory-storyteller, address-review) into an agent's
# skills directory, so any SKILL.md-aware agent (Codex, Cursor, Claude Code, …) can
# drive the review loop. Run it from a clone of the diffStory repo.
#
#   ./scripts/install-skills.sh            Install to ~/.agents/skills (Codex, Cursor, …)
#   ./scripts/install-skills.sh --claude   Also install to ~/.claude/skills (Claude Code)
#   ./scripts/install-skills.sh --dir DIR  Install to a directory you choose
#   ./scripts/install-skills.sh --help     Show this help
#
# (Claude Code users normally use the plugin instead: /plugin install diffstory@diffstory)
set -eo pipefail

usage() { sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
SRC="$(cd "$SCRIPT_DIR/.." && pwd)/skills"
SKILLS="diffstory-storyteller address-review"

CLAUDE=0
CUSTOM_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --claude) CLAUDE=1 ;;
    --dir) shift; CUSTOM_DIR="${1:-}"; [ -n "$CUSTOM_DIR" ] || { echo "--dir needs a path" >&2; exit 2; } ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

[ -d "$SRC" ] || { echo "error: can't find skills/ at $SRC — run this from a clone of the diffStory repo." >&2; exit 1; }

install_into() {
  dest="$1"
  mkdir -p "$dest"
  # Remove the retired name so updates cannot leave two storyteller skills installed.
  rm -rf "$dest/review-tour"
  for s in $SKILLS; do
    rm -rf "$dest/$s"
    cp -R "$SRC/$s" "$dest/$s"
    echo "  installed $s -> $dest/$s"
  done
}

if [ -n "$CUSTOM_DIR" ]; then
  install_into "$CUSTOM_DIR"
else
  install_into "$HOME/.agents/skills"
  [ "$CLAUDE" = "1" ] && install_into "$HOME/.claude/skills"
fi

echo
echo "Done. Skills are live for agents that read those directories:"
echo "  ~/.agents/skills  ->  Codex (\$diffstory-storyteller / \$address-review), Cursor, etc."
echo "  ~/.claude/skills  ->  Claude Code (or just use the plugin)"
echo
echo "Open the app with:  diffstory"
