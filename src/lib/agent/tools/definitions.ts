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
	bash: tool({
		description:
			'Execute a shell command inside the project sandbox environment. Returns stdout, stderr, and exitCode. ' +
			'Use for running tests, build checks, npm commands, or inspecting the environment.',
		inputSchema: z.object({
			command: z.string().describe('The shell command string to execute, e.g. "bun test", "npm run check", or "ls -la".'),
		}),
	}),

	readFile: tool({
		description:
			'Read a file from the project workspace (e.g. "src/counter-app.ts", "App.svelte", "package.json", "components/Card.svelte"). ' +
			'Optionally specify startLine and endLine (1-based) to view a slice.',
		inputSchema: z.object({
			path: z
				.string()
				.describe('Project-relative path, e.g. "src/counter-app.ts", "App.svelte", or "components/Card.svelte".'),
			startLine: z.number().int().positive().optional().describe('1-based line number to start reading from.'),
			endLine: z.number().int().positive().optional().describe('1-based line number to end reading at (inclusive).'),
		}),
	}),

	writeFile: tool({
		description:
			'Write or create a file in the project workspace sandbox, replacing its full contents. ' +
			'Provide the complete new file content, not a diff.',
		inputSchema: z.object({
			path: z
				.string()
				.describe('Project-relative path, e.g. "test.txt", "src/counter-app.ts", "App.svelte", or "components/Card.svelte".'),
			content: z.string().describe('Complete new file contents.'),
		}),
	}),

	editFile: tool({
		description:
			'Surgically replace a unique block of text in an existing file. ' +
			'targetText must match an exact, unique substring in the file.',
		inputSchema: z.object({
			path: z.string().describe('Project-relative path to the file to edit.'),
			targetText: z.string().describe('Exact substring to find and replace. Must uniquely identify the location.'),
			replacementText: z.string().describe('The replacement text.'),
		}),
	}),

	listFiles: tool({
		description:
			'List the files currently in the project sandbox workspace.',
		inputSchema: z.object({
			dir: z.string().optional().describe('Directory path to list from, defaults to root "/".'),
			recursive: z.boolean().optional().describe('Whether to recursively list all nested files (default: true).'),
		}),
	}),

	grep: tool({
		description:
			'Search for text or regex patterns in workspace files. Returns matching file paths, line numbers, and line snippets.',
		inputSchema: z.object({
			query: z.string().describe('String or regex pattern to search for.'),
			path: z.string().optional().describe('Optional directory or file path to scope the search.'),
			caseSensitive: z.boolean().optional().describe('Whether matching is case-sensitive (default: false).'),
		}),
	}),

	getDiagnostics: tool({
		description:
			'Retrieve active runtime preview exceptions, compiler errors, and build diagnostics in the application. ' +
			'Use this to inspect errors when the preview is broken or when verifying changes.',
		inputSchema: z.object({}),
	}),

	fileTree: tool({
		description:
			'Get a structured hierarchical tree of files and directories in the project sandbox workspace.',
		inputSchema: z.object({
			root: z.string().optional().describe('Root directory to start from (defaults to "/").'),
		}),
	}),

	webFetch: tool({
		description:
			'Fetch external web documentation, libraries, or APIs via HTTP GET. Returns text content or JSON.',
		inputSchema: z.object({
			url: z.string().describe('The complete http(s) URL to fetch.'),
		}),
	}),
} as const;

export type AgentToolName = keyof typeof agentTools;

export function isAgentToolName(name: string): name is AgentToolName {
	return name in agentTools;
}
