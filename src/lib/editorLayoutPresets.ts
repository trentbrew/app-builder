import { nodeConfigType, type LayoutConfig, type NodeConfig, type SplitConfig, type TabGroupConfig } from 'horizon-layout';

export type EditorLayoutPresetId = 'classic' | 'agent-focus';

const PANEL_IDS = {
	files: 'panel:files',
	preview: 'panel:preview',
	logs: 'panel:logs',
	console: 'panel:console'
} as const;

const FILE_VIEW_PREFIX = 'file:';
const TERMINAL_VIEW_PREFIX = 'terminal:';
const AGENT_VIEW_PREFIX = 'agent:';

function fileViewId(path: string): string {
	return `${FILE_VIEW_PREFIX}${path}`;
}

function terminalViewId(sessionId: string): string {
	return `${TERMINAL_VIEW_PREFIX}${sessionId}`;
}

function agentViewId(sessionId: string): string {
	return `${AGENT_VIEW_PREFIX}${sessionId}`;
}

function createTerminalSessionId(): string {
	return crypto.randomUUID();
}

function createAgentSessionId(): string {
	return crypto.randomUUID();
}

function isAgentViewId(id: string): boolean {
	return id.startsWith(AGENT_VIEW_PREFIX);
}

function isFileViewId(id: string): boolean {
	return id.startsWith(FILE_VIEW_PREFIX);
}

function isTerminalViewId(id: string): boolean {
	return id.startsWith(TERMINAL_VIEW_PREFIX);
}

function walkTabGroups(node: NodeConfig | undefined, visit: (tabGroup: TabGroupConfig) => void) {
	if (!node) return;
	if (nodeConfigType(node) === 'tabGroup') {
		visit(node);
		return;
	}
	for (const child of node.views) walkTabGroups(child, visit);
}

function collectFilePaths(config: LayoutConfig): string[] {
	const paths = new Set<string>();
	walkTabGroups(config.root, (tabGroup) => {
		for (const tabId of tabGroup.tabs) {
			if (isFileViewId(tabId)) paths.add(tabId.slice(FILE_VIEW_PREFIX.length));
		}
	});
	return [...paths];
}

function collectTerminalSessionIds(config: LayoutConfig): string[] {
	const ids: string[] = [];
	walkTabGroups(config.root, (tabGroup) => {
		for (const tabId of tabGroup.tabs) {
			if (isTerminalViewId(tabId)) ids.push(tabId.slice(TERMINAL_VIEW_PREFIX.length));
		}
	});
	return ids;
}

function collectAgentSessionIds(config: LayoutConfig): string[] {
	const ids: string[] = [];
	walkTabGroups(config.root, (tabGroup) => {
		for (const tabId of tabGroup.tabs) {
			if (isAgentViewId(tabId)) ids.push(tabId.slice(AGENT_VIEW_PREFIX.length));
		}
	});
	return ids;
}

function isConsolePanelVisible(config: LayoutConfig): boolean {
	let visible = false;
	walkTabGroups(config.root, (tabGroup) => {
		if (tabGroup.tabs.includes(PANEL_IDS.console)) visible = true;
	});
	return visible;
}

export type ApplyLayoutPresetOptions = {
	includeAgent?: boolean;
	includeConsole?: boolean;
	filePaths?: string[];
	terminalSessionIds?: string[];
	agentSessionIds?: string[];
};

function buildBottomBand(
	terminalSessionId: string,
	includeConsole: boolean
): SplitConfig {
	const terminalTabs = [terminalViewId(terminalSessionId)] as [string, ...string[]];

	if (includeConsole) {
		return {
			direction: 'horizontal',
			splitPoints: [1 / 3, 2 / 3],
			views: [
				{ tabs: terminalTabs, activeTabIndex: 0 },
				{ tabs: [PANEL_IDS.logs], activeTabIndex: 0, locked: true },
				{ tabs: [PANEL_IDS.console], activeTabIndex: 0, locked: true }
			]
		};
	}

	return {
		direction: 'horizontal',
		splitPoints: [0.5],
		views: [
			{ tabs: terminalTabs, activeTabIndex: 0 },
			{ tabs: [PANEL_IDS.logs], activeTabIndex: 0, locked: true }
		]
	};
}

function buildClassicLayout(
	filePaths: string[],
	terminalSessionId: string,
	includeConsole: boolean
): LayoutConfig {
	const fileTabs = (filePaths.length ? filePaths : ['/App.svelte']).map(
		fileViewId
	) as [string, ...string[]];

	return {
		root: {
			direction: 'vertical',
			splitPoints: [0.68],
			views: [
				{
					direction: 'horizontal',
					splitPoints: [0.18, 0.5],
					views: [
						{ tabs: [PANEL_IDS.files], activeTabIndex: 0, locked: true },
						{ tabs: fileTabs, activeTabIndex: Math.max(0, fileTabs.length - 1) },
						{ tabs: [PANEL_IDS.preview], activeTabIndex: 0, locked: true }
					]
				},
				buildBottomBand(terminalSessionId, includeConsole)
			]
		}
	};
}

function buildAgentFocusLayout(
	filePaths: string[],
	terminalSessionId: string,
	agentSessionId: string,
	includeAgent: boolean,
	includeConsole: boolean
): LayoutConfig {
	const fileTabs = (filePaths.length ? filePaths : ['/App.svelte']).map(
		fileViewId
	) as [string, ...string[]];
	const editorTabs = [...fileTabs, PANEL_IDS.preview] as [string, ...string[]];

	const centerWorkspace: SplitConfig = {
		direction: 'vertical',
		splitPoints: [0.68],
		views: [
			{ tabs: editorTabs, activeTabIndex: Math.max(0, fileTabs.length - 1) },
			buildBottomBand(terminalSessionId, includeConsole)
		]
	};

	const rootViews: NodeConfig[] = [];
	const splitPoints: number[] = [];

	if (includeAgent) {
		rootViews.push({ tabs: [agentViewId(agentSessionId)], activeTabIndex: 0, locked: true });
		splitPoints.push(0.22);
	}

	rootViews.push(centerWorkspace);
	splitPoints.push(includeAgent ? 0.78 : 0.8);
	rootViews.push({ tabs: [PANEL_IDS.files], activeTabIndex: 0, locked: true });

	return {
		root: {
			direction: 'horizontal',
			splitPoints,
			views: rootViews as [NodeConfig, NodeConfig, ...NodeConfig[]]
		}
	};
}

export function createLayoutFromPreset(
	presetId: EditorLayoutPresetId,
	options: ApplyLayoutPresetOptions = {}
): LayoutConfig {
	const filePaths = options.filePaths?.length ? options.filePaths : ['/App.svelte'];
	const terminalSessionId = options.terminalSessionIds?.[0] ?? createTerminalSessionId();
	const agentSessionId = options.agentSessionIds?.[0] ?? createAgentSessionId();
	const includeConsole = options.includeConsole ?? true;
	const includeAgent = options.includeAgent ?? presetId === 'agent-focus';

	if (presetId === 'agent-focus') {
		return buildAgentFocusLayout(
			filePaths,
			terminalSessionId,
			agentSessionId,
			includeAgent,
			includeConsole
		);
	}

	return buildClassicLayout(filePaths, terminalSessionId, includeConsole);
}

export function inferLayoutPreset(config: LayoutConfig): EditorLayoutPresetId {
	if (!config.root || nodeConfigType(config.root) !== 'split') return 'classic';

	const root = config.root as SplitConfig;
	if (root.direction !== 'horizontal' || root.views.length < 2) return 'classic';

	const lastView = root.views[root.views.length - 1];
	const hasFilesOnRight =
		nodeConfigType(lastView) === 'tabGroup' &&
		(lastView as TabGroupConfig).tabs.includes(PANEL_IDS.files);

	if (!hasFilesOnRight) return 'classic';

	const firstView = root.views[0];
	const hasAgentOnLeft =
		nodeConfigType(firstView) === 'tabGroup' &&
		(firstView as TabGroupConfig).tabs.some(
			(tabId) => isAgentViewId(tabId) || tabId === PANEL_IDS.agent
		);

	const centerIndex = hasAgentOnLeft ? 1 : 0;
	const centerView = root.views[centerIndex];
	const hasVerticalCenter =
		nodeConfigType(centerView) === 'split' &&
		(centerView as SplitConfig).direction === 'vertical';

	if (hasVerticalCenter) return 'agent-focus';

	return 'classic';
}

export function applyLayoutPreset(
	config: LayoutConfig,
	presetId: EditorLayoutPresetId,
	options: ApplyLayoutPresetOptions = {}
): LayoutConfig {
	const filePaths = options.filePaths ?? collectFilePaths(config);
	const terminalIds = options.terminalSessionIds ?? collectTerminalSessionIds(config);
	const agentIds = options.agentSessionIds ?? collectAgentSessionIds(config);
	const includeConsole = options.includeConsole ?? isConsolePanelVisible(config);
	const includeAgent =
		options.includeAgent ??
		(presetId === 'agent-focus' ? agentIds.length > 0 || inferLayoutPreset(config) === 'agent-focus' : agentIds.length > 0);

	let next = createLayoutFromPreset(presetId, {
		filePaths: filePaths.length ? filePaths : ['/App.svelte'],
		terminalSessionIds: terminalIds.length ? terminalIds : undefined,
		agentSessionIds: agentIds.length ? agentIds : undefined,
		includeAgent,
		includeConsole
	});

	for (let index = 1; index < terminalIds.length; index++) {
		const sessionId = terminalIds[index];
		if (!sessionId) continue;
		next = addExtraTerminal(next, sessionId);
	}

	for (let index = 1; index < agentIds.length; index++) {
		const sessionId = agentIds[index];
		if (!sessionId) continue;
		next = addExtraAgent(next, sessionId);
	}

	return next;
}

function addExtraTerminal(config: LayoutConfig, sessionId: string): LayoutConfig {
	const id = terminalViewId(sessionId);
	if (!config.root) return config;

	let target: TabGroupConfig | null = null;
	walkTabGroups(config.root, (tabGroup) => {
		if (target) return;
		if (tabGroup.tabs.some((tabId) => tabId.startsWith('terminal:'))) target = tabGroup;
	});

	if (!target || target.tabs.includes(id)) return config;

	target.tabs = [...target.tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return config;
}

function addExtraAgent(config: LayoutConfig, sessionId: string): LayoutConfig {
	const id = agentViewId(sessionId);
	if (!config.root) return config;

	let target: TabGroupConfig | null = null;
	walkTabGroups(config.root, (tabGroup) => {
		if (target) return;
		if (tabGroup.tabs.some(isAgentViewId)) target = tabGroup;
	});

	if (!target || target.tabs.includes(id)) return config;

	target.tabs = [...target.tabs, id] as typeof target.tabs;
	target.activeTabIndex = target.tabs.length - 1;
	return config;
}
