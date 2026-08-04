# DiffStory Navigation Bridge

This is the small companion bridge for the DiffStory desktop and web app. It
has no sidebar, review UI, commands, Git model, comments, or story renderer.

When you Command-click or Ctrl-click an identifier in DiffStory, the bridge:

1. receives the reviewed repository and source location through VS Code's
   system URI;
2. opens that repository when it is not already in the current workspace;
3. resumes the requested navigation after VS Code loads the workspace;
4. opens the reviewed file, places the caret at the clicked location, and
   reveals that line without an extra success notification.

## Install from this checkout

```sh
cd vscode-extension
npm install
npm run package
code --install-extension diffstory-vscode-0.9.2.vsix
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
