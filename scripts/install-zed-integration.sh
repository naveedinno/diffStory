#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"

"$PROJECT_DIR/scripts/install-skills.sh"
node "$PROJECT_DIR/scripts/set-source-editor.mjs" zed

echo
echo "Zed integration is ready:"
echo "  - Zed Agent can load diffstory-storyteller from ~/.agents/skills"
echo "  - diffStory source jumps now open in Zed"
echo
echo "Finish the local extension install in Zed:"
echo "  1. Open Extensions"
echo "  2. Choose Install Dev Extension"
echo "  3. Select $PROJECT_DIR/zed-extension"
echo
echo "Then enable the diffStory MCP server in the active Agent profile."
echo "Ask Zed Agent to create a brief, guided, or detailed diffStory using diffStory."
