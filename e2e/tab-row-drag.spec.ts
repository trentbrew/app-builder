import { expect, test, type Page } from '@playwright/test';

const CREATE_PROJECT_TIMEOUT_MS = 90_000;
const BOOT_TIMEOUT_MS = 120_000;

function dialogCreateButton(page: Page) {
	return page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true });
}

async function createSvelteProject(page: Page, name: string) {
	await page.goto('/dashboard');
	await page.getByRole('button', { name: /new project/i }).click();
	await page.getByLabel('Name').fill(name);
	await dialogCreateButton(page).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
}

async function ensureSandboxHooks(page: Page) {
	await page.waitForFunction(
		() =>
			typeof (window as Window & { __e2eReadSandboxFile?: unknown }).__e2eReadSandboxFile ===
				'function',
		undefined,
		{ timeout: BOOT_TIMEOUT_MS },
	);
}

async function waitForEditorReady(page: Page) {
	await ensureSandboxHooks(page);
	await expect(page.getByLabel('Status bar').getByText('Ready', { exact: true })).toBeVisible({
		timeout: BOOT_TIMEOUT_MS,
	});
}

async function disableStretchSingleTabs(page: Page) {
	await page.evaluate(() => {
		document.documentElement.dataset.editorStretchSingleTabs = 'false';
	});
}

test.describe('tab row drag', () => {
	test('dragging the tab row moves every tab in the group', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Tab Row Drag');
		await waitForEditorReady(page);
		await disableStretchSingleTabs(page);

		const editorDock = page.locator('.editor-dock');
		await page.getByRole('treeitem', { name: 'package.json' }).click();
		await expect(editorDock.getByRole('tab', { name: /package\.json/i })).toBeVisible();

		const sourceGroup = editorDock.locator('.horizon-layout-tabgroup').filter({
			has: page.locator('.file-editor-host'),
			has: page.getByRole('tab', { name: /App\.svelte/i }),
			has: page.getByRole('tab', { name: /package\.json/i }),
		});
		await expect(sourceGroup).toHaveCount(1);

		const rowHandle = sourceGroup.locator('.horizon-layout-tabgroup__tab-bar-drag');
		await expect(rowHandle).toBeVisible();

		// Preview is locked by default; unlock so tab-row drag can merge into it.
		const previewGroup = editorDock.locator('.horizon-layout-tabgroup').filter({
			has: page.getByRole('tab', { name: /^Preview$/i }),
		});
		await previewGroup.getByRole('button', { name: 'Unlock pane' }).click();

		await rowHandle.dragTo(editorDock.getByRole('tab', { name: /^Preview$/i }));

		const mergedTablist = editorDock.locator('[role="tablist"]').filter({
			has: page.getByRole('tab', { name: /App\.svelte/i }),
			has: page.getByRole('tab', { name: /package\.json/i }),
		});
		await expect(mergedTablist).toHaveCount(1);
		await expect(mergedTablist.getByRole('tab', { name: /App\.svelte/i })).toBeVisible();
		await expect(mergedTablist.getByRole('tab', { name: /package\.json/i })).toBeVisible();
	});
});
