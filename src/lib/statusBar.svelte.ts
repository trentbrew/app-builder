import { browser } from '$app/environment';
import { languageLabelForPath } from '$lib/languageLabel';

export type StatusBarItem = {
	id: string;
	label: string;
	title?: string;
};

const STORAGE_KEY = 'app-builder:status-bar-ui:v1';

type Persisted = {
	visible: boolean;
	hiddenSegments: string[];
};

function loadPersisted(): Persisted {
	if (!browser) return { visible: true, hiddenSegments: [] };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { visible: true, hiddenSegments: [] };
		const parsed = JSON.parse(raw) as Partial<Persisted>;
		return {
			visible: parsed.visible ?? true,
			hiddenSegments: parsed.hiddenSegments ?? []
		};
	} catch {
		return { visible: true, hiddenSegments: [] };
	}
}

function savePersisted(state: Persisted) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// ignore storage failures
	}
}

const persisted = loadPersisted();

export const statusBar = $state({
	visible: persisted.visible,
	hiddenSegments: new Set(persisted.hiddenSegments),
	left: [{ id: 'app', label: 'App Builder' }] as StatusBarItem[],
	right: [{ id: 'encoding', label: 'UTF-8' }] as StatusBarItem[]
});

function persistStatusBarUi() {
	savePersisted({
		visible: statusBar.visible,
		hiddenSegments: [...statusBar.hiddenSegments]
	});
}

export function setStatusBarVisible(visible: boolean) {
	statusBar.visible = visible;
	persistStatusBarUi();
	if (browser) {
		document.documentElement.toggleAttribute('data-status-bar-hidden', !visible);
	}
}

export function toggleStatusBarVisible() {
	setStatusBarVisible(!statusBar.visible);
}

export function isStatusSegmentVisible(id: string) {
	return !statusBar.hiddenSegments.has(id);
}

export function toggleStatusSegment(id: string) {
	const next = new Set(statusBar.hiddenSegments);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	statusBar.hiddenSegments = next;
	persistStatusBarUi();
}

export function visibleStatusItems(items: StatusBarItem[]) {
	return items.filter((item) => isStatusSegmentVisible(item.id));
}

export function setStatusBarLeft(items: StatusBarItem[]) {
	statusBar.left = items;
}

export function setStatusBarRight(items: StatusBarItem[]) {
	statusBar.right = items;
}

export function setEditorStatus(options: {
	activeFile?: string;
	phase?: string;
	booting?: boolean;
	error?: string;
}) {
	const { activeFile, phase, booting, error } = options;

	const left: StatusBarItem[] = [{ id: 'workspace', label: 'svelte-repl' }];

	if (error) {
		left.push({ id: 'error', label: 'Build Error', title: error });
	} else if (booting) {
		left.push({ id: 'boot', label: phase ? `Booting: ${phase}` : 'Booting…' });
	} else {
		left.push({ id: 'ready', label: phase && phase !== 'idle' ? phase : 'Ready' });
	}

	statusBar.left = left;

	if (!activeFile) return;

	const language = languageLabelForPath(activeFile);
	const fileName = activeFile.split('/').filter(Boolean).at(-1) ?? activeFile;

	statusBar.right = [
		{ id: 'file', label: fileName, title: activeFile },
		{ id: 'language', label: language },
		{ id: 'encoding', label: 'UTF-8' },
		{ id: 'eol', label: 'LF' }
	];
}

if (browser && !statusBar.visible) {
	document.documentElement.setAttribute('data-status-bar-hidden', '');
}
