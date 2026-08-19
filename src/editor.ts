import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { SourceEditor } from "./editor-preferences.js";

export interface EditorNavigationTarget {
  repo: string;
  path: string;
  line: number;
  column: number;
}

/** Resolve and confine a clicked source location to the reviewed repository. */
export function editorNavigationTarget(
  repo: string,
  file: string,
  line: number,
  column: number,
): EditorNavigationTarget | null {
  if (
    !file ||
    isAbsolute(file) ||
    !Number.isInteger(line) ||
    line < 1 ||
    !Number.isInteger(column) ||
    column < 1
  ) {
    return null;
  }
  const root = resolve(repo);
  const target = resolve(root, file);
  const fromRoot = relative(root, target);
  if (
    !fromRoot ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(fromRoot)
  ) {
    return null;
  }
  return { repo: root, path: target, line, column };
}

export function editorLabel(editor: SourceEditor): string {
  return editor === "zed" ? "Zed" : "VS Code";
}

/** VS Code establishes the repo workspace before revealing the source point. */
export function vscodeLaunchArgs(target: EditorNavigationTarget): string[] {
  return [
    "--reuse-window",
    target.repo,
    "--goto",
    `${target.path}:${target.line}:${target.column}`,
  ];
}

/** Zed accepts a workspace plus path:line:column in one stock CLI invocation. */
export function zedLaunchArgs(target: EditorNavigationTarget): string[] {
  return [target.repo, `${target.path}:${target.line}:${target.column}`];
}

/**
 * Percent-encode an absolute filesystem path for the path portion of a URI.
 * Separators stay literal so the result still reads as a path; a Windows drive
 * letter keeps its colon, which VS Code's handler expects.
 */
function encodeFsPathForUri(target: string): string {
  const normalized = target.replace(/\\/g, "/");
  const rooted = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return rooted
    .split("/")
    .map((segment, index) =>
      index === 1 && /^[A-Za-z]:$/.test(segment)
        ? segment
        : encodeURIComponent(segment),
    )
    .join("/");
}

function vscodeFileUrl(target: EditorNavigationTarget): string {
  return `vscode://file${encodeFsPathForUri(target.path)}:${target.line}:${target.column}`;
}

function vscodeFolderUrl(target: EditorNavigationTarget): string {
  return `vscode://file${encodeFsPathForUri(target.repo)}`;
}

/** Built-in file URI retained as a fallback for stock VS Code installs. */
export function vscodeNavigationUrl(
  repo: string,
  file: string,
  line: number,
  column: number,
): string | null {
  const target = editorNavigationTarget(repo, file, line, column);
  return target ? vscodeFileUrl(target) : null;
}

export function openVSCodeTargetWithUrls(
  target: EditorNavigationTarget,
  openExternal: (url: string) => boolean,
): boolean {
  if (!openExternal(vscodeFolderUrl(target))) return false;
  return openExternal(vscodeFileUrl(target));
}

function editorCommands(editor: SourceEditor, home: string): string[] {
  if (editor === "zed") {
    return process.platform === "darwin"
      ? [
          "/Applications/Zed.app/Contents/MacOS/zed",
          join(home, "Applications/Zed.app/Contents/MacOS/zed"),
          "zed",
        ]
      : ["zed"];
  }
  return process.platform === "darwin"
    ? [
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        join(
          home,
          "Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        ),
        "code",
      ]
    : ["code"];
}

function openExternalUrl(url: string): boolean {
  const command =
    process.platform === "darwin"
      ? "/usr/bin/open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    execFileSync(command, args, { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export function openEditorTarget(
  target: EditorNavigationTarget,
  editor: SourceEditor,
): boolean {
  const args = editor === "zed" ? zedLaunchArgs(target) : vscodeLaunchArgs(target);
  for (const command of editorCommands(editor, homedir())) {
    try {
      execFileSync(command, args, { stdio: "ignore", timeout: 5_000 });
      return true;
    } catch {
      // Try the next stock CLI location.
    }
  }
  return editor === "vscode"
    ? openVSCodeTargetWithUrls(target, openExternalUrl)
    : false;
}

// Compatibility names retained for consumers of the previous VS Code-only API.
export type VSCodeNavigationTarget = EditorNavigationTarget;
export const vscodeNavigationTarget = editorNavigationTarget;
