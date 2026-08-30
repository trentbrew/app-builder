import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openAgentPanel } from './helpers/agent-panel';
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const BOX_GLB_BASE64 = readFileSync(join(FIXTURES_DIR, 'box.glb')).toString('base64');

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4ade80"/></svg>`;
const MINIMAL_MERMAID = `graph TD\n  A[Start] --> B[End]`;

async function createSvelteProject(page: Page, name: string) {
	await page.goto('/dashboard');
	await page.getByRole('button', { name: /new project/i }).click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: 30_000 });
	await openAgentPanel(page);
}

async function waitForHarnessHook(page: Page) {
	await page.waitForFunction(
		() => typeof (window as Window & { __harnessEditComponent?: unknown }).__harnessEditComponent === 'function'
	);
}

async function waitForE2eSandboxHook(page: Page) {
	await page.waitForFunction(
		() => typeof (window as Window & { __e2eWriteSandboxFile?: unknown }).__e2eWriteSandboxFile === 'function'
	);
}

async function writeGuestFile(page: Page, path: string, content: string) {
	await expect
		.poll(
			async () =>
				page.evaluate(
					async ({ filePath, fileContent }) => {
						const fn = (
							window as Window & { __harnessEditComponent?: (p: string, c: string) => Promise<unknown> }
						).__harnessEditComponent;
						if (!fn) return false;
						try {
							await fn(filePath, fileContent);
							return true;
						} catch {
							return false;
						}
					},
					{ filePath: path, fileContent: content }
				),
			{ timeout: 60_000 }
		)
		.toBe(true);
}

async function writeSandboxBinary(page: Page, path: string, base64: string) {
	await expect
		.poll(
			async () =>
				page.evaluate(
					async ({ filePath, data }) => {
						const fn = (
							window as Window & {
								__e2eWriteSandboxFile?: (
									p: string,
									c: string,
									e?: 'utf-8' | 'base64'
								) => Promise<void>;
							}
						).__e2eWriteSandboxFile;
						if (!fn) return false;
						try {
							await fn(filePath, data, 'base64');
							return true;
						} catch {
							return false;
						}
					},
					{ filePath: path, data: base64 }
				),
			{ timeout: 60_000 }
		)
		.toBe(true);
}

async function openTreeFile(page: Page, label: string) {
	await page.getByRole('treeitem', { name: label }).click();
}

function collectConsoleErrors(page: Page) {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	return errors;
}

test.describe.configure({ mode: 'serial' });

test.describe('asset preview', () => {
	test('SVG opens in preview and toggles to source', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = collectConsoleErrors(page);

		await createSvelteProject(page, 'Asset SVG');
		await waitForHarnessHook(page);
		await writeGuestFile(page, 'components/preview-test.svg', MINIMAL_SVG);

		await openTreeFile(page, 'preview-test.svg');
		await expect(page.getByRole('img', { name: 'SVG preview' })).toBeVisible({ timeout: 15_000 });

		await page.getByRole('button', { name: 'SVG source' }).click();
		await expect(page.locator('.cm-content')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('.cm-content')).toContainText('<svg');

		expect(errors).toEqual([]);
	});

	test('Mermaid opens in preview and toggles to source', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = collectConsoleErrors(page);

		await createSvelteProject(page, 'Asset Mermaid');
		await waitForHarnessHook(page);
		await writeGuestFile(page, 'components/flow.mmd', MINIMAL_MERMAID);

		await openTreeFile(page, 'flow.mmd');
		await expect(page.locator('.mermaid-viewer__diagram svg')).toBeVisible({ timeout: 15_000 });

		await page.getByRole('button', { name: 'Mermaid source' }).click();
		await expect(page.locator('.cm-content')).toBeVisible({ timeout: 10_000 });
		await expect(page.locator('.cm-content')).toContainText('graph TD');

		expect(errors).toEqual([]);
	});

	test('binary asset previews open without console errors', async ({ page }) => {
		test.setTimeout(180_000);
		const errors = collectConsoleErrors(page);

		await createSvelteProject(page, 'Asset Binary');
		await waitForHarnessHook(page);
		await waitForE2eSandboxHook(page);

		const fontResponse = await page.request.get('/fonts/JetBrainsMonoNLNerdFontMono-Regular.woff2');
		expect(fontResponse.ok()).toBeTruthy();
		const fontBytes = await fontResponse.body();
		const fontBase64 = fontBytes.toString('base64');

		await writeSandboxBinary(page, 'preview.woff2', fontBase64);
		await writeSandboxBinary(page, 'preview.glb', BOX_GLB_BASE64);

		await openTreeFile(page, 'preview.woff2');
		await expect(page.getByText('Font preview')).toBeVisible({ timeout: 15_000 });

		await openTreeFile(page, 'preview.glb');
		await expect(page.locator('model-viewer')).toBeVisible({ timeout: 20_000 });

		expect(errors).toEqual([]);
	});
});
