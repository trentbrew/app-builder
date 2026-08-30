import { expect, test, type Page } from '@playwright/test';

const BOOT_TIMEOUT_MS = 120_000;
const PERSIST_MARKER = 'e2e-persist-green-marker';

function dialogCreateButton(page: Page) {
	return page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true });
}

async function createSvelteProject(page: Page, name: string) {
	await page.goto('/dashboard');
	await page.getByRole('button', { name: /new project/i }).click();
	await page.getByLabel('Name').fill(name);
	await dialogCreateButton(page).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: 60_000 });
}

async function ensureSandboxHooks(page: Page) {
	await page.waitForFunction(
		() =>
			typeof (window as Window & { __e2eReadSandboxFile?: unknown }).__e2eReadSandboxFile ===
				'function' &&
			typeof (window as Window & { __e2eWriteSandboxFile?: unknown }).__e2eWriteSandboxFile ===
				'function',
		undefined,
		{ timeout: BOOT_TIMEOUT_MS }
	);
}

async function waitForEditorReady(page: Page) {
	await ensureSandboxHooks(page);
	await expect(page.getByLabel('Status bar').getByText('Ready', { exact: true })).toBeVisible({
		timeout: BOOT_TIMEOUT_MS
	});
	await page.waitForFunction(
		async () => {
			const read = (window as Window & { __e2eReadSandboxFile?: (p: string) => Promise<string> })
				.__e2eReadSandboxFile;
			const write = (window as Window & { __e2eWriteSandboxFile?: (p: string, c: string) => Promise<void> })
				.__e2eWriteSandboxFile;
			if (!read || !write) return false;
			try {
				await read('package.json');
				return true;
			} catch {
				return false;
			}
		},
		undefined,
		{ timeout: BOOT_TIMEOUT_MS }
	);
}

async function patchAppSvelteForPersistence(page: Page) {
	await ensureSandboxHooks(page);
	await page.evaluate(async (marker) => {
		const read = (window as Window & { __e2eReadSandboxFile?: (p: string) => Promise<string> })
			.__e2eReadSandboxFile;
		const write = (window as Window & { __e2eWriteSandboxFile?: (p: string, c: string) => Promise<void> })
			.__e2eWriteSandboxFile;
		if (!read || !write) throw new Error('e2e sandbox hooks missing');

		const current = await read('App.svelte');
		if (current.includes(marker)) return;

		const next = current.includes('.guest-app {')
			? current.replace(
					'.guest-app {',
					`.guest-app {\n  /* ${marker} */\n  background: #00ff00;`
				)
			: `${current}\n<style>:global(.guest-app) { /* ${marker} */ background: #00ff00; }</style>\n`;

		await write('App.svelte', next);
	}, PERSIST_MARKER);
}

async function readSandboxFile(page: Page, path: string) {
	await ensureSandboxHooks(page);
	const handle = await page.waitForFunction(
		async (filePath) => {
			const read = (window as Window & { __e2eReadSandboxFile?: (p: string) => Promise<string> })
				.__e2eReadSandboxFile;
			if (!read) return false;
			try {
				return await read(filePath);
			} catch {
				return false;
			}
		},
		path,
		{ timeout: BOOT_TIMEOUT_MS }
	);
	return handle.jsonValue() as Promise<string>;
}

test.describe('editor persistence', () => {
	test.describe.configure({ mode: 'serial' });

	test('App.svelte edits survive page reload', async ({ page }) => {
		test.setTimeout(300_000);

		await createSvelteProject(page, 'Persist Test');
		await waitForEditorReady(page);

		await patchAppSvelteForPersistence(page);
		await expect(page.getByLabel('Save status').getByText('Saved')).toBeVisible({ timeout: 120_000 });

		const beforeReload = await readSandboxFile(page, 'App.svelte');
		expect(beforeReload).toContain(PERSIST_MARKER);

		const snapshotBytes = await page.evaluate(async () => {
			const fn = (window as Window & { __e2eCachedSnapshotBytes?: () => Promise<number> })
				.__e2eCachedSnapshotBytes;
			return fn ? fn() : 0;
		});
		expect(snapshotBytes).toBeGreaterThan(1_000);

		const snapshotMeta = await page.evaluate(async () => {
			const fn = (window as Window & { __e2eSnapshotMetadata?: () => Promise<unknown> })
				.__e2eSnapshotMetadata;
			return fn ? fn() : null;
		});
		expect(snapshotMeta).toMatchObject({ format: 'json', hasTree: true });
		expect((snapshotMeta as { treeKeys?: string[] })?.treeKeys).toContain('package.json');
		expect((snapshotMeta as { appSvelte?: string })?.appSvelte).toContain(PERSIST_MARKER);

		const editorUrl = page.url();
		await page.reload();
		await expect(page).toHaveURL(editorUrl);
		await waitForEditorReady(page);

		const content = await readSandboxFile(page, 'App.svelte');
		expect(content).toContain(PERSIST_MARKER);
		expect(content).toContain('background: #00ff00');
	});

	test('App.svelte edits survive leave and reopen', async ({ page }) => {
		test.setTimeout(300_000);

		await createSvelteProject(page, 'Persist Reopen');
		await waitForEditorReady(page);

		await patchAppSvelteForPersistence(page);
		await expect(page.getByLabel('Save status').getByText('Saved')).toBeVisible({ timeout: 120_000 });

		const beforeReload = await readSandboxFile(page, 'App.svelte');
		expect(beforeReload).toContain(PERSIST_MARKER);

		await page.getByRole('button', { name: 'Back to projects' }).click();
		await expect(page).toHaveURL('/dashboard', { timeout: 120_000 });
		await page.getByRole('button', { name: 'Persist Reopen' }).click();
		await expect(page).toHaveURL(/\/editor\//);
		await waitForEditorReady(page);

		const content = await readSandboxFile(page, 'App.svelte');
		expect(content).toContain(PERSIST_MARKER);
	});
});
