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
const PENDING_NAVIGATION_KEY = 'diffstory.pendingNavigation';
const PENDING_NAVIGATION_TTL_MS = 5 * 60 * 1000;
async function navigateRequest(request) {
    try {
        const source = vscode.Uri.file(request.path);
        const document = await vscode.workspace.openTextDocument(source);
        const point = (0, navigation_js_1.clampNavigationPoint)(request, document.lineCount, (line) => document.lineAt(line).text.length);
        const position = new vscode.Position(point.line, point.character);
        const sourceSelection = new vscode.Range(position, position);
        const editor = await vscode.window.showTextDocument(document, {
            preview: true,
            preserveFocus: false,
            selection: sourceSelection,
        });
        editor.revealRange(sourceSelection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`DiffStory could not open that source location: ${detail}`);
    }
}
async function validateRepository(repo) {
    const repository = vscode.Uri.file(repo);
    const stat = await vscode.workspace.fs.stat(repository);
    if (!(stat.type & vscode.FileType.Directory))
        throw new Error('The reviewed repository folder is unavailable.');
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(repository, '.git'));
    return repository;
}
async function resumePendingNavigation(context) {
    const pending = context.globalState.get(PENDING_NAVIGATION_KEY);
    if (!pending)
        return;
    if (!pending.request ||
        !Number.isFinite(pending.requestedAt) ||
        Date.now() - pending.requestedAt > PENDING_NAVIGATION_TTL_MS) {
        await context.globalState.update(PENDING_NAVIGATION_KEY, undefined);
        return;
    }
    const source = vscode.Uri.file(pending.request.path);
    if (!vscode.workspace.getWorkspaceFolder(source))
        return;
    await context.globalState.update(PENDING_NAVIGATION_KEY, undefined);
    await navigateRequest(pending.request);
}
async function navigate(uri, context) {
    if (uri.path !== '/navigate')
        return;
    const request = (0, navigation_js_1.parseNavigationQuery)(uri.query);
    if (!request) {
        await vscode.window.showErrorMessage('DiffStory sent an invalid code-navigation request.');
        return;
    }
    try {
        const preparation = await (0, navigation_js_1.prepareNavigation)(request, {
            containsSource: (path) => Boolean(vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path))),
            persistPending: async (pending) => {
                await context.globalState.update(PENDING_NAVIGATION_KEY, {
                    request: pending,
                    requestedAt: Date.now(),
                });
            },
            openRepository: async (repo) => {
                const repository = await validateRepository(repo);
                await vscode.commands.executeCommand('vscode.openFolder', repository, false);
            },
        });
        if (preparation === 'ready')
            await navigateRequest(request);
        else
            await resumePendingNavigation(context);
    }
    catch (error) {
        await context.globalState.update(PENDING_NAVIGATION_KEY, undefined);
        const detail = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`DiffStory could not open the reviewed repository: ${detail}`);
    }
}
function activate(context) {
    context.subscriptions.push(vscode.window.registerUriHandler({ handleUri: (uri) => navigate(uri, context) }), vscode.workspace.onDidChangeWorkspaceFolders(() => { void resumePendingNavigation(context); }));
    void resumePendingNavigation(context);
}
//# sourceMappingURL=extension.js.map