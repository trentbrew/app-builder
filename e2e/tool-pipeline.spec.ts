import { expect, test, type Page } from '@playwright/test';
import { ensureSandboxHooks, readSandboxFile, SANDBOX_BOOT_TIMEOUT_MS } from './helpers/sandbox';

/**
 * Verifies the client half of the tool pipeline against a real sandbox.
 *
 * The server half (model emits a tool call, run envelope records it) is covered
 * by a direct HTTP probe. What that cannot reach is everything after
 * `onToolCall` fires, because tools execute in the browser — so this drives
 * `runTool` directly rather than through the chat UI.
 *
 * Going through the model would test the model's willingness to call a tool,
 * which is neither deterministic nor the thing under test. Calling the pipeline
 * with the exact arguments a tool call carries isolates the code that ships.
 *
 * One project is created for the whole file. Creating one per test booted five
 * sandboxes and the second run could not find the dashboard's "New project"
 * button — the fixture, not the pipeline. Sharing costs isolation between
 * assertions, so each writes to its own path.
 */

const CREATE_PROJECT_TIMEOUT_MS = 60_000;

type ToolRunResult = {
	ok: boolean;
	denied: boolean;
	snapshotId: string | null;
	output: unknown;
	error?: string;
};

/** Call the shipped pipeline in the page, exactly as `onToolCall` would. */
async function runTool(page: Page, name: string, input: unknown): Promise<ToolRunResult> {
	return page.evaluate(
		async ({ toolName, toolInput }) => {
			const mod = await import('/src/lib/agent/tools/pipeline.ts');
			return mod.runTool(toolName, toolInput);
		},
		{ toolName: name, toolInput: input },
	);
}

test.describe.configure({ mode: 'serial' });

test.describe('agent tool pipeline', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		test.setTimeout(SANDBOX_BOOT_TIMEOUT_MS);
		page = await browser.newPage();
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /new project/i }).click();
		await page.getByLabel('Name').fill('Tool Pipeline');
		await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
		await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
		await ensureSandboxHooks(page);
	});

	test.afterAll(async () => {
		await page?.close();
	});

	test('writeFile lands in the sandbox and is readable back', async () => {
		const result = await runTool(page, 'writeFile', {
			path: 'components/PipelineProbe.svelte',
			content: '<h1>pipeline-wrote-this</h1>\n',
		});

		expect(result.ok).toBe(true);
		expect(result.denied).toBe(false);
		// A snapshot must exist, otherwise the edit is not rollback-able.
		expect(result.snapshotId).toBeTruthy();

		const onDisk = await readSandboxFile(page, 'components/PipelineProbe.svelte');
		expect(onDisk).toContain('pipeline-wrote-this');
	});

	test('readFile returns what writeFile wrote', async () => {
		await runTool(page, 'writeFile', {
			path: 'components/ReadBack.svelte',
			content: '<p>read-back-marker</p>\n',
		});
		const result = await runTool(page, 'readFile', { path: 'components/ReadBack.svelte' });

		expect(result.ok).toBe(true);
		expect((result.output as { content: string }).content).toContain('read-back-marker');
	});

	test('denies writes outside the allowlist', async () => {
		for (const path of ['package.json', 'vite.config.js', 'index.html']) {
			const result = await runTool(page, 'writeFile', { path, content: 'nope' });
			expect(result.ok, path).toBe(false);
			expect(result.denied, path).toBe(true);
			// Denied before any filesystem contact, so there is nothing to roll back.
			expect(result.snapshotId, path).toBeNull();
		}
	});

	test('denies path traversal that escapes the sandbox root', async () => {
		// Regression: `^components/` matched these before `..` was resolved, which
		// let a model-supplied path write outside the sandbox.
		for (const path of [
			'components/../../../etc/passwd',
			'components/../package.json',
			'/components/../../.env',
		]) {
			const result = await runTool(page, 'writeFile', { path, content: 'nope' });
			expect(result.ok, path).toBe(false);
			expect(result.denied, path).toBe(true);
		}
	});

	test('unknown tool names are denied, not thrown', async () => {
		const result = await runTool(page, 'rmRf', { path: 'App.svelte' });
		expect(result.ok).toBe(false);
		expect(result.denied).toBe(true);
	});

	test('missing content is denied rather than writing empty', async () => {
		const result = await runTool(page, 'writeFile', { path: 'components/NoBody.svelte' });
		expect(result.ok).toBe(false);
		expect(result.denied).toBe(true);
	});
});
