import { expect, test, type Page } from '@playwright/test';
import { agentPanel, agentToggle, expectAgentPanelClosed, openAgentPanel } from './helpers/agent-panel';

const CREATE_PROJECT_TIMEOUT_MS = 60_000;

async function ensureDashboard(page: Page) {
	if (!page.url().includes('/editor/')) {
		await page.goto('/dashboard');
		return;
	}
	await page.getByRole('button', { name: 'Back to projects' }).click();
	await expect(page).toHaveURL('/dashboard', { timeout: CREATE_PROJECT_TIMEOUT_MS });
}

async function createSvelteProject(
	page: Page,
	name: string,
	options?: { openAgentPanel?: boolean },
) {
	await ensureDashboard(page);
	await page.getByRole('button', { name: /new project/i }).click();
	await page.getByLabel('Name').fill(name);
	await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+$/i, { timeout: CREATE_PROJECT_TIMEOUT_MS });
	if (options?.openAgentPanel !== false) {
		await openAgentPanel(page);
	}
}

async function waitForHarnessHook(page: Page) {
	await openAgentPanel(page);
	await page.waitForFunction(
		() => typeof (window as Window & { __harnessEditComponent?: unknown }).__harnessEditComponent === 'function'
	);
}

test.describe.configure({ mode: 'serial' });

test.describe('agent harness', () => {
	test('AgentRail visible with idle tool log on editor', async ({ page }) => {
		test.setTimeout(180_000);
		await createSvelteProject(page, 'Harness Idle');
		await page.getByRole('button', { name: 'Show tool log' }).click();
		await expect(page.getByText('No agent events yet')).toBeVisible();
	});

	test('Agent panel collapse toggles aria-expanded from header', async ({ page }) => {
		test.setTimeout(180_000);
		await createSvelteProject(page, 'Harness Toggle', { openAgentPanel: false });
		const toggle = agentToggle(page);
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expectAgentPanelClosed(page);
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(agentPanel(page)).toBeVisible();
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expectAgentPanelClosed(page);
	});

	test('denied SDK write surfaces tool log deny entry', async ({ page }) => {
		test.setTimeout(180_000);
		await createSvelteProject(page, 'Harness Deny');
		await waitForHarnessHook(page);
		await page.getByRole('button', { name: 'Show tool log' }).click();
		await page.evaluate(async () => {
			const fn = (window as Window & { __harnessEditComponent?: (p: string, c: string) => Promise<unknown> })
				.__harnessEditComponent;
			if (!fn) throw new Error('harness hook missing');
			await fn('lib/agent-sdk/index.ts', '// blocked');
		});
		await expect(page.getByText('[deny] lib/agent-sdk/index.ts')).toBeVisible();
	});

	test('allowed guest write records last path in harness status', async ({ page }) => {
		test.setTimeout(180_000);
		await createSvelteProject(page, 'Harness Write');
		await waitForHarnessHook(page);
		await page.evaluate(async () => {
			const fn = (window as Window & { __harnessEditComponent?: (p: string, c: string) => Promise<unknown> })
				.__harnessEditComponent;
			if (!fn) throw new Error('harness hook missing');
			await fn(
				'components/TaskPanel.svelte',
				'<script>import { emit } from "../lib/agent-sdk/index.ts";</script><button onclick={() => emit("click", { ok: true })} aria-label="task">Task</button>'
			);
		});
		await page.getByRole('button', { name: 'Show harness status' }).click();
		await expect(page.getByText('components/TaskPanel.svelte')).toBeVisible();
	});
});
