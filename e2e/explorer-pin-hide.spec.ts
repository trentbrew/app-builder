import { expect, test, type Page } from '@playwright/test';

const CREATE_PROJECT_TIMEOUT_MS = 90_000;

async function waitForExplorerReady(page: Page) {
	const filesTrigger = page.getByRole('button', { name: /^Files\b/i });
	await expect(filesTrigger).toBeVisible({ timeout: CREATE_PROJECT_TIMEOUT_MS });
	if ((await filesTrigger.getAttribute('aria-expanded')) !== 'true') {
		await filesTrigger.click();
	}
	await expect(page.locator('[data-tree-path="/package.json"]').first()).toBeVisible({
		timeout: CREATE_PROJECT_TIMEOUT_MS,
	});
}

async function createSvelteProject(page: Page, name: string) {
	await page.goto('/dashboard');
	await page.getByRole('button', { name: /new project/i }).click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
	await waitForExplorerReady(page);
}

test.describe('explorer pin and hide', () => {
	test('pin keeps a dimmed duplicate in main tree; hide moves to accordion', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Explorer Pin Hide');

		const packageItem = page.locator('.file-explorer__scroll .file-tree-row-item').filter({
			has: page.locator('[data-tree-path="/package.json"]'),
		}).first();
		await packageItem.hover();
		await packageItem.getByRole('button', { name: 'Add shortcut', exact: true }).click();

		await expect(page.getByRole('button', { name: /^Pinned/i })).toBeVisible();
		await expect(page.locator('.file-explorer__pinned [data-tree-path="/package.json"]')).toBeVisible();
		await expect(page.locator('.file-explorer__scroll .file-tree-row-item--pinned-duplicate [data-tree-path="/package.json"]')).toBeVisible();

		const pinnedDuplicate = page.locator('.file-explorer__scroll .file-tree-row-item--pinned-duplicate').filter({
			has: page.locator('[data-tree-path="/package.json"]'),
		});
		await pinnedDuplicate.hover();
		await pinnedDuplicate.getByRole('button', { name: 'Hide in explorer', exact: true }).click();

		await expect(page.locator('.file-explorer__scroll .file-tree-row-item--pinned-duplicate [data-tree-path="/package.json"]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Hidden files/i })).toBeVisible();
		await page.getByRole('button', { name: /Hidden files/i }).click();
		await expect(page.locator('.file-explorer__hidden-panel [data-tree-path="/package.json"]')).toBeVisible();
	});
});
