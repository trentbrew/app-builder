import type { LayoutConfig } from '$lib/editorLayout';
import type { EditorLayoutPresetId } from '$lib/editorLayoutPresets';
import type { EditorRef } from '$lib/actionContext';
import { editorChrome } from '$lib/editorChrome.svelte';

export type SplitDirection = 'left' | 'right' | 'up' | 'down';

type FilePaneHandlers = {
	getEditorRef: () => EditorRef | undefined;
	toggleMarkdownMode: () => void;
	syncToSandbox: () => void;
	copyContent: () => void;
};

type ActionRunnerHandlers = {
	getLayout: () => LayoutConfig | null;
	setLayout: (config: LayoutConfig) => void;
	splitView: (viewId: string, direction: SplitDirection) => void;
	closeFileTab: (viewId: string) => void;
	closeTerminalTab: (viewId: string) => void;
	closeAgentTab: (viewId: string) => void;
	closeSettingsTab: () => void;
	addTerminal: () => void;
	getOpenFiles: () => string[];
	getOpenTerminals: () => string[];
	getActiveFile: () => string;
	selectFile: (path: string, content: string) => void;
	closeFile: (path: string) => void;
	renameFile: (oldPath: string, newPath: string) => void;
	refreshTree: () => void;
	renameFileTab: (viewId: string) => void | Promise<void>;
	renameTerminalTab: (sessionId: string, viewId: string) => void | Promise<void>;
	renameAgentTab: (sessionId: string, viewId: string) => void | Promise<void>;
	/** Create a new named container tab group in this dock. Returns its view id. */
	createTabGroup: () => string | null;
	applyLayoutPreset: (presetId: EditorLayoutPresetId) => boolean;
};

const defaultHandlers: ActionRunnerHandlers = {
	getLayout: () => null,
	setLayout: () => {},
	splitView: () => {},
	closeFileTab: () => {},
	closeTerminalTab: () => {},
	closeAgentTab: () => {},
	closeSettingsTab: () => {},
	addTerminal: () => {},
	getOpenFiles: () => [],
	getOpenTerminals: () => [],
	getActiveFile: () => '/App.svelte',
	selectFile: () => {},
	closeFile: () => {},
	renameFile: () => {},
	refreshTree: () => {},
	renameFileTab: () => {},
	renameTerminalTab: () => {},
	renameAgentTab: () => {},
	createTabGroup: () => null,
	applyLayoutPreset: () => false
};

const ROOT_DOCK_ID = 'root';

type ResolvedDockHandlers = ActionRunnerHandlers & { id: string };

class ActionRunnerState {
	private handlers = { ...defaultHandlers };
	private filePaneHandlers = new Map<string, FilePaneHandlers>();
	private docks = new Map<string, ResolvedDockHandlers>();
	private activeDockId: string = ROOT_DOCK_ID;

	register(next: Partial<ActionRunnerHandlers>) {
		this.handlers = { ...this.handlers, ...next };
	}

	/** Register a dock-scoped handler set (nested docks). */
	registerDock(id: string, handlers: Partial<ActionRunnerHandlers>) {
		this.docks.set(id, { id, ...defaultHandlers, ...handlers });
	}

	unregisterDock(id: string) {
		this.docks.delete(id);
		if (this.activeDockId === id) this.activeDockId = ROOT_DOCK_ID;
	}

	/** Route subsequent actions to the dock under the pointer/keyboard focus. */
	setActiveDock(id: string | null) {
		this.activeDockId = id ?? ROOT_DOCK_ID;
	}

	private dock(): ResolvedDockHandlers {
		return this.docks.get(this.activeDockId) ?? { id: ROOT_DOCK_ID, ...this.handlers };
	}

	registerFilePane(path: string, handlers: FilePaneHandlers) {
		this.filePaneHandlers.set(path, handlers);
	}

	unregisterFilePane(path: string) {
		this.filePaneHandlers.delete(path);
	}

	reset() {
		this.handlers = { ...defaultHandlers };
		this.filePaneHandlers.clear();
	}

	getLayout() {
		return this.dock().getLayout();
	}

	setLayout(config: LayoutConfig) {
		this.dock().setLayout(config);
	}

	splitView(viewId: string, direction: SplitDirection) {
		this.dock().splitView(viewId, direction);
	}

	closeFileTab(viewId: string) {
		this.dock().closeFileTab(viewId);
	}

	closeTerminalTab(viewId: string) {
		this.dock().closeTerminalTab(viewId);
	}

	closeAgentTab(viewId: string) {
		this.dock().closeAgentTab(viewId);
	}

	closeSettingsTab() {
		editorChrome.closeSettings();
	}

	addTerminal() {
		this.dock().addTerminal();
	}

	getOpenFiles() {
		return this.dock().getOpenFiles();
	}

	getOpenTerminals() {
		return this.dock().getOpenTerminals();
	}

	getActiveFile() {
		return this.dock().getActiveFile();
	}

	selectFile(path: string, content: string) {
		this.dock().selectFile(path, content);
	}

	closeFile(path: string) {
		this.dock().closeFile(path);
	}

	renameFile(oldPath: string, newPath: string) {
		this.dock().renameFile(oldPath, newPath);
	}

	refreshTree() {
		this.dock().refreshTree();
	}

	renameFileTab(viewId: string) {
		return this.dock().renameFileTab(viewId);
	}

	renameTerminalTab(sessionId: string, viewId: string) {
		return this.dock().renameTerminalTab(sessionId, viewId);
	}

	renameAgentTab(sessionId: string, viewId: string) {
		return this.dock().renameAgentTab(sessionId, viewId);
	}

	createTabGroup(): string | null {
		return this.dock().createTabGroup();
	}

	applyLayoutPreset(presetId: EditorLayoutPresetId): boolean {
		return this.handlers.applyLayoutPreset(presetId);
	}

	toggleMarkdownMode(path: string) {
		this.filePaneHandlers.get(path)?.toggleMarkdownMode();
	}

	syncFileToSandbox(path: string) {
		this.filePaneHandlers.get(path)?.syncToSandbox();
	}

	copyFileContent(path: string) {
		this.filePaneHandlers.get(path)?.copyContent();
	}

	getEditorRef(path: string) {
		return this.filePaneHandlers.get(path)?.getEditorRef();
	}
}

export const actionRunner = new ActionRunnerState();
