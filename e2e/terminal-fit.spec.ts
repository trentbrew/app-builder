import { expect, test, type Page } from '@playwright/test';

const CREATE_PROJECT_TIMEOUT_MS = 90_000;
const FIT_TIMEOUT_MS = 30_000;
/** Padding (8+8) + scrollbar reserve (~10) + leftover cell remainder. */
const FIT_SLACK_PX = 48;

function uniqueProjectName(prefix: string) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function dialogCreateButton(page: Page) {
	return page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true });
}

async function waitForDashboard(page: Page) {
	await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
	await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({
		timeout: CREATE_PROJECT_TIMEOUT_MS
	});
	await expect(page.getByRole('button', { name: /new project/i })).toBeVisible();
}

async function createSvelteProject(page: Page, name: string) {
	await waitForDashboard(page);

	const newProject = page.getByRole('button', { name: /new project/i });
	await expect(newProject).toBeEnabled();
	await newProject.click();

	const nameField = page.getByRole('dialog').getByLabel('Name');
	await expect(nameField).toBeVisible();
	await nameField.fill(name);

	const create = dialogCreateButton(page);
	await expect(create).toBeEnabled();
	await create.click();

	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
	await expect(page.getByRole('tab', { name: /^Terminal 1\b/i })).toBeVisible({
		timeout: CREATE_PROJECT_TIMEOUT_MS
	});
}

function terminalTabgroup(page: Page) {
	return page.locator('.horizon-layout-tabgroup').filter({
		has: page.getByRole('tab', { name: /^Terminal 1\b/i })
	});
}

async function openTerminalPane(page: Page) {
	const exitFullscreen = page.getByRole('button', { name: 'Exit fullscreen' });
	if (await exitFullscreen.isVisible().catch(() => false)) {
		await exitFullscreen.click();
		await expect(exitFullscreen).toHaveCount(0);
	}

	const tab = page.getByRole('tab', { name: /^Terminal 1\b/i });
	await expect(tab).toBeVisible({ timeout: FIT_TIMEOUT_MS });
	await tab.click();
	await expect(page.locator('.terminal-container')).toBeVisible({ timeout: FIT_TIMEOUT_MS });
	await expect(page.locator('.xterm-screen')).toBeVisible({ timeout: FIT_TIMEOUT_MS });
}

type FitMetrics = {
	containerWidth: number;
	containerHeight: number;
	screenWidth: number;
	screenHeight: number;
};

async function readFitMetrics(page: Page): Promise<FitMetrics | null> {
	return page.evaluate(() => {
		const containers = [...document.querySelectorAll('.terminal-container')] as HTMLElement[];
		const container = containers.find((el) => {
			const r = el.getBoundingClientRect();
			return r.width > 40 && r.height > 40 && el.offsetParent !== null;
		});
		if (!container) return null;
		const screen = container.querySelector('.xterm-screen');
		if (!screen) return null;
		const cr = container.getBoundingClientRect();
		const sr = screen.getBoundingClientRect();
		return {
			containerWidth: cr.width,
			containerHeight: cr.height,
			screenWidth: sr.width,
			screenHeight: sr.height
		};
	});
}

async function expectTerminalFillsContainer(page: Page) {
	await expect
		.poll(
			async () => {
				const metrics = await readFitMetrics(page);
				if (!metrics) return false;
				const widthSlack = metrics.containerWidth - metrics.screenWidth;
				const heightSlack = metrics.containerHeight - metrics.screenHeight;
				return (
					widthSlack > -4 &&
					heightSlack > -4 &&
					widthSlack < FIT_SLACK_PX &&
					heightSlack < FIT_SLACK_PX
				);
			},
			{ timeout: FIT_TIMEOUT_MS }
		)
		.toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.describe('terminal fit', () => {
	test('xterm screen fills the container after maximize and after a split drag', async ({
		page
	}) => {
		test.setTimeout(180_000);
		await createSvelteProject(page, uniqueProjectName('Terminal Fit'));
		await openTerminalPane(page);

		await terminalTabgroup(page).getByRole('button', { name: 'Fullscreen' }).click();
		await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
		await expectTerminalFillsContainer(page);

		await page.getByRole('button', { name: 'Exit fullscreen' }).click();
		await openTerminalPane(page);
		await expectTerminalFillsContainer(page);

		const slider = page.getByRole('slider', { name: /resize pane/i }).last();
		await expect(slider).toBeVisible();
		const box = await slider.boundingBox();
		expect(box).not.toBeNull();
		if (!box) return;

		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y - 80, { steps: 8 });
		await page.mouse.up();

		await expectTerminalFillsContainer(page);
	});
});
