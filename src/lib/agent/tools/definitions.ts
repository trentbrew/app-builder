/**
 * Tool schemas — declared server-side, executed client-side.
 *
 * None of these carry an `execute` function, and that is the whole design. A
 * tool without `execute` is forwarded by the AI SDK to the client, where
 * `Chat`'s `onToolCall` runs it and reports back with `addToolResult`.
 *
 * This is forced, not chosen. Under the `webcontainer` backend the sandbox
 * filesystem lives in the browser, so a server-side `execute` could not reach
 * it — and `sandboxStore.detectBackend()` returns `'webcontainer'` whenever
 * `!browser`, meaning the server cannot even tell which backend is live.
 * The model call stays on the server (that is where usage and the run envelope
 * are); the side effects happen where the filesystem actually is.
 *
 * Descriptions are written for the model, not for us: they state the allowlist
 * rule up front, because a tool that fails a guard the model could not predict
 * wastes a step and teaches it nothing.
 */
import { tool } from 'ai';
import { z } from 'zod';

/** Paths the guest may touch. Mirrors `pathAllowlist.ts`, stated for the model. */
const WRITABLE_PATHS = '`App.svelte`, `agent.manifest.json`, or files under `src/`, `components/`, `app/`, `lib/`, `pages/`, `styles/`, `public/`';

export const agentTools = {
	readFile: tool({
		description:
			'Read a file from the project workspace (e.g. "src/counter-app.ts", "App.svelte", "package.json", "components/Card.svelte"). ' +
			'Read before writing when modifying an existing file.',
		inputSchema: z.object({
			path: z
				.string()
				.describe('Project-relative path, e.g. "src/counter-app.ts", "App.svelte", or "components/Card.svelte".'),
		}),
	}),

	writeFile: tool({
		description:
			`Write a file in the project sandbox, replacing its full contents. Allowed paths: ${WRITABLE_PATHS}. ` +
			'Writes outside allowed source paths are denied. Provide the complete file, not a diff.',
		inputSchema: z.object({
			path: z
				.string()
				.describe('Project-relative path, e.g. "src/counter-app.ts", "App.svelte", or "components/Card.svelte".'),
			content: z.string().describe('Complete new file contents.'),
		}),
	}),

	listFiles: tool({
		description:
			'List the files currently in the project sandbox workspace.',
		inputSchema: z.object({}),
	}),
} as const;

export type AgentToolName = keyof typeof agentTools;

export function isAgentToolName(name: string): name is AgentToolName {
	return name in agentTools;
}
