import { browser } from '$app/environment';
import { languageLabelForPath } from '$lib/languageLabel';
import { formatBytes } from '$lib/formatBytes';
import {
	STORAGE_PRESSURE_RATIO,
	storagePersistence,
	storageUsageRatio
} from '$lib/storagePersistence.svelte';
import type { Component } from 'svelte';

export type StatusBarItem = {
	id: string;
	label: string;
	title?: string;
	kind?: 'label' | 'button';
	disabled?: boolean;
	icon?: Component;
	onclick?: () => void;
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

export function setEditorStatusLeft(options: {
	phase?: string;
	booting?: boolean;
	error?: string;
	projectName?: string;
}) {
	const { phase, booting, error, projectName } = options;

	const left: StatusBarItem[] = [{ id: 'workspace', label: projectName ?? 'svelte-repl' }];

	if (error) {
		left.push({ id: 'error', label: 'Build Error', title: error });
	} else if (booting) {
		left.push({ id: 'boot', label: phase ? `Booting: ${phase}` : 'Booting…' });
	} else {
		left.push({ id: 'ready', label: phase && phase !== 'idle' ? phase : 'Ready' });
	}

	statusBar.left = left;
}

/**
 * Quota readout for the editor status bar. Returns null until the browser has given
 * us an estimate, so the segment simply stays absent where the API is unavailable.
 */
export function storageStatusItem(): StatusBarItem | null {
	const { supported, usage, quota, persisted } = storagePersistence;
	if (!supported || usage === null) return null;

	const used = quota === null ? formatBytes(usage) : `${formatBytes(usage)} / ${formatBytes(quota)}`;
	const ratio = storageUsageRatio();
	const pressured = ratio !== null && ratio >= STORAGE_PRESSURE_RATIO;
	const durability = persisted
		? 'Storage is persistent — only you can clear it.'
		: 'Storage is best-effort — the browser may evict projects to reclaim space.';

	return {
		id: 'storage',
		label: pressured ? `${used} · low` : used,
		title: `Browser storage used by your projects. ${durability}`
	};
}

export function editorFileStatusItems(activeFile?: string): StatusBarItem[] {
	if (!activeFile) {
		return [{ id: 'encoding', label: 'UTF-8' }];
	}

	const language = languageLabelForPath(activeFile);
	const fileName = activeFile.split('/').filter(Boolean).at(-1) ?? activeFile;

	return [
		{ id: 'file', label: fileName, title: activeFile },
		{ id: 'language', label: language },
		{ id: 'encoding', label: 'UTF-8' },
		{ id: 'eol', label: 'LF' }
	];
}

/** @deprecated Use setEditorStatusLeft + setStatusBarRight instead */
export function setEditorStatus(options: {
	activeFile?: string;
	phase?: string;
	booting?: boolean;
	error?: string;
}) {
	setEditorStatusLeft(options);
	statusBar.right = editorFileStatusItems(options.activeFile);
}

if (browser && !statusBar.visible) {
	document.documentElement.setAttribute('data-status-bar-hidden', '');
}
