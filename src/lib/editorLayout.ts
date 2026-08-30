import {
	buildNodeParentMap,
	cloneConfig,
	nodeConfigType,
	parseLayoutConfig,
	simplifyTabGroup,
	type LayoutConfig,
	type NodeConfig,
	type SplitConfig,
	type TabGroupConfig
} from 'horizon-layout';
import { settings } from '$lib/settings/store.svelte';
import {
	applyLayoutPreset,
	createLayoutFromPreset,
	inferLayoutPreset,
	type EditorLayoutPresetId
} from '$lib/editorLayoutPresets';
import { getActiveEditorScopeId, layoutStorageKey } from '$lib/projects/projectScope';

export const FILE_VIEW_PREFIX = 'file:';
export const TERMINAL_VIEW_PREFIX = 'terminal:';
export const AGENT_VIEW_PREFIX = 'agent:';
export const EMPTY_PANE_VIEW_ID = 'empty:pane';
export const GROUP_VIEW_PREFIX = 'group:';
export const LAYOUT_STORAGE_KEY = 'app-builder:horizon-layout:v4';

function resolveLayoutStorageKey(): string {
	const projectId = getActiveEditorScopeId();
	return projectId ? layoutStorageKey(projectId) : LAYOUT_STORAGE_KEY;
}
const LEGACY_STORAGE_KEYS = [
	'app-builder:horizon-layout',
	'app-builder:horizon-layout:v2',
	'app-builder:horizon-layout:v3'
];
const LEGACY_TERMINAL_PANEL_ID = 'panel:terminal';

export const PANEL_IDS = {
	files: 'panel:files',
	preview: 'panel:preview',
	logs: 'panel:logs',
	console: 'panel:console',
	agent: 'panel:agent'
} as const;

const LEGACY_SETTINGS_PANEL_ID = 'panel:settings';

const KNOWN_PANEL_IDS = new Set<string>(Object.values(PANEL_IDS));

export function fileViewId(path: string): string {
	return `${FILE_VIEW_PREFIX}${path}`;
}

export function pathFromFileViewId(id: string): string | null {
	return id.startsWith(FILE_VIEW_PREFIX) ? id.slice(FILE_VIEW_PREFIX.length) : null;
}

export function isFileViewId(id: string): boolean {
	return id.startsWith(FILE_VIEW_PREFIX);
}

export function terminalViewId(sessionId: string): string {
	return `${TERMINAL_VIEW_PREFIX}${sessionId}`;
}

export function sessionIdFromTerminalViewId(id: string): string | null {
	return id.startsWith(TERMINAL_VIEW_PREFIX) ? id.slice(TERMINAL_VIEW_PREFIX.length) : null;
}

export function isTerminalViewId(id: string): boolean {
	return id.startsWith(TERMINAL_VIEW_PREFIX);
}

export function agentViewId(sessionId: string): string {
	return `${AGENT_VIEW_PREFIX}${sessionId}`;
}

export function sessionIdFromAgentViewId(id: string): string | null {
	return id.startsWith(AGENT_VIEW_PREFIX) ? id.slice(AGENT_VIEW_PREFIX.length) : null;
}

export function isAgentViewId(id: string): boolean {
	return id.startsWith(AGENT_VIEW_PREFIX);
}

export function createAgentSessionId(): string {
	return crypto.randomUUID();
}

export function collectAgentSessionIds(config: LayoutConfig): string[] {
	const ids: string[] = [];

	walkNodes(config.root, (tabGroup) => {
		if (!tabGroup.tabs.some(isAgentViewId)) return;

		for (const tabId of tabGroup.tabs) {
			const sessionId = sessionIdFromAgentViewId(tabId);
			if (sessionId) ids.push(sessionId);
		}
	});

	return ids;
}

export function isEmptyPaneViewId(id: string): boolean {
	return id === EMPTY_PANE_VIEW_ID;
}

export function createTerminalSessionId(): string {
	return crypto.randomUUID();
}

export function collectTerminalSessionIds(config: LayoutConfig): string[] {
	const ids: string[] = [];

	walkNodes(config.root, (tabGroup) => {
		if (!tabGroup.tabs.some(isTerminalViewId)) return;

		for (const tabId of tabGroup.tabs) {
			const sessionId = sessionIdFromTerminalViewId(tabId);
			if (sessionId) ids.push(sessionId);
		}
	});

	return ids;
}

export function collectFilePaths(config: LayoutConfig): string[] {
	const paths = new Set<string>();
	walkNodes(config.root, (tabGroup) => {
		for (const tabId of tabGroup.tabs) {
			const path = pathFromFileViewId(tabId);
			if (path) paths.add(path);
		}
	});
	return [...paths];
}

export function createInitialLayout(
	filePaths: string[],
	terminalSessionId = createTerminalSessionId(),
	presetId: EditorLayoutPresetId = settings.editor.layoutPreset
): LayoutConfig {
	return createLayoutFromPreset(presetId, {
		filePaths: filePaths.length ? filePaths : ['/App.svelte'],
		terminalSessionIds: [terminalSessionId],
		includeConsole: true,
		includeAgent: presetId === 'agent-focus'
	});
}

function findTerminalTabGroup(node: NodeConfig): TabGroupConfig | null {
	let terminalGroup: TabGroupConfig | null = null;

	walkNodes(node, (tabGroup) => {
		if (tabGroup.tabs.some(isTerminalViewId) || tabGroup.tabs.includes(LEGACY_TERMINAL_PANEL_ID)) {
			terminalGroup = tabGroup;
		}
	});

	return terminalGroup;
}

export function addTerminalToLayout(config: LayoutConfig, sessionId: string): LayoutConfig {
	const id = terminalViewId(sessionId);
	const next = cloneConfig(config);

	if (!next.root) {
		return createInitialLayout(['/App.svelte'], sessionId);
	}

	if (findTabGroupContaining(next.root, id)) {
		activateTab(next.root, id);
		return next;
	}

	const target = findTerminalTabGroup(next.root);
	if (!target) return next;

	const tabs = target.tabs.filter((tabId) => tabId !== LEGACY_TERMINAL_PANEL_ID);
	target.tabs = [...tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return next;
}

export function removeTerminalFromLayout(config: LayoutConfig, sessionId: string): LayoutConfig {
	const id = terminalViewId(sessionId);
	const next = cloneConfig(config);
	if (!next.root) return next;

	if (!findTabGroupContaining(next.root, id)) return next;

	const parentMap = buildNodeParentMap(next.root);
	removeTabFromNode(next.root, id, next, parentMap);
	return next;
}

function findAgentTabGroup(node: NodeConfig): TabGroupConfig | null {
	let agentGroup: TabGroupConfig | null = null;

	walkNodes(node, (tabGroup) => {
		if (
			tabGroup.tabs.some(isAgentViewId) ||
			tabGroup.tabs.includes(PANEL_IDS.agent)
		) {
			agentGroup = tabGroup;
		}
	});

	return agentGroup;
}

export function addAgentToLayout(config: LayoutConfig, sessionId: string): LayoutConfig {
	const id = agentViewId(sessionId);
	const next = cloneConfig(config);

	if (!next.root) {
		return migrateAddAgentPanel(createInitialLayout(['/App.svelte']), sessionId);
	}

	if (findTabGroupContaining(next.root, id)) {
		activateTab(next.root, id);
		return next;
	}

	const target = findAgentTabGroup(next.root);
	if (!target) {
		if (inferLayoutPreset(next) === 'agent-focus') {
			return applyLayoutPreset(next, 'agent-focus', {
				includeAgent: true,
				includeConsole: isConsolePanelVisible(next),
				agentSessionIds: [sessionId, ...collectAgentSessionIds(next)]
			});
		}
		return migrateAddAgentPanel(next, sessionId);
	}

	const tabs = target.tabs.filter((tabId) => tabId !== PANEL_IDS.agent);
	target.tabs = [...tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return next;
}

export function removeAgentFromLayout(config: LayoutConfig, sessionId: string): LayoutConfig {
	const id = agentViewId(sessionId);
	const next = cloneConfig(config);
	if (!next.root) return next;

	if (!findTabGroupContaining(next.root, id)) return next;

	const parentMap = buildNodeParentMap(next.root);
	removeTabFromNode(next.root, id, next, parentMap);
	return next;
}

export function addFileToLayout(config: LayoutConfig, path: string): LayoutConfig {
	const id = fileViewId(path);
	const next = cloneConfig(config);

	if (!next.root) {
		return createInitialLayout([path]);
	}

	if (findTabGroupContaining(next.root, id)) {
		activateTab(next.root, id);
		return next;
	}

	const target = findPreferredFileTabGroup(next.root, id) ?? findFirstTabGroup(next.root);
	if (!target) return next;

	const emptyIndex = target.tabs.indexOf(EMPTY_PANE_VIEW_ID);
	if (emptyIndex !== -1) {
		target.tabs = target.tabs.map((tabId) =>
			tabId === EMPTY_PANE_VIEW_ID ? id : tabId
		) as typeof target.tabs;
		target.activeTabIndex = target.tabs.indexOf(id);
		return next;
	}

	target.tabs = [...target.tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return next;
}

/** Insert an opened file into a tab group that is currently showing the empty pane.
 * Replaces the empty-pane placeholder in place, so the file opens where the user clicked. */
export function insertFileIntoEmptyPane(config: LayoutConfig, path: string): LayoutConfig {
	const id = fileViewId(path);
	const next = cloneConfig(config);
	if (!next.root) return next;

	walkNodes(next.root, (tabGroup) => {
		const emptyIndex = tabGroup.tabs.indexOf(EMPTY_PANE_VIEW_ID);
		if (emptyIndex === -1) return;

		const tabs = tabGroup.tabs.map((tabId) =>
			tabId === EMPTY_PANE_VIEW_ID ? id : tabId
		) as typeof tabGroup.tabs;
		tabGroup.tabs = tabs;
		if (tabGroup.activeTabIndex === emptyIndex || tabGroup.activeTabIndex >= tabs.length) {
			tabGroup.activeTabIndex = tabs.indexOf(id);
		}
	});

	return next;
}

/** Remove any tab (file, terminal, panel, or group view) from the layout. */
/** Append a view id to the most relevant existing tab group (first file group, else first). */
export function addViewToPreferredGroup(config: LayoutConfig, viewId: string): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) {
		return { ...next, root: { tabs: [viewId], activeTabIndex: 0 } };
	}

	let target: TabGroupConfig | null = null;
	let fallback: TabGroupConfig | null = null;
	walkNodes(next.root, (tabGroup) => {
		if (!fallback) fallback = tabGroup;
		if (!target && tabGroup.tabs.some(isFileViewId)) target = tabGroup;
	});

	const dest = target ?? fallback;
	if (!dest) return next;

	dest.tabs = [...dest.tabs, viewId] as typeof dest.tabs;
	dest.activeTabIndex = dest.tabs.length - 1;
	return next;
}

export function removeViewFromLayout(config: LayoutConfig, viewId: string): LayoutConfig {
	const next = cloneConfig(config);
	if (next.maximizedView === viewId) delete next.maximizedView;
	if (!next.root) return next;

	const parentMap = buildNodeParentMap(next.root);
	removeTabFromNode(next.root, viewId, next, parentMap);
	return next;
}

/** All container-group view ids present in the layout. */
export function collectGroupViewIds(config: LayoutConfig): string[] {
	const ids: string[] = [];
	if (!config.root) return ids;
	walkNodes(config.root, (tabGroup) => {
		for (const tabId of tabGroup.tabs) {
			if (tabId.startsWith(GROUP_VIEW_PREFIX)) ids.push(tabId);
		}
	});
	return ids;
}

export function removeFileFromLayout(config: LayoutConfig, path: string): LayoutConfig {
	const id = fileViewId(path);
	const next = cloneConfig(config);
	if (!next.root) return next;

	const parentMap = buildNodeParentMap(next.root);
	removeTabFromNode(next.root, id, next, parentMap);
	return next;
}

function walkNodes(
	node: NodeConfig | undefined,
	visitTabGroup: (tabGroup: TabGroupConfig) => void
) {
	if (!node) return;

	if (nodeConfigType(node) === 'tabGroup') {
		visitTabGroup(node);
		return;
	}

	for (const child of node.views) {
		walkNodes(child, visitTabGroup);
	}
}

function findFirstTabGroup(node: NodeConfig): TabGroupConfig | null {
	if (nodeConfigType(node) === 'tabGroup') return node;
	for (const child of node.views) {
		const found = findFirstTabGroup(child);
		if (found) return found;
	}
	return null;
}

function findTabGroupContaining(node: NodeConfig, tabId: string): TabGroupConfig | null {
	if (nodeConfigType(node) === 'tabGroup') {
		return node.tabs.includes(tabId) ? node : null;
	}

	for (const child of node.views) {
		const found = findTabGroupContaining(child, tabId);
		if (found) return found;
	}
	return null;
}

function findPreferredFileTabGroup(
	node: NodeConfig,
	activeId: string
): TabGroupConfig | null {
	let preferred: TabGroupConfig | null = null;
	let emptyPane: TabGroupConfig | null = null;

	walkNodes(node, (tabGroup) => {
		if (tabGroup.tabs.includes(EMPTY_PANE_VIEW_ID)) {
			emptyPane = tabGroup;
		}
		if (tabGroup.tabs.some(isFileViewId)) {
			preferred = tabGroup;
		}
		if (tabGroup.tabs.includes(activeId)) {
			preferred = tabGroup;
		}
	});

	return emptyPane ?? preferred;
}

function activateTab(node: NodeConfig, tabId: string) {
	if (nodeConfigType(node) === 'tabGroup') {
		const index = node.tabs.indexOf(tabId);
		if (index >= 0) node.activeTabIndex = index;
		return;
	}

	for (const child of node.views) {
		activateTab(child, tabId);
	}
}

function removeTabFromNode(
	node: NodeConfig,
	tabId: string,
	config: LayoutConfig,
	parentMap: ReturnType<typeof buildNodeParentMap>
) {
	if (nodeConfigType(node) === 'tabGroup') {
		const tabGroup = node;
		const index = tabGroup.tabs.indexOf(tabId);
		if (index === -1) return;

		const nextTabs = tabGroup.tabs.filter((id) => id !== tabId) as typeof tabGroup.tabs;
		if (nextTabs.length === 0) {
			if (isFileViewId(tabId) && settings.editor.keepEmptyPanes) {
				// Keep the pane alive as an empty placeholder (setting enabled).
				tabGroup.tabs = [EMPTY_PANE_VIEW_ID];
				tabGroup.activeTabIndex = 0;
			} else {
				// Remove the pane and collapse the now-empty split up the tree.
				tabGroup.tabs = [] as typeof tabGroup.tabs;
				simplifyTabGroup(tabGroup, parentMap, config);
			}
			return;
		}

		tabGroup.tabs = nextTabs;
		if (tabGroup.activeTabIndex >= tabGroup.tabs.length) {
			tabGroup.activeTabIndex = tabGroup.tabs.length - 1;
		} else if (index < tabGroup.activeTabIndex) {
			tabGroup.activeTabIndex -= 1;
		}

		if (tabGroup.tabs.length === 0) {
			simplifyTabGroup(tabGroup, parentMap, config);
		}
		return;
	}

	for (const child of node.views) {
		removeTabFromNode(child, tabId, config, parentMap);
	}
}

export function activateFileInLayout(config: LayoutConfig, path: string): LayoutConfig {
	const id = fileViewId(path);
	const next = cloneConfig(config);
	if (!next.root || !findTabGroupContaining(next.root, id)) return config;
	activateTab(next.root, id);
	return next;
}

export function isFileActiveInLayout(config: LayoutConfig, path: string): boolean {
	const id = fileViewId(path);
	let active = false;

	walkNodes(config.root, (tabGroup) => {
		if (tabGroup.tabs[tabGroup.activeTabIndex] === id) active = true;
	});

	return active;
}

export function getFocusedFilePath(config: LayoutConfig): string | null {
	let focused: string | null = null;

	walkNodes(config.root, (tabGroup) => {
		const activeId = tabGroup.tabs[tabGroup.activeTabIndex];
		if (!activeId) return;
		const path = pathFromFileViewId(activeId);
		if (path) focused = path;
	});

	return focused;
}

function isAllowedTabId(id: string): boolean {
	if (id === LEGACY_SETTINGS_PANEL_ID) return false;

	return (
		isFileViewId(id) ||
		isTerminalViewId(id) ||
		isAgentViewId(id) ||
		KNOWN_PANEL_IDS.has(id) ||
		id.startsWith(GROUP_VIEW_PREFIX)
	);
}

function migrateLegacyAgentPanel(config: LayoutConfig): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	walkNodes(next.root, (tabGroup) => {
		const legacyIndex = tabGroup.tabs.indexOf(PANEL_IDS.agent);
		if (legacyIndex === -1) return;

		const replacement = agentViewId(createAgentSessionId());
		tabGroup.tabs = tabGroup.tabs.map((tabId) =>
			tabId === PANEL_IDS.agent ? replacement : tabId
		) as typeof tabGroup.tabs;

		if (tabGroup.activeTabIndex === legacyIndex) {
			tabGroup.activeTabIndex = tabGroup.tabs.indexOf(replacement);
		}
	});

	return next;
}

function migrateLegacyTerminalPanel(config: LayoutConfig): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	walkNodes(next.root, (tabGroup) => {
		const legacyIndex = tabGroup.tabs.indexOf(LEGACY_TERMINAL_PANEL_ID);
		if (legacyIndex === -1) return;

		const replacement = terminalViewId(createTerminalSessionId());
		tabGroup.tabs = tabGroup.tabs.map((tabId) =>
			tabId === LEGACY_TERMINAL_PANEL_ID ? replacement : tabId
		) as typeof tabGroup.tabs;

		if (tabGroup.activeTabIndex === legacyIndex) {
			tabGroup.activeTabIndex = tabGroup.tabs.indexOf(replacement);
		}
	});

	return next;
}

function normalizeSplitPoints(viewCount: number, existing: number[] = []): number[] {
	const needed = Math.max(0, viewCount - 1);
	if (needed === 0) return [];
	if (existing.length === needed) return [...existing];

	// Preserve the default editor band presets when resizing to common sizes.
	if (viewCount === 3) return [0.18, 0.5];
	if (viewCount === 4) return [0.15, 0.42, 0.68];

	return Array.from({ length: needed }, (_, index) => (index + 1) / viewCount);
}

function repairSplitPoints(node: NodeConfig): void {
	if (nodeConfigType(node) !== 'split') return;

	const split = node as SplitConfig;
	split.splitPoints = normalizeSplitPoints(split.views.length, split.splitPoints);
	for (const child of split.views) {
		repairSplitPoints(child);
	}
}

function sanitizeNode(node: NodeConfig): NodeConfig | null {
	if (nodeConfigType(node) === 'tabGroup') {
		const tabs = node.tabs.filter(isAllowedTabId);
		if (tabs.length === 0) return null;

		const activeId = node.tabs[node.activeTabIndex];
		const activeTabIndex = activeId ? tabs.indexOf(activeId) : 0;

		return {
			tabs: tabs as [string, ...string[]],
			activeTabIndex: activeTabIndex < 0 ? 0 : activeTabIndex
		};
	}

	const views: NodeConfig[] = [];
	for (const child of node.views) {
		const next = sanitizeNode(child);
		if (!next) return null;
		views.push(next);
	}

	if (views.length !== node.views.length) return null;

	return {
		direction: node.direction,
		splitPoints: normalizeSplitPoints(views.length, node.splitPoints),
		views: views as [NodeConfig, NodeConfig, ...NodeConfig[]]
	};
}

export function sanitizeLayout(config: LayoutConfig): LayoutConfig | null {
	if (!config.root) return null;

	const root = sanitizeNode(config.root);
	if (!root) return null;

	const next: LayoutConfig = { root };

	if (config.maximizedView && isAllowedTabId(config.maximizedView)) {
		next.maximizedView = config.maximizedView;
	}

	if (config.popouts?.length) {
		const popouts = config.popouts.filter(isAllowedTabId);
		if (popouts.length) next.popouts = popouts;
	}

	return next;
}

function collectTabIds(config: LayoutConfig): Set<string> {
	const ids = new Set<string>();
	walkNodes(config.root, (tabGroup) => {
		for (const id of tabGroup.tabs) ids.add(id);
	});
	for (const id of config.popouts ?? []) ids.add(id);
	if (config.maximizedView) ids.add(config.maximizedView);
	return ids;
}

function hasRequiredPanels(config: LayoutConfig): boolean {
	const ids = collectTabIds(config);
	const hasCorePanels = [PANEL_IDS.files, PANEL_IDS.preview, PANEL_IDS.logs].every((id) =>
		ids.has(id)
	);
	const hasTerminal = [...ids].some(isTerminalViewId);
	return hasCorePanels && hasTerminal;
}

function readStoredLayout(): string | null {
	if (typeof localStorage === 'undefined') return null;

	const current = localStorage.getItem(resolveLayoutStorageKey());
	if (current) return current;

	// Legacy global layouts only apply outside per-project scope (pre–multi-project).
	if (!getActiveEditorScopeId()) {
		for (const key of LEGACY_STORAGE_KEYS) {
			const legacy = localStorage.getItem(key);
			if (legacy) return legacy;
		}
	}

	return null;
}

export function normalizeEntryPath(entryFile: string): string {
	return entryFile.startsWith('/') ? entryFile : `/${entryFile}`;
}

/** Persist the default dock layout for a newly created project. */
export function seedDefaultProjectLayout(projectId: string, entryFile: string) {
	if (typeof localStorage === 'undefined') return;

	const key = layoutStorageKey(projectId);
	if (localStorage.getItem(key)) return;

	const layout = createInitialLayout([normalizeEntryPath(entryFile)], createTerminalSessionId(), settings.editor.layoutPreset);
	const sanitized = sanitizeLayout(layout);
	if (!sanitized) return;

	try {
		localStorage.setItem(key, JSON.stringify(sanitized));
	} catch {
		// Ignore quota / private-mode failures.
	}
}

function findBottomBandSplit(node: NodeConfig | undefined): SplitConfig | null {
	if (!node) return null;

	if (nodeConfigType(node) === 'split') {
		const split = node as SplitConfig;
		if (split.direction === 'horizontal') {
			const hasTerminal = split.views.some(
				(view) =>
					nodeConfigType(view) === 'tabGroup' &&
					(view as TabGroupConfig).tabs.some(isTerminalViewId)
			);
			const hasLogs = split.views.some(
				(view) =>
					nodeConfigType(view) === 'tabGroup' &&
					(view as TabGroupConfig).tabs.includes(PANEL_IDS.logs)
			);
			if (hasTerminal && hasLogs) return split;
		}

		for (const child of split.views) {
			const found = findBottomBandSplit(child);
			if (found) return found;
		}
	}

	return null;
}

function isBottomBandLayout(config: LayoutConfig): boolean {
	return Boolean(findBottomBandSplit(config.root));
}

function hasLogsBesidePreview(config: LayoutConfig): boolean {
	if (!config.root || nodeConfigType(config.root) !== 'split') return false;

	const root = config.root as SplitConfig;
	if (root.direction !== 'vertical' || root.views.length < 1) return false;

	const top = root.views[0];
	if (!top || nodeConfigType(top) !== 'split') return false;

	const topSplit = top as SplitConfig;
	if (topSplit.direction !== 'horizontal') return false;

	let logsInTop = false;
	walkNodes(top, (tabGroup) => {
		if (tabGroup.tabs.includes(PANEL_IDS.logs)) logsInTop = true;
	});

	return logsInTop;
}

function migrateBottomBandLayout(config: LayoutConfig): LayoutConfig {
	if (!config.root || isBottomBandLayout(config) || !hasLogsBesidePreview(config)) {
		return config;
	}

	const filePaths = collectFilePaths(config);
	const terminalIds = collectTerminalSessionIds(config);
	const hasConsole = collectTabIds(config).has(PANEL_IDS.console);

	let next = createInitialLayout(
		filePaths.length ? filePaths : ['/App.svelte'],
		terminalIds[0] ?? createTerminalSessionId()
	);

	for (let index = 1; index < terminalIds.length; index++) {
		next = addTerminalToLayout(next, terminalIds[index]!);
	}

	if (!hasConsole) {
		next = removeConsolePanel(next);
	}

	return next;
}

function findMainHorizontalSplit(node: NodeConfig | undefined): SplitConfig | null {
	if (!node) return null;

	if (nodeConfigType(node) === 'split') {
		const split = node as SplitConfig;
		if (split.direction === 'horizontal') {
			const hasFiles = split.views.some(
				(view) =>
					nodeConfigType(view) === 'tabGroup' &&
					(view as TabGroupConfig).tabs.includes(PANEL_IDS.files)
			);
			if (hasFiles) return split;
		}

		for (const child of split.views) {
			const found = findMainHorizontalSplit(child);
			if (found) return found;
		}
	}

	return null;
}

function migrateAddAgentPanel(
	config: LayoutConfig,
	sessionId = createAgentSessionId()
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	const id = agentViewId(sessionId);
	const existing = findAgentTabGroup(next.root);
	if (existing) {
		if (existing.tabs.includes(id)) return next;
		const tabs = existing.tabs.filter((tabId) => tabId !== PANEL_IDS.agent);
		existing.tabs = [...tabs, id] as typeof existing.tabs;
		existing.activeTabIndex = existing.tabs.length - 1;
		return next;
	}

	const mainBand = findMainHorizontalSplit(next.root);
	if (!mainBand) return next;

	const agentGroup: TabGroupConfig = { tabs: [id], activeTabIndex: 0 };
	const views = [...mainBand.views, agentGroup] as typeof mainBand.views;
	mainBand.views = views;
	mainBand.splitPoints = normalizeSplitPoints(views.length, mainBand.splitPoints);
	repairSplitPoints(next.root);

	return next;
}

export function isAgentPanelVisible(config: LayoutConfig): boolean {
	if (!config.root) return false;
	const ids = collectTabIds(config);
	if (ids.has(PANEL_IDS.agent)) return true;
	return collectAgentSessionIds(config).length > 0;
}

export function setAgentPanelVisible(config: LayoutConfig, visible: boolean): LayoutConfig {
	if (!config.root) return config;

	const currentlyVisible = isAgentPanelVisible(config);
	if (currentlyVisible === visible) return config;

	if (inferLayoutPreset(config) === 'agent-focus') {
		return applyLayoutPreset(config, 'agent-focus', {
			includeAgent: visible,
			includeConsole: isConsolePanelVisible(config),
			agentSessionIds: collectAgentSessionIds(config)
		});
	}

	if (visible) return migrateAddAgentPanel(cloneConfig(config));
	return removeAgentPanel(cloneConfig(config));
}

function removeAgentPanel(config: LayoutConfig): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	const mainBand = findMainHorizontalSplit(next.root);
	if (!mainBand) return next;

	const agentIndex = mainBand.views.findIndex((view) => {
		if (nodeConfigType(view) !== 'tabGroup') return false;
		const tabs = (view as TabGroupConfig).tabs;
		return tabs.some(isAgentViewId) || tabs.includes(PANEL_IDS.agent);
	});
	if (agentIndex === -1) return next;

	const remaining = mainBand.views.filter((_, index) => index !== agentIndex) as [
		NodeConfig,
		NodeConfig,
		...NodeConfig[]
	];
	mainBand.views = remaining;
	mainBand.splitPoints = normalizeSplitPoints(remaining.length, mainBand.splitPoints);
	repairSplitPoints(next.root);

	return next;
}

function migrateAddConsolePanel(config: LayoutConfig): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	const ids = collectTabIds(next);
	if (ids.has(PANEL_IDS.console)) return next;

	const bottomBand = findBottomBandSplit(next.root);
	if (!bottomBand) return next;

	const consoleGroup: TabGroupConfig = { tabs: [PANEL_IDS.console], activeTabIndex: 0 };
	bottomBand.views = [...bottomBand.views, consoleGroup] as typeof bottomBand.views;
	bottomBand.splitPoints = normalizeSplitPoints(bottomBand.views.length, bottomBand.splitPoints);
	return next;
}

export function isConsolePanelVisible(config: LayoutConfig): boolean {
	if (!config.root) return false;
	return collectTabIds(config).has(PANEL_IDS.console);
}

export function setConsolePanelVisible(config: LayoutConfig, visible: boolean): LayoutConfig {
	if (!config.root) return config;

	const currentlyVisible = isConsolePanelVisible(config);
	if (currentlyVisible === visible) return config;

	if (visible) return migrateAddConsolePanel(cloneConfig(config));
	return removeConsolePanel(cloneConfig(config));
}

function removeConsolePanel(config: LayoutConfig): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	const bottomBand = findBottomBandSplit(next.root);
	if (!bottomBand) return next;

	const consoleIndex = bottomBand.views.findIndex(
		(view) =>
			nodeConfigType(view) === 'tabGroup' &&
			(view as TabGroupConfig).tabs.includes(PANEL_IDS.console)
	);
	if (consoleIndex === -1) return next;

	const remaining = bottomBand.views.filter((_, index) => index !== consoleIndex) as [
		NodeConfig,
		NodeConfig,
		...NodeConfig[]
	];
	bottomBand.views = remaining;
	bottomBand.splitPoints = normalizeSplitPoints(remaining.length, bottomBand.splitPoints);

	return next;
}

export function loadSavedLayout(): LayoutConfig | null {
	try {
		const raw = readStoredLayout();
		if (!raw) return null;
		const parsed = parseLayoutConfig(JSON.parse(raw));
		const migrated = migrateAddConsolePanel(
			migrateBottomBandLayout(
				migrateLegacyAgentPanel(migrateLegacyTerminalPanel(parsed))
			)
		);
		const sanitized = sanitizeLayout(migrated);
		if (!sanitized || !hasRequiredPanels(sanitized)) return null;
		return sanitized;
	} catch {
		return null;
	}
}

export function saveLayout(config: LayoutConfig) {
	if (typeof localStorage === 'undefined') return;

	try {
		const sanitized = sanitizeLayout(config);
		if (!sanitized) return;
		localStorage.setItem(resolveLayoutStorageKey(), JSON.stringify(sanitized));
	} catch {
		// Ignore quota / private-mode failures.
	}
}

export function resolveEditorLayout(filePaths: string[]): LayoutConfig {
	return loadSavedLayout() ?? createInitialLayout(filePaths, createTerminalSessionId(), settings.editor.layoutPreset);
}

export { applyLayoutPreset, inferLayoutPreset, type EditorLayoutPresetId } from '$lib/editorLayoutPresets';

type SplitDirection = 'left' | 'right' | 'up' | 'down';

type ParentEntry = {
	parent: SplitConfig;
	index: number;
};

const SPLIT_MIN_WIDTH_RATIO = 0.1;
const SPLIT_MIN_HEIGHT_RATIO = 0.2;
const SPLIT_MAX_DEPTH = 6;

function paneMidpoint(parent: ParentEntry): number {
	return (
		((parent.parent.splitPoints[parent.index - 1] ?? 0) +
			(parent.parent.splitPoints[parent.index] ?? 1)) /
		2
	);
}

function getNodeDepth(
	node: NodeConfig,
	nodeParentMap: ReturnType<typeof buildNodeParentMap>,
	depth = 1
): number {
	const parent = nodeParentMap.get(node);
	if (!parent) return depth;
	return getNodeDepth(parent.parent, nodeParentMap, depth + 1);
}

function canSplitTabGroup(
	tabGroup: TabGroupConfig,
	splitDirection: SplitConfig['direction'],
	nodeParentMap: ReturnType<typeof buildNodeParentMap>
): boolean {
	const parent = nodeParentMap.get(tabGroup);
	if (parent?.parent.direction === splitDirection) {
		return (
			((parent.parent.splitPoints[parent.index] ?? 1) -
				(parent.parent.splitPoints[parent.index - 1] ?? 0)) /
				2 >=
			(splitDirection === 'horizontal' ? SPLIT_MIN_WIDTH_RATIO : SPLIT_MIN_HEIGHT_RATIO)
		);
	}

	return getNodeDepth(tabGroup, nodeParentMap) + 1 <= SPLIT_MAX_DEPTH;
}

export function toggleMaximizedView(config: LayoutConfig, viewId: string): LayoutConfig {
	const next = cloneConfig(config);
	if (next.maximizedView === viewId) {
		delete next.maximizedView;
	} else {
		next.maximizedView = viewId;
	}
	return next;
}

/** Split a view out of its tab group into a new adjacent pane (mirrors horizon-layout Alt+Arrow). */
export function splitViewInLayout(
	config: LayoutConfig,
	viewId: string,
	direction: SplitDirection
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const tabGroup = findTabGroupContaining(next.root, viewId);
	if (!tabGroup || tabGroup.tabs.length <= 1) return config;

	const tabIndex = tabGroup.tabs.indexOf(viewId);
	if (tabIndex === -1) return config;

	const splitDirection =
		direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
	const nodeParentMap = buildNodeParentMap(next.root);
	if (!canSplitTabGroup(tabGroup, splitDirection, nodeParentMap)) return config;

	const tabToSplitOut = tabGroup.tabs[tabIndex]!;
	const oldActiveTabIndex = tabGroup.activeTabIndex;
	const newTabGroup: TabGroupConfig = { tabs: [tabToSplitOut], activeTabIndex: 0 };
	const parent = nodeParentMap.get(tabGroup);
	const isCurrentTabFirst = direction === 'left' || direction === 'up';
	const createsNestedSplit = !parent || parent.parent.direction !== splitDirection;

	tabGroup.tabs = tabGroup.tabs.filter((_, index) => index !== tabIndex) as typeof tabGroup.tabs;
	tabGroup.activeTabIndex = Math.min(oldActiveTabIndex, tabGroup.tabs.length - 1);

	if (createsNestedSplit) {
		const split: SplitConfig = {
			direction: splitDirection,
			views: isCurrentTabFirst ? [newTabGroup, tabGroup] : [tabGroup, newTabGroup],
			splitPoints: [0.5]
		};
		const tabgroupParent = nodeParentMap.get(tabGroup);
		if (tabgroupParent) {
			tabgroupParent.parent.views[tabgroupParent.index] = split;
		} else {
			next.root = split;
		}
	} else if (parent) {
		const insertIndex = parent.index + (isCurrentTabFirst ? 0 : 1);
		parent.parent.views.splice(insertIndex, 0, newTabGroup);
		parent.parent.splitPoints.splice(parent.index, 0, paneMidpoint(parent));
	}

	return next;
}

export function tabGroupHasMultipleTabs(config: LayoutConfig, viewId: string): boolean {
	if (!config.root) return false;
	const tabGroup = findTabGroupContaining(config.root, viewId);
	return Boolean(tabGroup && tabGroup.tabs.length > 1);
}

/** Resolve the layout-active tab when `hintTabId` identifies a tab group. */
export function resolveActiveTabInLayout(
	config: LayoutConfig,
	hintTabId: string | null
): string | null {
	if (!hintTabId || !config.root) return hintTabId;
	const group = findTabGroupContaining(config.root, hintTabId);
	if (!group) return hintTabId;
	return group.tabs[group.activeTabIndex] ?? hintTabId;
}

export function selectAdjacentTabInLayout(
	config: LayoutConfig,
	activeTabId: string,
	delta: -1 | 1
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const group = findTabGroupContaining(next.root, activeTabId);
	if (!group || group.tabs.length <= 1) return config;

	group.activeTabIndex = (group.activeTabIndex + delta + group.tabs.length) % group.tabs.length;
	return next;
}

export function activatePanelTabInLayout(config: LayoutConfig, panelId: string): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;
	activateTab(next.root, panelId);
	return next;
}

function splitSingleTabGroupInLayout(
	config: LayoutConfig,
	tabGroup: TabGroupConfig,
	direction: SplitDirection
): LayoutConfig {
	if (!config.root) return config;

	const splitDirection =
		direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
	const nodeParentMap = buildNodeParentMap(config.root);
	if (!canSplitTabGroup(tabGroup, splitDirection, nodeParentMap)) return config;

	const newGroup: TabGroupConfig = { tabs: [EMPTY_PANE_VIEW_ID], activeTabIndex: 0 };
	const parent = nodeParentMap.get(tabGroup);
	const isFirst = direction === 'left' || direction === 'up';

	if (!parent || parent.parent.direction !== splitDirection) {
		const split: SplitConfig = {
			direction: splitDirection,
			views: isFirst ? [newGroup, tabGroup] : [tabGroup, newGroup],
			splitPoints: [0.5]
		};
		if (parent) {
			parent.parent.views[parent.index] = split;
		} else {
			config.root = split;
		}
	} else {
		const insertIndex = parent.index + (isFirst ? 0 : 1);
		parent.parent.views.splice(insertIndex, 0, newGroup);
		parent.parent.splitPoints.splice(parent.index, 0, paneMidpoint(parent));
	}

	return config;
}

export function splitActivePaneInLayout(
	config: LayoutConfig,
	activeTabId: string,
	direction: SplitDirection
): LayoutConfig {
	if (!config.root) return config;

	if (tabGroupHasMultipleTabs(config, activeTabId)) {
		return splitViewInLayout(config, activeTabId, direction);
	}

	const group = findTabGroupContaining(config.root, activeTabId);
	if (!group) return config;

	const next = cloneConfig(config);
	const clonedGroup = findTabGroupContaining(next.root!, activeTabId);
	if (!clonedGroup) return config;
	return splitSingleTabGroupInLayout(next, clonedGroup, direction);
}

export function splitFibonacciInLayout(config: LayoutConfig, activeTabId: string): LayoutConfig {
	if (!config.root) return config;
	const group = findTabGroupContaining(config.root, activeTabId);
	if (!group) return config;

	const nodeParentMap = buildNodeParentMap(config.root);
	const depth = getNodeDepth(group, nodeParentMap);
	const direction: SplitDirection = depth % 2 === 0 ? 'right' : 'down';
	return splitActivePaneInLayout(config, activeTabId, direction);
}

export function addPaneToLayout(config: LayoutConfig, activeTabId?: string | null): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) {
		return { root: { tabs: [EMPTY_PANE_VIEW_ID], activeTabIndex: 0 } };
	}

	const anchorGroup =
		(activeTabId ? findTabGroupContaining(next.root, activeTabId) : null) ??
		findFirstTabGroup(next.root);
	if (!anchorGroup) return next;

	if (!anchorGroup.tabs.includes(EMPTY_PANE_VIEW_ID)) {
		anchorGroup.tabs = [...anchorGroup.tabs, EMPTY_PANE_VIEW_ID] as typeof anchorGroup.tabs;
		anchorGroup.activeTabIndex = anchorGroup.tabs.length - 1;
		return next;
	}

	return splitSingleTabGroupInLayout(next, anchorGroup, 'right');
}
