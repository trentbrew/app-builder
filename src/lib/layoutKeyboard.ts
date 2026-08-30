import {
	PANEL_IDS,
	type LayoutConfig,
	activatePanelTabInLayout,
	addPaneToLayout,
	selectAdjacentTabInLayout,
	splitActivePaneInLayout,
	splitFibonacciInLayout,
	toggleMaximizedView
} from '$lib/editorLayout';

export interface LayoutHandle {
	closeActiveTab(): void;
	splitActivePane(direction: 'left' | 'right' | 'up' | 'down'): void;
	splitActivePaneFibonacci(): void;
	frameActive(): void;
	selectAdjacentTab(delta: -1 | 1): void;
	appendActivePane(): void;
	getActivePaneTabId(): string | null;
	focusFilesPanel(): void;
}

export type DockLayoutDeps = {
	getConfig: () => LayoutConfig;
	setConfig: (config: LayoutConfig) => void;
	getActiveTabId: () => string | null;
	closeTab: (viewId: string) => void;
};

export function createDockLayoutHandle(deps: DockLayoutDeps): LayoutHandle {
	return {
		getActivePaneTabId: () => deps.getActiveTabId(),
		closeActiveTab() {
			const id = deps.getActiveTabId();
			if (id) deps.closeTab(id);
		},
		splitActivePane(direction) {
			const id = deps.getActiveTabId();
			if (!id) return;
			const config = deps.getConfig();
			const next = splitActivePaneInLayout(config, id, direction);
			if (next !== config) deps.setConfig(next);
		},
		splitActivePaneFibonacci() {
			const id = deps.getActiveTabId();
			if (!id) return;
			const config = deps.getConfig();
			const next = splitFibonacciInLayout(config, id);
			if (next !== config) deps.setConfig(next);
		},
		frameActive() {
			const id = deps.getActiveTabId();
			if (!id) return;
			const config = deps.getConfig();
			deps.setConfig(toggleMaximizedView(config, id));
		},
		selectAdjacentTab(delta) {
			const id = deps.getActiveTabId();
			if (!id) return;
			const config = deps.getConfig();
			const next = selectAdjacentTabInLayout(config, id, delta);
			if (next !== config) deps.setConfig(next);
		},
		appendActivePane() {
			const config = deps.getConfig();
			const next = addPaneToLayout(config, deps.getActiveTabId());
			if (next !== config) deps.setConfig(next);
		},
		focusFilesPanel() {
			const config = deps.getConfig();
			deps.setConfig(activatePanelTabInLayout(config, PANEL_IDS.files));
			requestAnimationFrame(() => {
				const explorer = document.querySelector('.file-explorer__body');
				if (explorer instanceof HTMLElement) explorer.focus();
			});
		}
	};
}

export function resolveActiveTabIdFromElement(el: Element | null): string | null {
	if (!el) return null;

	const tabGroup = el.closest('section.horizon-layout-tabgroup');
	if (tabGroup) {
		const active = tabGroup.querySelector(
			'.horizon-layout-tabgroup__tab--active[data-view-id]'
		);
		const id = active?.getAttribute('data-view-id');
		if (id) return id;
	}

	const tab = el.closest('[role="tab"][data-view-id]');
	return tab?.getAttribute('data-view-id') ?? null;
}
