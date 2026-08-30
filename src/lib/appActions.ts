import { goto } from '$app/navigation';
import {
	ACTION_GROUP_ORDER,
	type ActionContext,
	type ActionGroup,
	type ActionTarget,
	type AppAction
} from '$lib/actionContext';
import { actionRunner } from '$lib/actionRunner.svelte';
import { getTabName, setTabName } from '$lib/tabNames.svelte'
import { containers } from '$lib/containerTabs.svelte'
import { appChrome } from '$lib/appChrome.svelte';
import { editorChrome } from '$lib/editorChrome.svelte';
import {
	copyPathToClipboard,
	createFileInDirectory,
	createFolderInDirectory,
	deletePath,
	openFileFromFs,
	renamePath
} from '$lib/fileOps';
import { dirname } from '$lib/fileTreeOps';
import { tabGroupHasMultipleTabs } from '$lib/editorLayout';
import { hasPreviewToggle, isRunnablePath } from '$lib/fileTypes';
import { sandboxStore } from '$lib/sandboxStore';
import { refreshPreviewPosition } from '$lib/previewFrame';
import { fileTreeState } from '$lib/fileTreeState.svelte';
import {
	isStatusSegmentVisible,
	setStatusBarVisible,
	statusBar,
	toggleStatusBarVisible,
	toggleStatusSegment
} from '$lib/statusBar.svelte';
import { toggleAgentPanel } from '$lib/agentHarness/harnessStore.svelte';
import { toast } from '$lib/notify';
import BotIcon from '@lucide/svelte/icons/bot';
import Code2Icon from '@lucide/svelte/icons/code-2';
import CopyIcon from '@lucide/svelte/icons/copy';
import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
import FilePlusIcon from '@lucide/svelte/icons/file-plus';
import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
import PencilIcon from '@lucide/svelte/icons/pencil';
import PlayIcon from '@lucide/svelte/icons/play';
import PuzzleIcon from '@lucide/svelte/icons/puzzle';
import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
import ScissorsIcon from '@lucide/svelte/icons/scissors';
import SettingsIcon from '@lucide/svelte/icons/settings';
import TerminalIcon from '@lucide/svelte/icons/terminal';
import Trash2Icon from '@lucide/svelte/icons/trash-2';
import UndoIcon from '@lucide/svelte/icons/undo-2';
import RedoIcon from '@lucide/svelte/icons/redo-2';
import ClipboardPasteIcon from '@lucide/svelte/icons/clipboard-paste';
import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
import PanelRightIcon from '@lucide/svelte/icons/panel-right';
import PanelTopIcon from '@lucide/svelte/icons/panel-top';
import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom';
import XIcon from '@lucide/svelte/icons/x';
import FileIcon from '@lucide/svelte/icons/file';
import EyeIcon from '@lucide/svelte/icons/eye';
import EyeOffIcon from '@lucide/svelte/icons/eye-off';
import PinIcon from '@lucide/svelte/icons/pin';
import PinOffIcon from '@lucide/svelte/icons/pin-off';

function targetMatches(ctx: ActionContext, kinds: ActionTarget['kind'][]) {
	return kinds.includes(ctx.target.kind);
}

function canSplitView(ctx: ActionContext, viewId: string) {
	const config = ctx.layout.config;
	if (!config) return false;
	return tabGroupHasMultipleTabs(config, viewId);
}

function runEditCommand(command: 'cut' | 'copy' | 'paste', ctx: ActionContext) {
	if (ctx.target.kind !== 'fileEditor') return;
	const ref = ctx.target.editorRef ?? actionRunner.getEditorRef(ctx.target.path);
	if (command === 'cut' && ref?.cut) {
		ref.cut();
		return;
	}
	if (command === 'copy' && ref?.copy) {
		ref.copy();
		return;
	}
	if (command === 'paste' && ref?.paste) {
		ref.paste();
		return;
	}
	document.execCommand(command);
}

const APP_ACTIONS: AppAction[] = [
	{
		id: 'nav.open-editor',
		label: 'Open Editor',
		icon: Code2Icon,
		group: 'Navigation',
		when: (ctx) => targetMatches(ctx, ['global', 'iconRail']),
		run: () => goto('/editor')
	},
	{
		id: 'view.toggle-settings',
		label: 'Toggle Settings',
		icon: SettingsIcon,
		group: 'View',
		when: (ctx) => targetMatches(ctx, ['global', 'pane', 'iconRail', 'statusBar']),
		run: () => editorChrome.toggleSettings()
	},
	{
		id: 'view.toggle-agent',
		label: 'Toggle Agent',
		icon: BotIcon,
		group: 'View',
		when: (ctx) => targetMatches(ctx, ['global', 'pane', 'iconRail', 'statusBar']),
		run: () => toggleAgentPanel()
	},
	{
		id: 'view.toggle-console',
		label: 'Toggle Console',
		icon: TerminalIcon,
		group: 'View',
		when: (ctx) => targetMatches(ctx, ['global', 'pane', 'iconRail', 'statusBar']),
		run: () => editorChrome.toggleConsole()
	},
	{
		id: 'view.toggle-status-bar',
		label: 'Hide Status Bar',
		icon: EyeOffIcon,
		group: 'View',
		when: (ctx) =>
			(ctx.target.kind === 'statusBar' || ctx.target.kind === 'statusBarSegment') && statusBar.visible,
		run: () => setStatusBarVisible(false)
	},
	{
		id: 'view.show-status-bar',
		label: 'Show Status Bar',
		icon: EyeIcon,
		group: 'View',
		when: (ctx) =>
			(ctx.target.kind === 'statusBar' ||
				ctx.target.kind === 'statusBarSegment' ||
				ctx.target.kind === 'iconRail') &&
			!statusBar.visible,
		run: () => setStatusBarVisible(true)
	},
	{
		id: 'view.toggle-status-segment',
		label: 'Toggle Status Segment',
		icon: EyeIcon,
		group: 'View',
		when: (ctx) => ctx.target.kind === 'statusBarSegment',
		run: (ctx) => {
			if (ctx.target.kind !== 'statusBarSegment') return;
			toggleStatusSegment(ctx.target.segmentId);
		}
	},
	{
		id: 'extensions.open-plugins',
		label: 'Open Plugins',
		icon: PuzzleIcon,
		group: 'View',
		when: (ctx) => targetMatches(ctx, ['global', 'iconRail']),
		run: () => appChrome.openPluginsDialog()
	},
	{
		id: 'files.new-file',
		label: 'New File',
		icon: FilePlusIcon,
		group: 'File',
		when: (ctx) =>
			targetMatches(ctx, ['pane', 'treeNode', 'explorer']) &&
			(ctx.target.kind !== 'pane' || ctx.target.paneKind === 'files') &&
			ctx.sandbox.fsReady,
		run: async (ctx) => {
			const fs = sandboxStore.getFs();
			if (!fs) return;
			let parentDir = dirname(actionRunner.getActiveFile());
			if (ctx.target.kind === 'treeNode') {
				parentDir =
					ctx.target.nodeKind === 'directory' ? ctx.target.path : dirname(ctx.target.path);
			}
			const created = await createFileInDirectory(fs, parentDir);
			if (created) {
				await openFileFromFs(fs, created, actionRunner.selectFile.bind(actionRunner));
			}
		}
	},
	{
		id: 'files.new-folder',
		label: 'New Folder',
		icon: FolderPlusIcon,
		group: 'File',
		when: (ctx) =>
			targetMatches(ctx, ['pane', 'treeNode', 'explorer']) &&
			(ctx.target.kind !== 'pane' || ctx.target.paneKind === 'files') &&
			ctx.sandbox.fsReady,
		run: async (ctx) => {
			const fs = sandboxStore.getFs();
			if (!fs) return;
			let parentDir = dirname(actionRunner.getActiveFile());
			if (ctx.target.kind === 'treeNode') {
				parentDir =
					ctx.target.nodeKind === 'directory' ? ctx.target.path : dirname(ctx.target.path);
			}
			await createFolderInDirectory(fs, parentDir);
		}
	},
	{
		id: 'files.refresh-tree',
		label: 'Refresh File Tree',
		icon: RefreshCwIcon,
		group: 'File',
		when: (ctx) =>
			(ctx.target.kind === 'pane' && ctx.target.paneKind === 'files' && ctx.sandbox.fsReady) ||
			(ctx.target.kind === 'treeNode' && ctx.sandbox.fsReady) ||
			(ctx.target.kind === 'explorer' && ctx.sandbox.fsReady),
		run: () => actionRunner.refreshTree()
	},
	{
		id: 'files.pin',
		label: 'Pin',
		icon: PinIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && !fileTreeState.isPinned(ctx.target.path),
		run: (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			fileTreeState.pin(ctx.target.path);
			toast.success('Pinned to top');
		}
	},
	{
		id: 'files.unpin',
		label: 'Unpin',
		icon: PinOffIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && fileTreeState.isPinned(ctx.target.path),
		run: (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			fileTreeState.unpin(ctx.target.path);
		}
	},
	{
		id: 'files.hide',
		label: 'Hide in Explorer',
		icon: EyeOffIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && !fileTreeState.isHidden(ctx.target.path),
		run: (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			fileTreeState.hide(ctx.target.path);
		}
	},
	{
		id: 'files.unhide',
		label: 'Unhide',
		icon: EyeIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && fileTreeState.isHidden(ctx.target.path),
		run: (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			fileTreeState.unhide(ctx.target.path);
		}
	},
	{
		id: 'files.toggle-dotfiles',
		label: 'Show Dotfiles',
		icon: EyeIcon,
		group: 'View',
		when: (ctx) =>
			(ctx.target.kind === 'explorer' ||
				ctx.target.kind === 'treeNode' ||
				(ctx.target.kind === 'pane' && ctx.target.paneKind === 'files')) &&
			!fileTreeState.showDotfiles,
		run: () => fileTreeState.toggleDotfiles()
	},
	{
		id: 'files.hide-dotfiles',
		label: 'Hide Dotfiles',
		icon: EyeOffIcon,
		group: 'View',
		when: (ctx) =>
			(ctx.target.kind === 'explorer' ||
				ctx.target.kind === 'treeNode' ||
				(ctx.target.kind === 'pane' && ctx.target.paneKind === 'files')) &&
			fileTreeState.showDotfiles,
		run: () => fileTreeState.toggleDotfiles()
	},
	{
		id: 'files.open',
		label: 'Open',
		icon: FileIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && ctx.target.nodeKind === 'file' && ctx.sandbox.fsReady,
		run: async (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			const fs = sandboxStore.getFs();
			if (!fs) return;
			await openFileFromFs(fs, ctx.target.path, actionRunner.selectFile.bind(actionRunner));
		}
	},
	{
		id: 'files.rename',
		label: 'Rename',
		icon: PencilIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && ctx.sandbox.fsReady,
		run: async (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			const fs = sandboxStore.getFs();
			if (!fs) return;
			const oldPath = ctx.target.path;
			const newPath = await renamePath(fs, oldPath, ctx.target.nodeKind);
			if (!newPath || newPath === oldPath) return;
			fileTreeState.remapPath(oldPath, newPath);
			if (ctx.target.nodeKind === 'file') {
				actionRunner.renameFile(oldPath, newPath);
			}
		}
	},
	{
		id: 'files.delete',
		label: 'Delete',
		icon: Trash2Icon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'treeNode' && ctx.sandbox.fsReady,
		run: async (ctx) => {
			if (ctx.target.kind !== 'treeNode') return;
			const fs = sandboxStore.getFs();
			if (!fs) return;
			await deletePath(fs, ctx.target.path, ctx.target.nodeKind);
		}
	},
	{
		id: 'files.copy-path',
		label: 'Copy Path',
		icon: CopyIcon,
		group: 'File',
		when: (ctx) =>
			ctx.target.kind === 'treeNode' ||
			ctx.target.kind === 'fileTab' ||
			ctx.target.kind === 'fileEditor',
		run: async (ctx) => {
			const path =
				ctx.target.kind === 'treeNode' || ctx.target.kind === 'fileTab' || ctx.target.kind === 'fileEditor'
					? ctx.target.path
					: '';
			if (path) await copyPathToClipboard(path);
		}
	},
	{
		id: 'files.copy-content',
		label: 'Copy File Contents',
		icon: CopyIcon,
		group: 'File',
		when: (ctx) => ctx.target.kind === 'fileEditor',
		run: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return;
			actionRunner.copyFileContent(ctx.target.path);
		}
	},
	{
		id: 'files.sync-sandbox',
		label: 'Sync to Sandbox',
		icon: PlayIcon,
		group: 'Sandbox',
		when: (ctx) =>
			ctx.target.kind === 'fileEditor' && isRunnablePath(ctx.target.path) && ctx.sandbox.fsReady,
		run: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return;
			actionRunner.syncFileToSandbox(ctx.target.path);
		}
	},
	{
		id: 'files.toggle-markdown-mode',
		label: 'Toggle Markdown Mode',
		icon: Code2Icon,
		group: 'View',
		when: (ctx) =>
			ctx.target.kind === 'fileEditor' && hasPreviewToggle(ctx.target.path),
		run: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return;
			actionRunner.toggleMarkdownMode(ctx.target.path);
		}
	},
	{
		id: 'edit.cut',
		label: 'Cut',
		icon: ScissorsIcon,
		shortcut: '⌘X',
		group: 'Edit',
		when: (ctx) => ctx.target.kind === 'fileEditor',
		run: (ctx) => runEditCommand('cut', ctx)
	},
	{
		id: 'edit.copy',
		label: 'Copy',
		icon: CopyIcon,
		shortcut: '⌘C',
		group: 'Edit',
		when: (ctx) => ctx.target.kind === 'fileEditor',
		run: (ctx) => runEditCommand('copy', ctx)
	},
	{
		id: 'edit.paste',
		label: 'Paste',
		icon: ClipboardPasteIcon,
		shortcut: '⌘V',
		group: 'Edit',
		when: (ctx) => ctx.target.kind === 'fileEditor',
		run: (ctx) => runEditCommand('paste', ctx)
	},
	{
		id: 'edit.undo',
		label: 'Undo',
		icon: UndoIcon,
		shortcut: '⌘Z',
		group: 'Edit',
		when: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return false;
			const ref = ctx.target.editorRef ?? actionRunner.getEditorRef(ctx.target.path);
			return ref?.canUndo?.() ?? false;
		},
		run: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return;
			const ref = ctx.target.editorRef ?? actionRunner.getEditorRef(ctx.target.path);
			ref?.undo();
		}
	},
	{
		id: 'edit.redo',
		label: 'Redo',
		icon: RedoIcon,
		shortcut: '⇧⌘Z',
		group: 'Edit',
		when: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return false;
			const ref = ctx.target.editorRef ?? actionRunner.getEditorRef(ctx.target.path);
			return ref?.canRedo?.() ?? false;
		},
		run: (ctx) => {
			if (ctx.target.kind !== 'fileEditor') return;
			const ref = ctx.target.editorRef ?? actionRunner.getEditorRef(ctx.target.path);
			ref?.redo();
		}
	},
	{
		id: 'layout.split-left',
		label: 'Split Left',
		icon: PanelLeftIcon,
		group: 'Layout',
		when: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			return viewId ? canSplitView(ctx, viewId) : false;
		},
		run: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			if (viewId) actionRunner.splitView(viewId, 'left');
		}
	},
	{
		id: 'layout.split-right',
		label: 'Split Right',
		icon: PanelRightIcon,
		group: 'Layout',
		when: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			return viewId ? canSplitView(ctx, viewId) : false;
		},
		run: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			if (viewId) actionRunner.splitView(viewId, 'right');
		}
	},
	{
		id: 'layout.split-up',
		label: 'Split Up',
		icon: PanelTopIcon,
		group: 'Layout',
		when: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			return viewId ? canSplitView(ctx, viewId) : false;
		},
		run: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			if (viewId) actionRunner.splitView(viewId, 'up');
		}
	},
	{
		id: 'layout.split-down',
		label: 'Split Down',
		icon: PanelBottomIcon,
		group: 'Layout',
		when: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			return viewId ? canSplitView(ctx, viewId) : false;
		},
		run: (ctx) => {
			const viewId = viewIdFromTarget(ctx.target);
			if (viewId) actionRunner.splitView(viewId, 'down');
		}
	},
	{
		id: 'tab.rename',
		label: 'Rename Tab',
		icon: PencilIcon,
		group: 'Layout',
		when: (ctx) =>
			ctx.target.kind === 'fileTab' ||
			ctx.target.kind === 'terminalTab' ||
			ctx.target.kind === 'agentTab' ||
			ctx.target.kind === 'groupTab',
		run: async (ctx) => {
			if (ctx.target.kind === 'fileTab') await actionRunner.renameFileTab(ctx.target.viewId);
			if (ctx.target.kind === 'terminalTab') {
				await actionRunner.renameTerminalTab(ctx.target.sessionId, ctx.target.viewId);
			}
			if (ctx.target.kind === 'agentTab') {
				await actionRunner.renameAgentTab(ctx.target.sessionId, ctx.target.viewId);
			}
			if (ctx.target.kind === 'groupTab') {
				const fallback =
					containers[ctx.target.groupId]?.label ?? 'Group';
				const name = window.prompt('Rename tab', getTabName(ctx.target.viewId) || fallback);
				if (name !== null) setTabName(ctx.target.viewId, name);
			}
		}
	},
	{
		id: 'layout.new-tab-group',
		label: 'New Tab Group',
		icon: FolderPlusIcon,
		group: 'Layout',
		when: (ctx) =>
			ctx.target.kind === 'global' ||
			ctx.target.kind === 'fileTab' ||
			ctx.target.kind === 'pane' ||
			ctx.target.kind === 'groupTab',
		run: () => {
			actionRunner.createTabGroup();
		}
	},

	{
		id: 'tab.close',
		label: 'Close Tab',
		icon: XIcon,
		group: 'Layout',
		when: (ctx) =>
			ctx.target.kind === 'fileTab' ||
			ctx.target.kind === 'terminalTab' ||
			ctx.target.kind === 'agentTab',
		run: (ctx) => {
			if (ctx.target.kind === 'fileTab') actionRunner.closeFileTab(ctx.target.viewId);
			if (ctx.target.kind === 'terminalTab') actionRunner.closeTerminalTab(ctx.target.viewId);
			if (ctx.target.kind === 'agentTab') actionRunner.closeAgentTab(ctx.target.viewId);
		}
	},
	{
		id: 'tab.close-others',
		label: 'Close Other Tabs',
		icon: XIcon,
		group: 'Layout',
		when: (ctx) => ctx.target.kind === 'fileTab' && ctx.layout.openFiles.length > 1,
		run: (ctx) => {
			if (ctx.target.kind !== 'fileTab') return;
			for (const path of ctx.layout.openFiles) {
				if (path !== ctx.target.path) actionRunner.closeFile(path);
			}
		}
	},
	{
		id: 'preview.refresh',
		label: 'Refresh Preview',
		icon: RefreshCwIcon,
		group: 'Sandbox',
		when: (ctx) => ctx.target.kind === 'pane' && ctx.target.paneKind === 'preview',
		run: () => {
			void sandboxStore.boot();
			refreshPreviewPosition();
		}
	},
	{
		id: 'preview.open-external',
		label: 'Open Preview in Browser',
		icon: ExternalLinkIcon,
		group: 'Sandbox',
		when: (ctx) =>
			ctx.target.kind === 'pane' &&
			ctx.target.paneKind === 'preview' &&
			Boolean(ctx.sandbox.previewUrl),
		run: () => {
			let previewUrl = '';
			const unsubscribe = sandboxStore.subscribe((state) => {
				previewUrl = state.previewUrl;
			});
			unsubscribe();
			if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer');
		}
	},
	{
		id: 'preview.copy-url',
		label: 'Copy Preview URL',
		icon: CopyIcon,
		group: 'Sandbox',
		when: (ctx) =>
			ctx.target.kind === 'pane' &&
			ctx.target.paneKind === 'preview' &&
			Boolean(ctx.sandbox.previewUrl),
		run: async (ctx) => {
			if (!ctx.sandbox.previewUrl) return;
			try {
				await navigator.clipboard.writeText(ctx.sandbox.previewUrl);
				toast.success('Copied preview URL');
			} catch {
				toast.error('Could not copy URL');
			}
		}
	},
	{
		id: 'terminal.new',
		label: 'New Terminal',
		icon: TerminalIcon,
		group: 'Terminal',
		when: (ctx) =>
			(ctx.target.kind === 'pane' && ctx.target.paneKind === 'terminal') ||
			ctx.target.kind === 'terminalTab',
		run: () => actionRunner.addTerminal()
	}
];

function viewIdFromTarget(target: ActionTarget): string | null {
	switch (target.kind) {
		case 'fileTab':
		case 'terminalTab':
		case 'agentTab':
			return target.viewId;
		case 'fileEditor':
			return `file:${target.path}`;
		case 'pane':
			return target.paneId;
		default:
			return null;
	}
}

function statusBarSegmentActions(): AppAction[] {
	const items = [
		...statusBar.left.map((item) => ({ ...item, side: 'left' as const })),
		...statusBar.right.map((item) => ({ ...item, side: 'right' as const }))
	];

	return items.map((item) => ({
		id: `status.segment.${item.id}`,
		label: `${isStatusSegmentVisible(item.id) ? 'Hide' : 'Show'} ${item.label}`,
		icon: isStatusSegmentVisible(item.id) ? EyeOffIcon : EyeIcon,
		group: 'View' as const,
		when: (ctx: ActionContext) => ctx.target.kind === 'statusBar',
		run: () => toggleStatusSegment(item.id)
	}));
}

export function actionsForContext(ctx: ActionContext): AppAction[] {
	const base = APP_ACTIONS.filter((action) => (action.when ? action.when(ctx) : true));
	if (ctx.target.kind === 'statusBar') {
		return [...base, ...statusBarSegmentActions().filter((action) => (action.when ? action.when(ctx) : true))];
	}
	if (ctx.target.kind === 'statusBarSegment') {
		const segment = [...statusBar.left, ...statusBar.right].find((item) => item.id === ctx.target.segmentId);
		if (!segment) return base;
		return [
			...base,
			{
				id: `status.segment.${segment.id}`,
				label: `${isStatusSegmentVisible(segment.id) ? 'Hide' : 'Show'} ${segment.label}`,
				icon: isStatusSegmentVisible(segment.id) ? EyeOffIcon : EyeIcon,
				group: 'View',
				run: () => toggleStatusSegment(segment.id)
			}
		];
	}
	return base;
}

export function groupedActionsForContext(
	ctx: ActionContext
): Array<{ group: ActionGroup; actions: AppAction[] }> {
	const actions = actionsForContext(ctx);
	const grouped = new Map<ActionGroup, AppAction[]>();

	for (const action of actions) {
		const list = grouped.get(action.group) ?? [];
		list.push(action);
		grouped.set(action.group, list);
	}

	return ACTION_GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => ({
		group,
		actions: grouped.get(group)!
	}));
}

export function isEditAction(action: AppAction) {
	return action.group === 'Edit';
}

export { APP_ACTIONS };
