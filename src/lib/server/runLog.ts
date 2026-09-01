/**
 * Append-only run manifest.
 *
 * Runs land in `runs/manifest.jsonl` (override with `RUN_LOG_PATH`), one JSON
 * object per line, in the layout the experiment role expects.
 *
 * Writing is best-effort and never blocks or fails a chat response. Two reasons
 * it can be unavailable, both handled the same way:
 *
 *   - the serverless filesystem is read-only (this app builds with
 *     `adapter-vercel`, so the deployed bundle cannot write to the project dir);
 *   - the directory is not writable for ordinary permission reasons.
 *
 * Rather than sniff the environment, the first failed write disables the log and
 * warns once. Sniffing gets stale; a failed write does not. In practice the loop
 * only runs locally anyway — the model is Ollama on 127.0.0.1.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { parseManifestJsonl, runToJsonl, type RunRecord } from '$lib/runEnvelope';

const DEFAULT_RUN_LOG_PATH = 'runs/manifest.jsonl';

let disabled = false;
let ensuredDir = false;

/**
 * Serializes appends.
 *
 * `appendFile` is only atomic for writes under the pipe buffer, and a run record
 * carrying an error string can exceed it. Concurrent agent tabs are the normal
 * case here, so writes are chained rather than raced — a torn line would be
 * silently dropped by the reader and quietly bias every rate computed from it.
 */
let queue: Promise<void> = Promise.resolve();

function runLogPath(): string {
	return resolve(env.RUN_LOG_PATH?.trim() || DEFAULT_RUN_LOG_PATH);
}

async function append(record: RunRecord): Promise<void> {
	if (disabled) return;

	const path = runLogPath();

	try {
		if (!ensuredDir) {
			await mkdir(dirname(path), { recursive: true });
			ensuredDir = true;
		}
		await appendFile(path, runToJsonl(record), 'utf8');
	} catch (error) {
		disabled = true;
		const message = error instanceof Error ? error.message : String(error);
		console.warn(
			`[runLog] disabled — could not write ${path}: ${message}. ` +
				'Runs will not be recorded for the rest of this process.'
		);
	}
}

/**
 * Record one finished run. Never throws, never awaited by the request path.
 */
export function recordRun(record: RunRecord): void {
	if (disabled) return;
	queue = queue.then(() => append(record));
}

/** Test/CLI hook: resolve after every queued append has settled. */
export function flushRunLog(): Promise<void> {
	return queue;
}

/** Where runs are being written, for diagnostics. */
export function runLogLocation(): { path: string; disabled: boolean } {
	return { path: runLogPath(), disabled };
}

/**
 * Read the run manifest back, most-recent-first, capped at `limit`.
 *
 * The read is best-effort like the write: a missing file (nothing recorded yet)
 * is an empty list, not an error. Reads pending appends without locking — the
 * parser skips a torn tail line rather than failing the whole read.
 */
export async function readRuns(limit = 1000): Promise<RunRecord[]> {
	try {
		const body = await readFile(runLogPath(), 'utf8');
		const runs = parseManifestJsonl(body);
		// Newest first, then cap — the inspector wants recent activity.
		return runs.slice(-limit).reverse();
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === 'ENOENT') return [];
		console.warn('[runLog] read failed:', error);
		return [];
	}
}
