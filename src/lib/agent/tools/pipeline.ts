/**
 * Tool pipeline — ordered seams around every tool call.
 *
 *   pre-execute   normalize → allowlist guard → (approval seam, not yet wired)
 *   snapshot      taken BEFORE the write, so rollback restores the prior state
 *   execute       the effect, via `sandboxStore` (abstracts bun / webcontainer)
 *   post-execute  observe, log, notify the preview
 *
 * Why seams rather than an if-statement in the write path: policy grows.
 * Rate limits, repeat-tool detection ("wrote App.svelte four times in a row"),
 * and the approval prompt all belong in `pre-execute` and none of them should
 * require editing the filesystem call.
 *
 * Every failure path returns a *result*, never a throw. A denied or failed tool
 * is a durable fact the model must see so it can adapt — swallowing it would
 * leave the model waiting on a step that silently never happened.
 */
import { sandboxStore } from '$lib/sandboxStore';
import { appendToolLog } from '$lib/agentHarness/harnessStore.svelte';
import { isGuestPathReadable, isGuestPathWritable, normalizeGuestPath } from '$lib/agentHarness/pathAllowlist';
import { captureGuestSnapshot } from '$lib/agentHarness/snapshotStore';
import { requestApproval } from '$lib/agent/approval/approvalStore.svelte';
import { summarizeWrite } from '$lib/agent/approval/policy';
import { isAgentToolName, type AgentToolName } from './definitions';

/**
 * Per-call context threaded from the caller — the identity the pipeline itself
 * does not own. `turnId` scopes the approval seam's "allow all this turn"; it is
 * optional so a direct programmatic call (tests, internal tooling) runs without
 * the approval prompt.
 */
export type ToolContext = { turnId?: string };

const SKIP_SCAN_DIRS = new Set(['node_modules', 'dist', 'build', '.svelte-kit', '.git', '.sandboxes']);

/**
 * Orthogonal outcome fields, reported independently.
 *
 * Per the harness defensive rules: never nest one failure flag inside another's
 * branch. A call can be denied *and* have produced no snapshot; a write can
 * succeed while the preview refresh fails. Each is its own field.
 */
export type ToolRunResult = {
	ok: boolean;
	denied: boolean;
	/** Snapshot captured before the write, for rollback. Null when nothing was written. */
	snapshotId: string | null;
	/**
	 * A filesystem effect the caller should record as a durable `fs/observed`
	 * event. Present only when a write actually landed — reported as its own
	 * field rather than reparsed out of `output`, so the durable log reads the
	 * effect the pipeline observed, not a guess about it.
	 */
	observed?: { path: string; op: 'write' | 'delete' };
	output: unknown;
	error?: string;
};

function deny(reason: string, path?: string): ToolRunResult {
	appendToolLog({ kind: 'deny', summary: reason, path });
	return { ok: false, denied: true, snapshotId: null, output: { error: reason }, error: reason };
}

async function listAllowedFiles(dir = '/', recursive = true): Promise<string[]> {
	const fs = sandboxStore.getFs();
	if (!fs) return [];

	const found: string[] = [];
	const startDir = normalizeGuestPath(dir) || '/';

	async function walk(currentDir: string) {
		try {
			const entries = await fs.readdir(currentDir, { withFileTypes: true });
			for (const entry of entries) {
				if (SKIP_SCAN_DIRS.has(entry.name)) continue;
				const relPath = currentDir === '/' || currentDir === '' ? entry.name : `${currentDir}/${entry.name}`;
				if (entry.isDirectory()) {
					if (recursive) {
						await walk(relPath);
					} else {
						found.push(`${relPath}/`);
					}
				} else {
					found.push(relPath);
				}
			}
		} catch {
			// absent or unreadable
		}
	}

	await walk(startDir);
	return found;
}

async function grepFiles(query: string, scopePath?: string, caseSensitive = false): Promise<Array<{ file: string; line: number; text: string }>> {
	const fs = sandboxStore.getFs();
	if (!fs) return [];

	let regex: RegExp;
	try {
		regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
	} catch {
		// Escape query if not a valid regex
		const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
	}

	const files = await listAllowedFiles(scopePath ?? '/');
	const results: Array<{ file: string; line: number; text: string }> = [];

	for (const file of files) {
		if (results.length >= 100) break;
		if (file.endsWith('/')) continue;
		if (!isGuestPathReadable(file)) continue;

		try {
			const content = await fs.readFile(file, 'utf-8');
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (regex.test(line)) {
					results.push({
						file,
						line: i + 1,
						text: line.trimEnd().slice(0, 300),
					});
					if (results.length >= 100) break;
				}
				regex.lastIndex = 0;
			}
		} catch {
			// skip unreadable files
		}
	}

	return results;
}

import { getActiveDiagnostics } from '$lib/agent/diagnostics/errorObserver.svelte';

/**
 * Run one tool call through the pipeline.
 *
 * `input` is whatever the model produced. It is validated here rather than
 * trusted: the SDK checks it against the schema, but the guard below is what
 * actually protects the filesystem, and it must hold even if a schema changes.
 */
export async function runTool(
	name: string,
	input: unknown,
	ctx: ToolContext = {},
): Promise<ToolRunResult> {
	if (!isAgentToolName(name)) {
		return deny(`Unknown tool: ${name}`);
	}

	const args = (input ?? {}) as Record<string, unknown>;
	const tool = name as AgentToolName;

	// ---- getDiagnostics --------------------------------------------------------
	if (tool === 'getDiagnostics') {
		const diagnostics = getActiveDiagnostics();
		appendToolLog({
			kind: 'info',
			summary: `getDiagnostics → ${diagnostics.totalErrors} error(s)`,
		});
		return { ok: true, denied: false, snapshotId: null, output: diagnostics };
	}

	// ---- bash ------------------------------------------------------------------
	if (tool === 'bash') {
		const command = typeof args.command === 'string' ? args.command.trim() : '';
		if (!command) return deny('bash: missing command');

		if (ctx.turnId) {
			const decision = await requestApproval({
				turnId: ctx.turnId,
				tool: 'writeFile',
				path: `bash: ${command}`,
				summary: `Run command: ${command}`,
			});
			if (decision === 'deny') {
				return deny(`Execution of "${command}" was denied.`, command);
			}
		}

		try {
			appendToolLog({ kind: 'info', summary: `bash: ${command}` });
			const result = await sandboxStore.exec!(command);
			return {
				ok: result.exitCode === 0,
				denied: false,
				snapshotId: null,
				output: result,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				denied: false,
				snapshotId: null,
				output: { error: `Command execution failed: ${message}` },
				error: message,
			};
		}
	}

	// ---- listFiles -------------------------------------------------------------
	if (tool === 'listFiles') {
		const dir = typeof args.dir === 'string' ? args.dir : '/';
		const recursive = typeof args.recursive === 'boolean' ? args.recursive : true;
		const files = await listAllowedFiles(dir, recursive);
		appendToolLog({ kind: 'info', summary: `listFiles(${dir}) → ${files.length} file(s)` });
		return { ok: true, denied: false, snapshotId: null, output: { files } };
	}

	// ---- fileTree -------------------------------------------------------------
	if (tool === 'fileTree') {
		const root = typeof args.root === 'string' ? args.root : '/';
		const fs = sandboxStore.getFs();
		if (!fs) return deny('Sandbox filesystem is not ready');
		try {
			const tree = await loadProjectTree(fs, root);
			appendToolLog({ kind: 'info', summary: `fileTree(${root})` });
			return { ok: true, denied: false, snapshotId: null, output: { tree } };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { ok: false, denied: false, snapshotId: null, error: message, output: { error: message } };
		}
	}

	// ---- webFetch --------------------------------------------------------------
	if (tool === 'webFetch') {
		const url = typeof args.url === 'string' ? args.url.trim() : '';
		if (!url) return deny('webFetch: missing url');
		try {
			appendToolLog({ kind: 'info', summary: `webFetch(${url})` });
			const response = await fetch('/api/fetch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url }),
			});
			const data = await response.json();
			if (!response.ok) {
				return { ok: false, denied: false, snapshotId: null, error: data.error || 'Fetch failed', output: data };
			}
			return { ok: true, denied: false, snapshotId: null, output: data };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { ok: false, denied: false, snapshotId: null, error: message, output: { error: message } };
		}
	}

	// ---- grep ------------------------------------------------------------------
	if (tool === 'grep') {
		const query = typeof args.query === 'string' ? args.query : '';
		if (!query) return deny('grep: missing query');
		const pathScope = typeof args.path === 'string' ? args.path : undefined;
		const caseSensitive = typeof args.caseSensitive === 'boolean' ? args.caseSensitive : false;
		const matches = await grepFiles(query, pathScope, caseSensitive);
		appendToolLog({ kind: 'info', summary: `grep("${query}") → ${matches.length} match(es)` });
		return { ok: true, denied: false, snapshotId: null, output: { matches } };
	}

	// ---- pre-execute: normalize, then guard ------------------------------------
	const rawPath = typeof args.path === 'string' ? args.path : '';
	if (!rawPath) return deny(`${tool}: missing path`);

	const path = normalizeGuestPath(rawPath);

	const fs = sandboxStore.getFs();
	if (!fs) return deny('Sandbox filesystem is not ready');

	// ---- readFile --------------------------------------------------------------
	if (tool === 'readFile') {
		if (!isGuestPathReadable(path)) {
			return deny(`Denied: "${path}" is outside the readable workspace`, path);
		}

		try {
			const rawContent = await fs.readFile(path, 'utf-8');
			const allLines = rawContent.split('\n');
			const startLine = typeof args.startLine === 'number' ? Math.max(1, args.startLine) : 1;
			const endLine = typeof args.endLine === 'number' ? Math.min(allLines.length, Math.max(startLine, args.endLine)) : allLines.length;

			const sliced = allLines.slice(startLine - 1, endLine).join('\n');
			appendToolLog({ kind: 'read', summary: `read ${path} (L${startLine}-L${endLine}/${allLines.length})`, path });
			return {
				ok: true,
				denied: false,
				snapshotId: null,
				output: {
					path,
					content: sliced,
					totalLines: allLines.length,
					startLine,
					endLine,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				denied: false,
				snapshotId: null,
				output: { path, error: `Could not read ${path}: ${message}` },
				error: message,
			};
		}
	}

	if (!isGuestPathWritable(path)) {
		return deny(
			`Denied: "${path}" is protected or escapes the workspace root`,
			path,
		);
	}

	// ---- editFile (surgical search and replace) --------------------------------
	if (tool === 'editFile') {
		const targetText = typeof args.targetText === 'string' ? args.targetText : null;
		const replacementText = typeof args.replacementText === 'string' ? args.replacementText : null;
		if (targetText === null || replacementText === null) {
			return deny('editFile: missing targetText or replacementText', path);
		}

		let currentContent: string;
		try {
			currentContent = await fs.readFile(path, 'utf-8');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				denied: false,
				snapshotId: null,
				output: { path, error: `Could not read ${path} for editing: ${message}` },
				error: message,
			};
		}

		const occurrences = currentContent.split(targetText).length - 1;
		if (occurrences === 0) {
			return {
				ok: false,
				denied: false,
				snapshotId: null,
				output: { path, error: `targetText not found in "${path}". Ensure exact matching including whitespace.` },
				error: 'targetText not found',
			};
		}
		if (occurrences > 1) {
			return {
				ok: false,
				denied: false,
				snapshotId: null,
				output: {
					path,
					error: `targetText occurs ${occurrences} times in "${path}". Provide more surrounding lines to make targetText unique.`,
				},
				error: 'targetText is ambiguous',
			};
		}

		const newContent = currentContent.replace(targetText, replacementText);

		if (ctx.turnId) {
			const decision = await requestApproval({
				turnId: ctx.turnId,
				tool: 'writeFile',
				path,
				summary: summarizeWrite(newContent),
			});
			if (decision === 'deny') {
				return deny(`Edit to "${path}" was denied.`, path);
			}
		}

		let snapshotId: string | null = null;
		try {
			snapshotId = (await captureGuestSnapshot()).id;
		} catch {
			appendToolLog({ kind: 'info', summary: `snapshot failed before editing ${path}`, path });
		}

		try {
			await sandboxStore.write(path, newContent);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				denied: false,
				snapshotId,
				output: { path, error: `Write failed: ${message}` },
				error: message,
			};
		}

		appendToolLog({
			kind: 'emit',
			summary: `edited ${path}`,
			path,
			payload: { snapshotId },
		});
		sandboxStore.notifyFilesystemChange();

		return {
			ok: true,
			denied: false,
			snapshotId,
			observed: { path, op: 'write' },
			output: { path, replaced: true, snapshotId },
		};
	}

	// ---- writeFile -------------------------------------------------------------
	const content = typeof args.content === 'string' ? args.content : null;
	if (content === null) return deny(`writeFile: missing content for ${path}`, path);

	// Approval gate
	if (ctx.turnId) {
		const decision = await requestApproval({
			turnId: ctx.turnId,
			tool: 'writeFile',
			path,
			summary: summarizeWrite(content),
		});
		if (decision === 'deny') {
			return deny(`Write to "${path}" was denied.`, path);
		}
	}

	// Snapshot BEFORE the write.
	let snapshotId: string | null = null;
	try {
		snapshotId = (await captureGuestSnapshot()).id;
	} catch {
		appendToolLog({ kind: 'info', summary: `snapshot failed before writing ${path}`, path });
	}

	try {
		await sandboxStore.write(path, content);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			denied: false,
			snapshotId,
			output: { path, error: `Write failed: ${message}` },
			error: message,
		};
	}

	// ---- post-execute: observe -------------------------------------------------
	appendToolLog({
		kind: 'emit',
		summary: `wrote ${path} (${content.length} chars)`,
		path,
		payload: { snapshotId },
	});
	sandboxStore.notifyFilesystemChange();

	return {
		ok: true,
		denied: false,
		snapshotId,
		observed: { path, op: 'write' },
		output: { path, written: content.length, snapshotId },
	};
}
