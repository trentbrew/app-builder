import { expect, type Page } from '@playwright/test';

export const SANDBOX_BOOT_TIMEOUT_MS = 300_000;

export function dialogCreateButton(page: Page) {
	return page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true });
}

export async function ensureSandboxHooks(page: Page) {
	await page.waitForFunction(
		() =>
			typeof (window as Window & { __e2eReadSandboxFile?: unknown }).__e2eReadSandboxFile ===
				'function' &&
			typeof (window as Window & { __e2eSandboxLogs?: unknown }).__e2eSandboxLogs === 'function',
		undefined,
		{ timeout: SANDBOX_BOOT_TIMEOUT_MS }
	);
}

export function newProjectButton(page: Page) {
	return page.getByRole('button', { name: 'New project', exact: true });
}

export async function createExpoProject(page: Page, name: string) {
	await page.goto('/dashboard');
	await newProjectButton(page).click();

	const dialog = page.getByRole('dialog', { name: 'New project' });
	await expect(dialog).toBeVisible({ timeout: 30_000 });

	await dialog.getByLabel('Name').fill(name);
	await dialog
		.getByRole('radiogroup', { name: 'Built-in templates' })
		.getByRole('radio', { name: /Expo/i })
		.click();
	await dialogCreateButton(page).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: 60_000 });
}

export async function waitForExpoPreviewReady(page: Page) {
	await ensureSandboxHooks(page);

	await expect(page.getByLabel('Status bar').getByText('Ready', { exact: true })).toBeVisible({
		timeout: SANDBOX_BOOT_TIMEOUT_MS
	});

	await page.waitForFunction(
		() => {
			const state = (
				window as Window & {
					__e2eSandboxState?: () => {
						error: string;
						previewUrl: string;
						templateId: string | null;
					};
				}
			).__e2eSandboxState?.();
			if (!state) return false;
			if (state.templateId !== 'expo') return false;
			if (state.error) return false;
			return Boolean(state.previewUrl);
		},
		undefined,
		{ timeout: SANDBOX_BOOT_TIMEOUT_MS }
	);

	await page.waitForFunction(
		() => {
			const logs = (window as Window & { __e2eSandboxLogs?: () => string[] }).__e2eSandboxLogs?.() ?? [];
			const joined = logs.join('\n');
			if (/getFileName|callerCallsite|Dev server exited with code 1/i.test(joined)) return false;
			return /Web Bundled|Server ready at/i.test(joined);
		},
		undefined,
		{ timeout: SANDBOX_BOOT_TIMEOUT_MS }
	);
}

export async function readSandboxFile(page: Page, path: string) {
	await ensureSandboxHooks(page);
	return page.evaluate(async (filePath) => {
		const read = (window as Window & { __e2eReadSandboxFile?: (p: string) => Promise<string> })
			.__e2eReadSandboxFile;
		if (!read) throw new Error('__e2eReadSandboxFile missing');
		return read(filePath);
	}, path);
}

export async function readSandboxLogs(page: Page) {
	await ensureSandboxHooks(page);
	return page.evaluate(() => {
		const logs = (window as Window & { __e2eSandboxLogs?: () => string[] }).__e2eSandboxLogs;
		return logs ? logs() : [];
	});
}

export async function readSandboxState(page: Page) {
	await ensureSandboxHooks(page);
	return page.evaluate(() => {
		const fn = (
			window as Window & {
				__e2eSandboxState?: () => {
					error: string;
					phase: string;
					previewUrl: string;
					templateId: string | null;
				};
			}
		).__e2eSandboxState;
		return fn ? fn() : null;
	});
}
