import { expect, test, type Page } from '@playwright/test';

function dialogCreateButton(page: Page) {
	return page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true });
}

test.describe.configure({ mode: 'serial' });

test.describe('user templates', () => {
	test('templates page shows heading and new template button', async ({ page }) => {
		await page.goto('/templates');
		await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
		await expect(page.getByRole('button', { name: /new template/i })).toBeVisible();
	});

	test('create template from framework appears in grid', async ({ page }) => {
		await page.goto('/templates');
		await page.getByRole('button', { name: /new template/i }).click();
		await page.getByLabel('Name').fill('E2E Starter');
		await dialogCreateButton(page).click();
		await expect(page.getByText('E2E Starter')).toBeVisible();
	});

	test('create project from user template lands on editor', async ({ page }) => {
		await page.goto('/templates');
		await page.getByRole('button', { name: 'E2E Starter' }).click();
		await page.getByLabel('Name').fill('From Template App');
		await dialogCreateButton(page).click();
		await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i);
	});
});
