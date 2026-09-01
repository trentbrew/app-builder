import { expect, type Locator, type Page } from '@playwright/test';

export const AGENT_PANEL_TIMEOUT_MS = 120_000;

/** @deprecated Use AGENT_PANEL_TIMEOUT_MS */
export const AGENT_RAIL_TIMEOUT_MS = AGENT_PANEL_TIMEOUT_MS;

export function agentToggle(page: Page) {
	return page.getByRole('button', { name: /toggle agent panel/i });
}

/** Dock-embedded agent pane (`agent-pane.svelte`), not the legacy overlay rail. */
export function agentPanel(page: Page): Locator {
	return page.locator('#agent-pane-panel');
}

export async function openAgentPanel(page: Page) {
	const toggle = agentToggle(page);
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
		await toggle.click();
	}
	await expect(agentPanel(page)).toBeVisible({
		timeout: AGENT_PANEL_TIMEOUT_MS
	});
}

export async function expectAgentPanelClosed(page: Page) {
	await expect(agentPanel(page)).not.toBeVisible();
}

/** Dock agent pane (`agent-pane.svelte`) — tool log is under ⋯ → Agent logs. */
export async function openAgentToolLog(page: Page) {
	await openAgentPanel(page);
	await page.getByRole('button', { name: 'Agent options' }).click();
	await page.getByRole('menuitem', { name: 'Agent logs' }).click();
	await expect(page.getByLabel('Agent tool log')).toBeVisible();
}
