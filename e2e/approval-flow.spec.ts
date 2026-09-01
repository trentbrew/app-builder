import { expect, test, type Page } from '@playwright/test';
import { ensureSandboxHooks, readSandboxFile, SANDBOX_BOOT_TIMEOUT_MS } from './helpers/sandbox';

/**
 * Full-UI composition of the approval seam.
 *
 * The direct pipeline spec (`tool-pipeline.spec.ts`) proves `runTool` → disk in
 * isolation. What it cannot reach is the *interactive* composition: a gated
 * write actually raising the prompt component, a real click resolving it, and
 * the decision flowing back through the pipeline to the filesystem. That path
 * only exists once the Svelte prompt, the store, and the pipeline are wired
 * together in a running page — which is what this covers.
 *
 * Mechanism: a `runTool(..., { turnId })` kicked off inside the page blocks on
 * `requestApproval`, which sets the global `approvalState.pending`. The agent
 * pane's mounted `<AgentApprovalPrompt/>` reads that same module instance (Vite
 * dedupes the dynamic import against the app's graph, exactly as the sibling
 * spec relies on for `sandboxStore`), so Playwright drives the real prompt. We
 * do not route through the model: that would test the model's willingness to
 * call a tool, not the composition under test.
 */

const CREATE_PROJECT_TIMEOUT_MS = 60_000;

type ToolRunResult = {
	ok: boolean;
	denied: boolean;
	snapshotId: string | null;
	output: unknown;
	error?: string;
};

const PROMPT = { name: /approve agent write/i } as const;

/** Start a gated write but do not await it — it parks on the approval prompt. */
async function beginGatedWrite(page: Page, path: string, content: string, turnId: string) {
	await page.evaluate(
		({ path, content, turnId }) => {
			const w = window as unknown as { __approvalProbe?: Promise<unknown> };
			w.__approvalProbe = import('/src/lib/agent/tools/pipeline.ts').then((mod) =>
				mod.runTool('writeFile', { path, content }, { turnId }),
			);
		},
		{ path, content, turnId },
	);
}

/** Await the result of the write started by `beginGatedWrite`. */
async function settleGatedWrite(page: Page): Promise<ToolRunResult> {
	return page.evaluate(
		() => (window as unknown as { __approvalProbe: Promise<ToolRunResult> }).__approvalProbe,
	);
}

/** Read a file, returning null if it is absent (a denied write leaves none). */
async function readSandboxFileOrNull(page: Page, path: string): Promise<string | null> {
	return page.evaluate(async (filePath) => {
		const read = (window as Window & { __e2eReadSandboxFile?: (p: string) => Promise<string> })
			.__e2eReadSandboxFile;
		if (!read) throw new Error('__e2eReadSandboxFile missing');
		try {
			return await read(filePath);
		} catch {
			return null;
		}
	}, path);
}

test.describe.configure({ mode: 'serial' });

test.describe('agent approval seam', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		test.setTimeout(SANDBOX_BOOT_TIMEOUT_MS);
		page = await browser.newPage();
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /new project/i }).click();
		await page.getByLabel('Name').fill('Approval Flow');
		await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
		await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
		await ensureSandboxHooks(page);

		// The prompt component only exists inside a mounted agent pane. Ensure one
		// is open, and force a deterministic approval mode regardless of any mode
		// persisted from a previous run.
		const agentOptions = page.getByRole('button', { name: 'Agent options' });
		if (!(await agentOptions.isVisible().catch(() => false))) {
			await page.getByRole('button', { name: 'Toggle agent panel' }).click();
		}
		await expect(agentOptions).toBeVisible({ timeout: 30_000 });
		await page.evaluate(async () => {
			const mod = await import('/src/lib/agent/approval/approvalStore.svelte.ts');
			mod.setApprovalMode('prompt');
		});
	});

	test.afterAll(async () => {
		await page?.close();
	});

	test('Allow lets the write land on disk', async () => {
		await beginGatedWrite(page, 'components/ApprovedByClick.svelte', '<h1>allowed</h1>\n', 'turn-a');

		const prompt = page.getByRole('alertdialog', PROMPT);
		await expect(prompt).toBeVisible();
		await expect(prompt).toContainText('components/ApprovedByClick.svelte');
		await prompt.getByRole('button', { name: 'Allow', exact: true }).click();

		const result = await settleGatedWrite(page);
		expect(result.ok).toBe(true);
		expect(result.denied).toBe(false);

		const onDisk = await readSandboxFile(page, 'components/ApprovedByClick.svelte');
		expect(onDisk).toContain('allowed');
	});

	test('Deny blocks the write and never touches disk', async () => {
		await beginGatedWrite(page, 'components/DeniedByClick.svelte', '<h1>nope</h1>\n', 'turn-b');

		const prompt = page.getByRole('alertdialog', PROMPT);
		await expect(prompt).toBeVisible();
		await prompt.getByRole('button', { name: 'Deny', exact: true }).click();

		const result = await settleGatedWrite(page);
		expect(result.ok).toBe(false);
		expect(result.denied).toBe(true);

		// Denied before the write, so no snapshot and no file.
		expect(result.snapshotId).toBeNull();
		expect(await readSandboxFileOrNull(page, 'components/DeniedByClick.svelte')).toBeNull();
	});

	test('"Allow all this turn" suppresses the prompt for the rest of the turn', async () => {
		// First write in the turn prompts; grant the whole turn.
		await beginGatedWrite(page, 'components/AllowAllOne.svelte', '<h1>one</h1>\n', 'turn-c');
		const prompt = page.getByRole('alertdialog', PROMPT);
		await expect(prompt).toBeVisible();
		await prompt.getByRole('button', { name: 'Allow all this turn' }).click();
		expect((await settleGatedWrite(page)).ok).toBe(true);

		// Second write in the SAME turn must not prompt — it settles without a click.
		await beginGatedWrite(page, 'components/AllowAllTwo.svelte', '<h1>two</h1>\n', 'turn-c');
		const result = await settleGatedWrite(page);
		expect(result.ok).toBe(true);
		await expect(page.getByRole('alertdialog', PROMPT)).toHaveCount(0);
		expect(await readSandboxFile(page, 'components/AllowAllTwo.svelte')).toContain('two');
	});

	test('a grant does not carry into a different turn', async () => {
		// turn-c was fully granted above; a new turn must prompt again.
		await beginGatedWrite(page, 'components/NewTurn.svelte', '<h1>fresh</h1>\n', 'turn-d');
		const prompt = page.getByRole('alertdialog', PROMPT);
		await expect(prompt).toBeVisible();
		await prompt.getByRole('button', { name: 'Deny', exact: true }).click();
		expect((await settleGatedWrite(page)).denied).toBe(true);
	});
});
