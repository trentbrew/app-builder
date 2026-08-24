import type { LayoutConfig } from 'horizon-layout';
import type { Component } from 'svelte';
import type { MarkdownEditorRef } from '$lib/components/markdown-editor.svelte';

export type PaneKind =
	| 'files'
	| 'preview'
	| 'terminal'
	| 'logs'
	| 'console'
	| 'chat'
	| 'settings';

export type EditorRef = MarkdownEditorRef & {
	cut?: () => void;
	copy?: () => void;
	paste?: () => void;
};

export type ActionTarget =
	| { kind: 'global' }
	| { kind: 'iconRail' }
	| { kind: 'statusBar' }
	| { kind: 'statusBarSegment'; segmentId: string; side: 'left' | 'right' }
	| { kind: 'explorer' }
	| { kind: 'pane'; paneId: string; paneKind: PaneKind }
	| { kind: 'fileTab'; path: string; viewId: string }
	| { kind: 'terminalTab'; sessionId: string; viewId: string }
	| { kind: 'treeNode'; path: string; nodeKind: 'file' | 'directory' }
	| { kind: 'fileEditor'; path: string; editorRef?: EditorRef; canSplit?: boolean };

export type LayoutSnapshot = {
	config: LayoutConfig | null;
	openFiles: string[];
	openTerminals: string[];
	activeFile: string;
};

export type SandboxSnapshot = {
	fsReady: boolean;
	backend: 'bun' | 'webcontainer' | null;
	previewUrl: string | null;
};

export type ActionContext = {
	target: ActionTarget;
	layout: LayoutSnapshot;
	sandbox: SandboxSnapshot;
};

export type ActionGroup = 'Navigation' | 'File' | 'Edit' | 'View' | 'Terminal' | 'Sandbox' | 'System';
export const ACTION_GROUP_ORDER: ActionGroup[] = ['Navigation', 'File', 'Edit', 'View', 'Terminal', 'Sandbox', 'System'];

export type AppAction = {
	id: string;
	label: string;
	icon?: Component<any> | any;
	group: ActionGroup | string;
	when?: (ctx: ActionContext) => boolean;
	run: (ctx: ActionContext) => void | Promise<void>;
	shortcut?: string[];
};

export function emptyLayoutSnapshot(): LayoutSnapshot {
	return {
		config: null,
		openFiles: [],
		openTerminals: [],
		activeFile: ''
	};
}

export function emptySandboxSnapshot(): SandboxSnapshot {
	return {
		fsReady: false,
		backend: null,
		previewUrl: null
	};
}