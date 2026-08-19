# diffStory for Zed

This extension adds a local diffStory MCP server to the Zed Agent panel. It
provides a `diffstory` prompt and a `start_diffstory` tool that hand the current
worktree and requested depth to the installed `diffstory-storyteller` skill, so
Zed Agent can create the same validated story files as Codex and Claude.

After installation, enable the **diffStory** MCP server in the active Agent
profile. Ask Zed Agent to “create a guided diffStory using diffStory”, or select
the `diffstory` MCP prompt when prompts are exposed by the active Agent UI.
`brief`, `guided`, and `detailed` modes are supported.

## Install from this checkout

First install the storyteller skill and select Zed for source jumps:

```sh
./scripts/install-zed-integration.sh
```

Then open Zed's Extensions page, choose **Install Dev Extension**, and select
this `zed-extension` directory. Zed will offer to configure and enable the
bundled MCP server after the extension is installed.

## Why the story viewer remains in diffStory

Zed extensions do not currently expose a custom panel or webview API. The
extension therefore owns the Zed-native Agent entry point, while the diffStory
desktop app remains the authoritative story, diff, comments, narration, and
coverage surface. Command-clicking current-side code in diffStory opens the
reviewed workspace and exact source location in Zed.

## Development

```sh
cargo test --manifest-path zed-extension/Cargo.toml
cargo check --manifest-path zed-extension/Cargo.toml --target wasm32-wasip2
node --test test/zed-mcp-server.test.mjs
```
