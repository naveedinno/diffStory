"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const navigation_js_1 = require("./navigation.js");
function toTarget(location) {
    if ('targetUri' in location) {
        return { uri: location.targetUri, selection: location.targetSelectionRange ?? location.targetRange };
    }
    return { uri: location.uri, selection: location.range };
}
function uniqueTargets(locations) {
    const targets = [];
    const seen = new Set();
    for (const location of locations ?? []) {
        const target = toTarget(location);
        const key = `${target.uri.toString()}#${target.selection.start.line}:${target.selection.start.character}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        targets.push(target);
    }
    return targets;
}
async function providerTargets(command, source, position) {
    try {
        const locations = await vscode.commands.executeCommand(command, source, position);
        return uniqueTargets(locations);
    }
    catch {
        return [];
    }
}
async function chooseTarget(targets, kind) {
    if (targets.length < 2)
        return targets[0];
    const selected = await vscode.window.showQuickPick(targets.map((target) => ({
        label: vscode.workspace.asRelativePath(target.uri, false),
        description: `line ${target.selection.start.line + 1}`,
        detail: target.uri.fsPath,
        target,
    })), { placeHolder: `Choose ${kind}` });
    return selected?.target;
}
async function openTarget(target) {
    await vscode.window.showTextDocument(target.uri, {
        preview: true,
        preserveFocus: false,
        selection: target.selection,
    });
}
async function navigate(uri) {
    if (uri.path !== '/navigate')
        return;
    const request = (0, navigation_js_1.parseNavigationQuery)(uri.query);
    if (!request) {
        await vscode.window.showErrorMessage('DiffStory sent an invalid code-navigation request.');
        return;
    }
    try {
        const source = vscode.Uri.file(request.path);
        if (!vscode.workspace.getWorkspaceFolder(source)) {
            await vscode.window.showErrorMessage('Open the reviewed repository in VS Code before navigating from DiffStory.');
            return;
        }
        const document = await vscode.workspace.openTextDocument(source);
        const line = Math.min(request.line - 1, Math.max(0, document.lineCount - 1));
        const character = Math.min(request.column - 1, document.lineAt(line).text.length);
        const position = new vscode.Position(line, character);
        const sourceSelection = new vscode.Range(position, position);
        // Activating the source editor gives installed language extensions the same
        // context they receive before a normal F12/Cmd-click navigation request.
        await vscode.window.showTextDocument(document, {
            preview: true,
            preserveFocus: false,
            selection: sourceSelection,
        });
        const implementations = await providerTargets('vscode.executeImplementationProvider', source, position);
        const implementation = await chooseTarget(implementations, 'implementation');
        if (implementation) {
            await openTarget(implementation);
            return;
        }
        const definitions = await providerTargets('vscode.executeDefinitionProvider', source, position);
        const definition = await chooseTarget(definitions, 'definition');
        if (definition) {
            await openTarget(definition);
            return;
        }
        await vscode.window.showInformationMessage('No implementation or definition was reported; opened the clicked symbol instead.');
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`DiffStory could not open that symbol: ${detail}`);
    }
}
function activate(context) {
    context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: navigate }));
}
//# sourceMappingURL=extension.js.map