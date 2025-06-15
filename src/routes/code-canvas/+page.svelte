<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteFlow, MiniMap } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { webcontainerStore } from '$lib/webcontainerStore';
	import { EditorState } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		foldGutter,
		indentOnInput,
		language
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { html } from '@codemirror/lang-html';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { initialCode } from '$lib/initialCode';
	import { browser } from '$app/environment';

	import TerminalNode from '$lib/components/nodes/terminal-node.svelte';
	import EditorNode from '$lib/components/nodes/editor-node.svelte';
	import PreviewNode from '$lib/components/nodes/preview-node.svelte';
	import LogsNode from '$lib/components/nodes/logs-node.svelte';

	// Shared state for all nodes
	let editorView: EditorView | null = null;
	let loading = true;
	let error = '';
	let previewUrl = '';
	let logs: string[] = [];
	let userScrolledUp = false;
	let listenerAttached = false;

	// Subscribe to the store for loading, error, previewUrl, and logs
	const unsubscribe = webcontainerStore.subscribe((state) => {
		loading = state.loading;
		error = state.error;
		previewUrl = state.previewUrl;
		logs = state.logs;
	});

	// Listener for messages from the iframe
	function handleIframeMessage(event: MessageEvent) {
		if (event.data && event.data.type && ['log', 'error', 'warn'].includes(event.data.type)) {
			const prefix = `[iframe-${event.data.type}]`;
			const message = event.data.args
				.map((arg: any) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
				.join(' ');
			logs = [...logs, `${prefix} ${message}`];
		}
	}

	// Function to handle file selection from FileExplorer
	function handleFileSelect(path: string, content: string) {
		if (editorView) {
			const transaction = editorView.state.update({
				changes: { from: 0, to: editorView.state.doc.length, insert: content }
			});
			editorView.dispatch(transaction);
			console.log(`Loaded ${path} into editor.`);
		}
	}

	// Run on demand instead of hot‑reload on every keystroke
	async function handleRun() {
		if (editorView) {
			const code = editorView.state.doc.toString();
			await webcontainerStore.write('/App.svelte', code);
		}
	}

	// Clear logs function
	function handleClearLogs() {
		logs = [];
	}

	// Function to receive editorView from child
	function setEditorView(view: EditorView) {
		editorView = view;
	}

	// Node types with props
	const nodeTypes = {
		editor: EditorNode,
		preview: PreviewNode,
		terminal: TerminalNode,
		logs: LogsNode
	};

	let nodes = $state.raw([
		{
			id: 'editor',
			type: 'editor',
			position: { x: 50, y: 50 },
			width: 600,
			height: 400,
			data: {
				label: 'Editor',
				onFileSelect: handleFileSelect,
				onRun: handleRun,
				initialCode,
				setEditorView
			}
		},
		{
			id: 'preview',
			type: 'preview',
			position: { x: 700, y: 50 },
			width: 400,
			height: 400,
			data: {
				label: 'Preview',
				loading,
				error,
				previewUrl
			}
		},
		{
			id: 'terminal',
			type: 'terminal',
			position: { x: 50, y: 500 },
			width: 500,
			height: 300,
			data: {
				label: 'Terminal'
			}
		},
		{
			id: 'logs',
			type: 'logs',
			position: { x: 600, y: 500 },
			width: 500,
			height: 300,
			data: {
				label: 'Logs',
				logs,
				onClearLogs: handleClearLogs
			}
		}
	]);

	let edges = $state.raw([]);

	// Update node data reactively when state changes
	$effect(() => {
		// Update preview node data
		const previewNode = nodes.find((n) => n.id === 'preview');
		if (previewNode) {
			previewNode.data.loading = loading;
			previewNode.data.error = error;
			previewNode.data.previewUrl = previewUrl;
		}

		// Update logs node data
		const logsNode = nodes.find((n) => n.id === 'logs');
		if (logsNode) {
			logsNode.data.logs = logs;
		}
	});

	onMount(() => {
		if (browser) window.addEventListener('message', handleIframeMessage);
	});

	onDestroy(() => {
		unsubscribe();
		if (browser) window.removeEventListener('message', handleIframeMessage);
	});
</script>

<div class="bg-background h-screen w-full">
	<SvelteFlow
		{nodes}
		{edges}
		{nodeTypes}
		fitView
		class="bg-background"
		nodesDraggable={true}
		nodesConnectable={false}
		elementsSelectable={true}
	>
		<MiniMap
			nodeColor="var(--color-primary)"
			nodeStrokeColor="var(--color-border)"
			nodeBorderRadius={2}
		/>
	</SvelteFlow>
</div>

<style>
	/* Dark theme for SvelteFlow */
	:global(.svelte-flow) {
		background-color: var(--color-background);
	}

	:global(.svelte-flow__pane) {
		background-color: var(--color-background);
	}

	:global(.svelte-flow__minimap) {
		background-color: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: calc(var(--radius) - 2px);
	}

	:global(.svelte-flow__controls) {
		background-color: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}

	:global(.svelte-flow__controls button) {
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		color: var(--color-foreground);
	}

	:global(.svelte-flow__controls button:hover) {
		background-color: var(--color-accent);
	}

	:global(.svelte-flow__attribution) {
		background-color: var(--color-card);
		color: var(--color-muted-foreground);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}
</style>
