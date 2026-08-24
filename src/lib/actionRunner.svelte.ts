import type { LayoutConfig } from '$lib/editorLayout';
import type { EditorRef } from '$lib/actionContext';

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
};

const defaultHandlers: ActionRunnerHandlers = {
	getLayout: () => null,
	setLayout: () => {},
	splitView: () => {},
	closeFileTab: () => {},
	closeTerminalTab: () => {},
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
	renameTerminalTab: () => {}
};

class ActionRunnerState {
	private handlers = { ...defaultHandlers };
	private filePaneHandlers = new Map<string, FilePaneHandlers>();

	register(next: Partial<ActionRunnerHandlers>) {
		this.handlers = { ...this.handlers, ...next };
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
		return this.handlers.getLayout();
	}

	setLayout(config: LayoutConfig) {
		this.handlers.setLayout(config);
	}

	splitView(viewId: string, direction: SplitDirection) {
		this.handlers.splitView(viewId, direction);
	}

	closeFileTab(viewId: string) {
		this.handlers.closeFileTab(viewId);
	}

	closeTerminalTab(viewId: string) {
		this.handlers.closeTerminalTab(viewId);
	}

	closeSettingsTab() {
		this.handlers.closeSettingsTab();
	}

	addTerminal() {
		this.handlers.addTerminal();
	}

	getOpenFiles() {
		return this.handlers.getOpenFiles();
	}

	getOpenTerminals() {
		return this.handlers.getOpenTerminals();
	}

	getActiveFile() {
		return this.handlers.getActiveFile();
	}

	selectFile(path: string, content: string) {
		this.handlers.selectFile(path, content);
	}

	closeFile(path: string) {
		this.handlers.closeFile(path);
	}

	renameFile(oldPath: string, newPath: string) {
		this.handlers.renameFile(oldPath, newPath);
	}

	refreshTree() {
		this.handlers.refreshTree();
	}

	renameFileTab(viewId: string) {
		return this.handlers.renameFileTab(viewId);
	}

	renameTerminalTab(sessionId: string, viewId: string) {
		return this.handlers.renameTerminalTab(sessionId, viewId);
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
