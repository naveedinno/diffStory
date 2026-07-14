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
exports.listStories = listStories;
exports.loadStory = loadStory;
exports.deleteStory = deleteStory;
exports.stampStoryFingerprint = stampStoryFingerprint;
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const model_1 = require("./model");
const PRIMARY = 'story.json';
const LEGACY = 'review-tour.json';
function dataDir(repo) {
    return vscode.Uri.joinPath(repo, '.diffstory');
}
async function listStories(repo) {
    const ids = [PRIMARY, LEGACY, ...await nestedStoryIds(repo)];
    const summaries = await Promise.all(ids.map((id) => loadStory(repo, id)));
    return summaries.filter((story) => Boolean(story));
}
async function loadStory(repo, id = PRIMARY) {
    if (!safeId(id))
        return undefined;
    const uri = vscode.Uri.joinPath(dataDir(repo), ...id.split('/'));
    try {
        const [contents, info] = await Promise.all([(0, promises_1.readFile)(uri.fsPath, 'utf8'), (0, promises_1.stat)(uri.fsPath)]);
        const story = (0, model_1.parseTour)(JSON.parse(contents));
        if (!story)
            return { id, uri, title: path.basename(id, '.json'), summary: '', updatedAt: info.mtimeMs, valid: false, error: 'Unsupported story schema' };
        return { id, uri, title: story.title, summary: story.summary, updatedAt: info.mtimeMs, valid: true, story };
    }
    catch (error) {
        const code = error.code;
        if (code === 'ENOENT')
            return undefined;
        return { id, uri, title: path.basename(id, '.json'), summary: '', updatedAt: 0, valid: false, error: error.message };
    }
}
async function deleteStory(repo, id) {
    if (!safeId(id))
        return false;
    try {
        await (0, promises_1.unlink)(vscode.Uri.joinPath(dataDir(repo), ...id.split('/')).fsPath);
        return true;
    }
    catch {
        return false;
    }
}
/** Stamp agent-written stories with the same exact-diff identity used by the web app. */
async function stampStoryFingerprint(repo, id, fingerprint) {
    if (!safeId(id) || !/^[0-9a-f]{64}$/i.test(fingerprint))
        return false;
    const uri = vscode.Uri.joinPath(dataDir(repo), ...id.split('/'));
    try {
        const parsed = JSON.parse(await (0, promises_1.readFile)(uri.fsPath, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return false;
        parsed.diffFingerprint = fingerprint.toLowerCase();
        await (0, promises_1.writeFile)(uri.fsPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
        return true;
    }
    catch {
        return false;
    }
}
async function nestedStoryIds(repo) {
    const root = path.join(repo.fsPath, '.diffstory', 'stories');
    const ids = [];
    const visit = async (dir, prefix = '') => {
        let entries;
        try {
            entries = await (0, promises_1.readdir)(dir, { withFileTypes: true, encoding: 'utf8' });
        }
        catch {
            return;
        }
        await Promise.all(entries.map(async (entry) => {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory())
                return visit(full, relative);
            if (entry.isFile() && entry.name.endsWith('.json'))
                ids.push(`stories/${relative}`);
        }));
    };
    await visit(root);
    return ids.sort((a, b) => a.localeCompare(b));
}
function safeId(id) {
    return Boolean(id) && !id.startsWith('/') && !id.includes('\\') && !id.split('/').includes('..') && id.endsWith('.json');
}
//# sourceMappingURL=stories.js.map