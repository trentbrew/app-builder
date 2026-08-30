import { expect, test, type Page } from '@playwright/test';

const CREATE_PROJECT_TIMEOUT_MS = 60_000;

async function createSvelteProject(page: Page, name: string) {
	await page.goto('/dashboard');
	await page.getByRole('button', { name: /new project/i }).click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
}

function resizeSliders(page: Page) {
	return page.getByRole('slider', { name: /resize pane/i });
}

function expectActiveTab(page: Page, name: RegExp) {
	return expect(page.getByRole('tab', { name })).toHaveClass(/horizon-layout-tabgroup__tab--active/);
}

test.describe.configure({ mode: 'serial' });

test.describe('shell shortcuts', () => {
	test('Meta+K toggles command palette', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Shortcuts Palette');
		const paletteInput = page.getByPlaceholder('Type a command or search...');

		await page.keyboard.press('Meta+k');
		await expect(paletteInput).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(paletteInput).not.toBeVisible();
	});

	test('Meta+B focuses the files panel', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Shortcuts Files');
		const filesTab = page.getByRole('tab', { name: /^Files\b/i });

		await page.keyboard.press('Meta+b');
		await expect(filesTab).toHaveClass(/horizon-layout-tabgroup__tab--active/);
	});

	test('Alt+X closes the active editor tab', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Shortcuts Close Tab');
		await page.getByRole('treeitem', { name: 'package.json' }).click();
		await expect(page.getByRole('tab', { name: /package\.json/i })).toBeVisible();

		await page.keyboard.press('Alt+x');
		await expect(page.getByRole('tab', { name: /package\.json/i })).not.toBeVisible();
		await expect(page.getByRole('tab', { name: /App\.svelte/i })).toBeVisible();
	});

	test('Meta+\\ splits the active editor pane', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Shortcuts Split');
		const sliders = resizeSliders(page);
		const before = await sliders.count();

		await page.keyboard.press('Meta+\\');
		await expect(sliders).toHaveCount(before + 1, { timeout: 10_000 });
	});

	test('Meta+. and Meta+, cycle editor tabs', async ({ page }) => {
		test.setTimeout(120_000);
		await createSvelteProject(page, 'Shortcuts Tab Cycle');
		await page.getByRole('treeitem', { name: 'package.json' }).click();
		await expectActiveTab(page, /package\.json/i);

		await page.keyboard.press('Meta+,');
		await expectActiveTab(page, /App\.svelte/i);

		await page.keyboard.press('Meta+.');
		await expectActiveTab(page, /package\.json/i);
	});
});
