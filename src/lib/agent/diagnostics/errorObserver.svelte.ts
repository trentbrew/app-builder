import { previewConsole } from '$lib/previewConsole.svelte';
import { sandboxStore } from '$lib/sandboxStore';

export interface ActiveDiagnostic {
	id: string;
	kind: 'runtime' | 'compiler' | 'server';
	message: string;
	file?: string;
	line?: number;
	time: number;
}

export interface DiagnosticsSummary {
	hasErrors: boolean;
	totalErrors: number;
	diagnostics: ActiveDiagnostic[];
}

function parseErrorLocation(text: string): { file?: string; line?: number } {
	// Matches patterns like "src/App.svelte:12:5" or "(/src/counter-app.ts:24:10)"
	const match = text.match(/(?:\/)?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+):(\d+)(?::\d+)?/);
	if (match) {
		return {
			file: match[1],
			line: parseInt(match[2], 10),
		};
	}
	return {};
}

/** Retrieve active runtime preview exceptions and server/compiler errors. */
export function getActiveDiagnostics(): DiagnosticsSummary {
	const diagnostics: ActiveDiagnostic[] = [];

	// 1. Runtime preview errors from console
	for (const entry of previewConsole.entries) {
		if (entry.level === 'error') {
			const loc = parseErrorLocation(entry.text);
			diagnostics.push({
				id: entry.id,
				kind: 'runtime',
				message: entry.text,
				file: loc.file,
				line: loc.line,
				time: entry.time,
			});
		}
	}

	// 2. Server / Vite compile errors from sandbox logs
	let currentLogs: string[] = [];
	const unsub = sandboxStore.subscribe((state) => {
		currentLogs = state.logs ?? [];
	});
	unsub();

	const errorLogRegex = /(?:\[dev\]|\[vite\]|\[install\])?\s*(?:error|exception|failed|syntaxerror|typeerror)/i;
	for (const log of currentLogs.slice(-50)) {
		if (errorLogRegex.test(log) && !log.includes('0 error')) {
			const loc = parseErrorLocation(log);
			diagnostics.push({
				id: crypto.randomUUID(),
				kind: 'compiler',
				message: log.trim(),
				file: loc.file,
				line: loc.line,
				time: Date.now(),
			});
		}
	}

	// Deduplicate diagnostics by message
	const seen = new Set<string>();
	const uniqueDiagnostics: ActiveDiagnostic[] = [];
	for (const d of diagnostics) {
		const key = `${d.kind}:${d.message.slice(0, 100)}`;
		if (!seen.has(key)) {
			seen.add(key);
			uniqueDiagnostics.push(d);
		}
	}

	return {
		hasErrors: uniqueDiagnostics.length > 0,
		totalErrors: uniqueDiagnostics.length,
		diagnostics: uniqueDiagnostics.slice(-20),
	};
}
