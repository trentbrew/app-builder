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

export const FILE_VIEW_PREFIX = 'file:';
export const TERMINAL_VIEW_PREFIX = 'terminal:';
export const LAYOUT_STORAGE_KEY = 'app-builder:horizon-layout:v4';
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
	settings: 'panel:settings'
} as const;

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
	terminalSessionId = createTerminalSessionId()
): LayoutConfig {
	const fileTabs = (filePaths.length ? filePaths : ['/App.svelte']).map(
		fileViewId
	) as [string, ...string[]];
	const terminalTabs = [terminalViewId(terminalSessionId)] as [string, ...string[]];

	return {
		root: {
			direction: 'vertical',
			splitPoints: [0.68],
			views: [
				{
					direction: 'horizontal',
					splitPoints: [0.18, 0.5, 0.78],
					views: [
						{ tabs: [PANEL_IDS.files], activeTabIndex: 0 },
						{ tabs: fileTabs, activeTabIndex: Math.max(0, fileTabs.length - 1) },
						{ tabs: [PANEL_IDS.preview], activeTabIndex: 0 },
						{
							direction: 'vertical',
							splitPoints: [0.55],
							views: [
								{ tabs: [PANEL_IDS.logs], activeTabIndex: 0 },
								{ tabs: [PANEL_IDS.console], activeTabIndex: 0 }
							]
						}
					]
				},
				{ tabs: terminalTabs, activeTabIndex: 0 }
			]
		}
	};
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

	const tabGroup = findTerminalTabGroup(next.root);
	if (!tabGroup || tabGroup.tabs.length <= 1) return next;

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

	target.tabs = [...target.tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return next;
}

export function removeFileFromLayout(config: LayoutConfig, path: string): LayoutConfig {
	const id = fileViewId(path);
	const next = cloneConfig(config);
	if (!next.root) return next;

	const parentMap = buildNodeParentMap(next.root);
	removeTabFromNode(next.root, id, next, parentMap);
	return next;
}

export function isSettingsOpen(config: LayoutConfig): boolean {
	if (!config.root) return false;
	return Boolean(findTabGroupContaining(config.root, PANEL_IDS.settings));
}

export function openSettingsInLayout(config: LayoutConfig): LayoutConfig {
	const id = PANEL_IDS.settings;
	const next = cloneConfig(config);
	if (!next.root) return next;

	if (findTabGroupContaining(next.root, id)) {
		activateTab(next.root, id);
		return next;
	}

	const target = findPreferredFileTabGroup(next.root, id) ?? findFirstTabGroup(next.root);
	if (!target) return next;

	target.tabs = [...target.tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return next;
}

export function closeSettingsInLayout(config: LayoutConfig): LayoutConfig {
	const id = PANEL_IDS.settings;
	const next = cloneConfig(config);
	if (!next.root) return config;
	if (!findTabGroupContaining(next.root, id)) return config;

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

	walkNodes(node, (tabGroup) => {
		if (tabGroup.tabs.some(isFileViewId)) {
			preferred = tabGroup;
		}
		if (tabGroup.tabs.includes(activeId)) {
			preferred = tabGroup;
		}
	});

	return preferred;
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
		if (nextTabs.length === 0) return;

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
	return isFileViewId(id) || isTerminalViewId(id) || KNOWN_PANEL_IDS.has(id);
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
		splitPoints: [...node.splitPoints],
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

	const current = localStorage.getItem(LAYOUT_STORAGE_KEY);
	if (current) return current;

	for (const key of LEGACY_STORAGE_KEYS) {
		const legacy = localStorage.getItem(key);
		if (legacy) return legacy;
	}

	return null;
}

function migrateAddConsolePanel(config: LayoutConfig): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return next;

	const ids = collectTabIds(next);
	if (ids.has(PANEL_IDS.console)) return next;

	const parentMap = buildNodeParentMap(next.root);
	let migrated = false;

	walkNodes(next.root, (tabGroup) => {
		if (migrated) return;
		if (tabGroup.tabs.length !== 1 || tabGroup.tabs[0] !== PANEL_IDS.logs) return;

		const parent = parentMap.get(tabGroup);
		const consoleGroup: TabGroupConfig = { tabs: [PANEL_IDS.console], activeTabIndex: 0 };
		const split: SplitConfig = {
			direction: 'vertical',
			splitPoints: [0.55],
			views: [tabGroup, consoleGroup]
		};

		if (!parent) {
			next.root = split;
		} else {
			parent.parent.views[parent.index] = split;
		}

		migrated = true;
	});

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

	const parentMap = buildNodeParentMap(next.root);

	function replaceSplit(node: NodeConfig): boolean {
		if (nodeConfigType(node) !== 'split') return false;

		const split = node as SplitConfig;
		if (split.direction === 'vertical' && split.views.length === 2) {
			const logsView = split.views.find(
				(view) =>
					nodeConfigType(view) === 'tabGroup' &&
					(view as TabGroupConfig).tabs.includes(PANEL_IDS.logs)
			);
			const hasConsole = split.views.some(
				(view) =>
					nodeConfigType(view) === 'tabGroup' &&
					(view as TabGroupConfig).tabs.includes(PANEL_IDS.console)
			);

			if (logsView && hasConsole) {
				const parent = parentMap.get(split);
				if (!parent) {
					next.root = logsView;
				} else {
					parent.parent.views[parent.index] = logsView;
				}
				return true;
			}
		}

		for (const child of split.views) {
			if (replaceSplit(child)) return true;
		}

		return false;
	}

	replaceSplit(next.root);
	return next;
}

export function loadSavedLayout(): LayoutConfig | null {
	try {
		const raw = readStoredLayout();
		if (!raw) return null;
		const parsed = parseLayoutConfig(JSON.parse(raw));
		const migrated = migrateAddConsolePanel(migrateLegacyTerminalPanel(parsed));
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
		localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sanitized));
	} catch {
		// Ignore quota / private-mode failures.
	}
}

export function resolveEditorLayout(filePaths: string[]): LayoutConfig {
	return loadSavedLayout() ?? createInitialLayout(filePaths);
}

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
