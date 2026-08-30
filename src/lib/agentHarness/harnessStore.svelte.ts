import type { ToolLogEntry } from '$lib/agentHarness/types';

export const harnessStore = $state({
	railCollapsed: true,
	railOverlay: false,
	railWidth: 320,
	statusPanelOpen: false,
	toolLogOpen: false,
	lastWritePath: '',
	lastSnapshotId: '',
	hmrMs: null as number | null,
	toolLog: [] as ToolLogEntry[]
});

let writeStartedAt: number | null = null;
let treeGenAtWrite = 0;

const NARROW_MEDIA_QUERY = '(max-width: 1023px)';
const RAIL_WIDTH_KEY = 'app-builder:agent-rail-width:v1';
const RAIL_COLLAPSED_KEY = 'app-builder:agent-rail-collapsed:v1';
const RAIL_WIDTH_MIN = 260;
const RAIL_WIDTH_MAX = 560;

function loadRailWidth(): number {
	if (typeof window === 'undefined') return 320;
	try {
		const raw = localStorage.getItem(RAIL_WIDTH_KEY);
		const value = raw ? Number.parseInt(raw, 10) : 320;
		if (Number.isNaN(value)) return 320;
		return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, value));
	} catch {
		return 320;
	}
}

function persistRailWidth(width: number) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(RAIL_WIDTH_KEY, String(width));
	} catch {
		// ignore
	}
}

function loadRailCollapsed(): boolean {
	if (typeof window === 'undefined') return true;
	try {
		const raw = localStorage.getItem(RAIL_COLLAPSED_KEY);
		if (raw === null) return true;
		return raw === 'true';
	} catch {
		return true;
	}
}

function persistRailCollapsed(collapsed: boolean) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(RAIL_COLLAPSED_KEY, String(collapsed));
	} catch {
		// ignore
	}
}

if (typeof window !== 'undefined') {
	harnessStore.railWidth = loadRailWidth();
	harnessStore.railCollapsed = loadRailCollapsed();
}

export function setAgentRailWidth(width: number) {
	const next = Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(width)));
	harnessStore.railWidth = next;
	persistRailWidth(next);
}

export function toggleHarnessStatusPanel() {
	harnessStore.statusPanelOpen = !harnessStore.statusPanelOpen;
}

export function toggleToolLogPanel() {
	harnessStore.toolLogOpen = !harnessStore.toolLogOpen;
}

function isNarrowViewport() {
	if (typeof window === 'undefined') return false;
	return window.matchMedia(NARROW_MEDIA_QUERY).matches;
}

export function isAgentPanelOpen() {
	return !harnessStore.railCollapsed;
}

export function openAgentPanel() {
	harnessStore.railCollapsed = false;
	persistRailCollapsed(false);
	if (isNarrowViewport()) harnessStore.railOverlay = true;
}

export function closeAgentPanel() {
	harnessStore.railCollapsed = true;
	persistRailCollapsed(true);
	harnessStore.railOverlay = false;
}

export function toggleAgentPanel() {
	if (harnessStore.railCollapsed) {
		openAgentPanel();
	} else {
		closeAgentPanel();
	}
}

/** @deprecated Use toggleAgentPanel */
export function toggleAgentRail() {
	toggleAgentPanel();
}

export function setAgentRailOverlay(open: boolean) {
	harnessStore.railOverlay = open;
}

export function appendToolLog(entry: Omit<ToolLogEntry, 'id' | 'ts'>) {
	const row: ToolLogEntry = {
		...entry,
		id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
		ts: Date.now()
	};
	harnessStore.toolLog = [...harnessStore.toolLog, row].slice(-200);
	return row;
}

export function noteWriteStart(treeGeneration: number) {
	writeStartedAt = Date.now();
	treeGenAtWrite = treeGeneration;
}

export function noteWriteComplete(path: string, snapshotId: string) {
	harnessStore.lastWritePath = path;
	harnessStore.lastSnapshotId = snapshotId;
}

export function noteHmrComplete(treeGeneration: number) {
	if (writeStartedAt === null) return;
	if (treeGeneration <= treeGenAtWrite) return;
	harnessStore.hmrMs = Date.now() - writeStartedAt;
	writeStartedAt = null;
	appendToolLog({
		kind: 'hmr',
		summary: `HMR · ${harnessStore.hmrMs}ms`,
		path: harnessStore.lastWritePath
	});
}
