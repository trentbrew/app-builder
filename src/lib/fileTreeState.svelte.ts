import { browser } from '$app/environment';
import { fileTreeStorageKey, getActiveEditorScopeId } from '$lib/projects/projectScope';

export type TreeExpandMode = 'default' | 'expanded' | 'collapsed';

const LEGACY_STORAGE_KEY = 'app-builder:file-tree-ui:v1';

function storageKey(): string {
	const projectId = getActiveEditorScopeId();
	return projectId ? fileTreeStorageKey(projectId) : LEGACY_STORAGE_KEY;
}

type Persisted = {
	pinned: string[];
	hidden: string[];
	showDotfiles: boolean;
	terminalTitles: Record<string, string>;
};

function loadPersisted(): Persisted {
	if (!browser) {
		return { pinned: [], hidden: [], showDotfiles: false, terminalTitles: {} };
	}
	try {
		const raw = localStorage.getItem(storageKey());
		if (!raw) return { pinned: [], hidden: [], showDotfiles: false, terminalTitles: {} };
		const parsed = JSON.parse(raw) as Partial<Persisted>;
		return {
			pinned: parsed.pinned ?? [],
			hidden: parsed.hidden ?? [],
			showDotfiles: parsed.showDotfiles ?? false,
			terminalTitles: parsed.terminalTitles ?? {}
		};
	} catch {
		return { pinned: [], hidden: [], showDotfiles: false, terminalTitles: {} };
	}
}

function savePersisted(state: Persisted) {
	if (!browser) return;
	try {
		localStorage.setItem(storageKey(), JSON.stringify(state));
	} catch {
		// ignore storage failures
	}
}

const persisted = loadPersisted();

class FileTreeState {
	mode = $state<TreeExpandMode>('default');
	pinnedPaths = $state<Set<string>>(new Set(persisted.pinned));
	hiddenPaths = $state<Set<string>>(new Set(persisted.hidden));
	showDotfiles = $state(persisted.showDotfiles);
	terminalTitles = $state<Record<string, string>>({ ...persisted.terminalTitles });
	expandedPaths = $state<Set<string>>(new Set());
	focusedPath = $state<string | null>(null);
	dropTargetPath = $state<string | null>(null);

	private persist() {
		savePersisted({
			pinned: [...this.pinnedPaths],
			hidden: [...this.hiddenPaths],
			showDotfiles: this.showDotfiles,
			terminalTitles: { ...this.terminalTitles }
		});
	}

	expandAll() {
		this.mode = 'expanded';
	}

	collapseAll() {
		this.mode = 'collapsed';
	}

	reset() {
		this.mode = 'default';
	}

	isPinned(path: string) {
		return this.pinnedPaths.has(path);
	}

	isHidden(path: string) {
		return this.hiddenPaths.has(path);
	}

	isExpanded(path: string) {
		if (this.mode === 'expanded') return true;
		if (this.mode === 'collapsed') return false;
		return this.expandedPaths.has(path);
	}

	setExpanded(path: string, open: boolean) {
		const next = new Set(this.expandedPaths);
		if (open) next.add(path);
		else next.delete(path);
		this.expandedPaths = next;
		if (this.mode !== 'default') this.reset();
	}

	toggleExpanded(path: string) {
		this.setExpanded(path, !this.isExpanded(path));
	}

	pin(path: string) {
		const nextPinned = new Set(this.pinnedPaths);
		nextPinned.add(path);
		this.pinnedPaths = nextPinned;
		const nextHidden = new Set(this.hiddenPaths);
		nextHidden.delete(path);
		this.hiddenPaths = nextHidden;
		this.persist();
	}

	unpin(path: string) {
		const next = new Set(this.pinnedPaths);
		next.delete(path);
		this.pinnedPaths = next;
		this.persist();
	}

	hide(path: string) {
		const nextHidden = new Set(this.hiddenPaths);
		nextHidden.add(path);
		this.hiddenPaths = nextHidden;
		const nextPinned = new Set(this.pinnedPaths);
		nextPinned.delete(path);
		this.pinnedPaths = nextPinned;
		this.persist();
	}

	unhide(path: string) {
		const next = new Set(this.hiddenPaths);
		next.delete(path);
		this.hiddenPaths = next;
		this.persist();
	}

	toggleDotfiles() {
		this.showDotfiles = !this.showDotfiles;
		this.persist();
	}

	setTerminalTitle(sessionId: string, title: string) {
		this.terminalTitles = { ...this.terminalTitles, [sessionId]: title };
		this.persist();
	}

	getTerminalTitle(sessionId: string, fallback: string) {
		return this.terminalTitles[sessionId]?.trim() || fallback;
	}

	setFocusedPath(path: string | null) {
		this.focusedPath = path;
	}

	setDropTarget(path: string | null) {
		this.dropTargetPath = path;
	}

	remapPath(oldPath: string, newPath: string) {
		const remapSet = (paths: Set<string>) => {
			const next = new Set<string>();
			for (const path of paths) {
				if (path === oldPath) next.add(newPath);
				else if (path.startsWith(`${oldPath}/`)) next.add(`${newPath}${path.slice(oldPath.length)}`);
				else next.add(path);
			}
			return next;
		};

		this.pinnedPaths = remapSet(this.pinnedPaths);
		this.hiddenPaths = remapSet(this.hiddenPaths);
		this.persist();
	}

	reloadFromProjectScope() {
		const next = loadPersisted();
		this.pinnedPaths = new Set(next.pinned);
		this.hiddenPaths = new Set(next.hidden);
		this.showDotfiles = next.showDotfiles;
		this.terminalTitles = { ...next.terminalTitles };
		this.expandedPaths = new Set();
		this.focusedPath = null;
		this.dropTargetPath = null;
		this.mode = 'default';
	}
}

export const fileTreeState = new FileTreeState();
