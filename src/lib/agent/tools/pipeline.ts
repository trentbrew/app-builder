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

async function listAllowedFiles(): Promise<string[]> {
	const fs = sandboxStore.getFs();
	if (!fs) return [];

	const found: string[] = [];

	async function walk(dir: string) {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (SKIP_SCAN_DIRS.has(entry.name)) continue;
				const relPath = dir === '/' || dir === '' ? entry.name : `${dir}/${entry.name}`;
				if (entry.isDirectory()) {
					await walk(relPath);
				} else {
					found.push(relPath);
				}
			}
		} catch {
			// absent or unreadable
		}
	}

	await walk('/');
	return found;
}

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

	if (tool === 'listFiles') {
		const files = await listAllowedFiles();
		appendToolLog({ kind: 'info', summary: `listFiles → ${files.length} file(s)` });
		return { ok: true, denied: false, snapshotId: null, output: { files } };
	}

	// ---- pre-execute: normalize, then guard ------------------------------------
	const rawPath = typeof args.path === 'string' ? args.path : '';
	if (!rawPath) return deny(`${tool}: missing path`);

	const path = normalizeGuestPath(rawPath);

	const fs = sandboxStore.getFs();
	if (!fs) return deny('Sandbox filesystem is not ready');

	if (tool === 'readFile') {
		if (!isGuestPathReadable(path)) {
			return deny(`Denied: "${path}" is outside the readable workspace`, path);
		}

		try {
			const content = await fs.readFile(path, 'utf-8');
			appendToolLog({ kind: 'read', summary: `read ${path}`, path });
			return { ok: true, denied: false, snapshotId: null, output: { path, content } };
		} catch (error) {
			// A missing file is a legitimate answer, not a harness failure — the model
			// needs to learn the file is absent so it can create it.
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
			`Denied: "${path}" is outside the writable set (App.svelte, agent.manifest.json, src/**, components/**, app/**, lib/**)`,
			path,
		);
	}

	// ---- writeFile -------------------------------------------------------------
	const content = typeof args.content === 'string' ? args.content : null;
	if (content === null) return deny(`writeFile: missing content for ${path}`, path);

	// Approval gate — the last pre-execute step, after the allowlist guard (no
	// point asking about a write that would be denied anyway) and before any
	// state changes. Fails closed: a denial returns a durable-visible result so
	// the model sees the refusal and adapts. Only gated when a turn is in scope;
	// a direct call (no turnId) is not subject to the interactive prompt.
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

	// Snapshot BEFORE the write. Taken here rather than in post-execute so the
	// recorded state is the one being replaced.
	let snapshotId: string | null = null;
	try {
		snapshotId = (await captureGuestSnapshot()).id;
	} catch {
		// Snapshot failure must not block the write, but it does mean this edit is
		// not rollback-able — surfaced as its own field rather than folded into ok.
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
