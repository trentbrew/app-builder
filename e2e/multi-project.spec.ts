import { expect, test, type Page } from '@playwright/test';
import { openAgentPanel } from './helpers/agent-panel';

const LEAVE_EDITOR_TIMEOUT_MS = 60_000;

function dialogCreateButton(page: Page) {
	return page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true });
}

async function waitForAgentRail(page: Page) {
	await openAgentPanel(page);
}

test.describe.configure({ mode: 'serial' });

test.describe('multi-project dashboard', () => {
	test('dashboard shows Projects heading and New project button', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
		await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
	});

	test('create Svelte project via dialog lands on editor route', async ({ page }) => {
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /new project/i }).click();
		await page.getByLabel('Name').fill('E2E Svelte App');
		await dialogCreateButton(page).click();
		await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i);
		await expect(page.getByText('Projects')).toBeVisible();
	});

	test('navigate dashboard via icon rail shows project card', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /new project/i }).click();
		await page.getByLabel('Name').fill('Rail Test App');
		await dialogCreateButton(page).click();
		await expect(page).toHaveURL(/\/editor\//);
		await waitForAgentRail(page);

		await page.getByRole('navigation', { name: 'Workspace projections' }).getByRole('link', { name: 'Projects' }).click();
		await expect(page).toHaveURL('/dashboard', { timeout: LEAVE_EDITOR_TIMEOUT_MS });
		await expect(page.getByText('Rail Test App')).toBeVisible();
	});

	test('header back button returns to dashboard', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /new project/i }).click();
		await page.getByLabel('Name').fill('Back Button Test');
		await dialogCreateButton(page).click();
		await expect(page).toHaveURL(/\/editor\//);
		await waitForAgentRail(page);

		await page.getByRole('button', { name: 'Back to projects' }).click();
		await expect(page).toHaveURL('/dashboard', { timeout: LEAVE_EDITOR_TIMEOUT_MS });
		await expect(page.getByText('Back Button Test')).toBeVisible();
	});

	test('open Svelte project shows AgentRail', async ({ page }) => {
		test.setTimeout(180_000);
		await page.goto('/dashboard');
		await page.getByRole('button', { name: /new project/i }).click();
		await page.getByLabel('Name').fill('Harness Smoke');
		await dialogCreateButton(page).click();
		await waitForAgentRail(page);
	});
});
