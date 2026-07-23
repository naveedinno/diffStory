# DiffStory Navigation Bridge

This is the small companion bridge for the DiffStory desktop and web app. It
has no sidebar, review UI, commands, Git model, comments, or story renderer.

When you Command-click or Ctrl-click an identifier in DiffStory, the bridge:

1. receives the source file, line, and column through VS Code's system URI;
2. asks the installed language extension for implementations;
3. falls back to definitions when no implementation is reported; and
4. opens the clicked source location when neither provider has a destination.

The repository should already be open in VS Code so its language extension has
the correct workspace context.

## Install from this checkout

```sh
cd vscode-extension
npm install
npm run package
code --install-extension diffstory-vscode-0.9.0.vsix
```

The package keeps the previous `naveedinno.diffstory-vscode` identifier. Installing
it upgrades and replaces the retired full review extension.

## Development

```sh
npm install
npm run check
```

Open this directory in VS Code and launch the extension host to test the URI
handler during development.
