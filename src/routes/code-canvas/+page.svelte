<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteFlow, MiniMap, SelectionMode, Background } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { EditorView } from '@codemirror/view';
	import { browser } from '$app/environment';
	import { codeCanvasState, codeCanvasActions } from './state.svelte';

	import TerminalNode from '$lib/components/nodes/terminal-node.svelte';
	import EditorNode from '$lib/components/nodes/editor-node.svelte';
	import PreviewNode from '$lib/components/nodes/preview-node.svelte';
	import LogsNode from '$lib/components/nodes/logs-node.svelte';

	// Editor reference
	let editorView: EditorView | null = null;

	// Listener for messages from the iframe
	function handleIframeMessage(event: MessageEvent) {
		if (event.data && event.data.type && ['log', 'error', 'warn'].includes(event.data.type)) {
			const message = event.data.args
				.map((arg: any) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
				.join(' ');
			codeCanvasActions.addConsoleMessage(event.data.type, message);
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

	// Handle editor content changes
	function handleEditorChange(content: string) {
		codeCanvasActions.updateEditorContent(content);
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

	const panOnDrag = [1, 2];

	function onmovestart(e: any) {
		console.log('move start', e);
	}

	function onmove(e: any) {
		console.log('move', e);
	}

	function onmoveend(e: any) {
		console.log('move end', e);
	}

	let nodes = $state.raw([
		{
			id: 'editor',
			type: 'editor',
			position: { x: 50, y: 50 },
			width: 600,
			height: 400,
			selected: false,
			data: {
				label: 'Editor',
				content: codeCanvasState.editorContent,
				onChange: handleEditorChange,
				onFileSelect: handleFileSelect,
				onRun: codeCanvasActions.runCode,
				setEditorView
			}
		},
		{
			id: 'preview',
			type: 'preview',
			position: { x: 700, y: 50 },
			width: 400,
			height: 400,
			selected: false,
			data: {
				label: 'Preview',
				url: codeCanvasState.previewUrl,
				onRun: codeCanvasActions.runCode,
				bootStatus: codeCanvasState.bootStatus,
				buildStatus: codeCanvasState.buildStatus,
				lastActivity: codeCanvasState.lastActivity,
				installProgress: codeCanvasState.installProgress,
				webContainerError: codeCanvasState.webContainerError
			}
		},
		{
			id: 'terminal',
			type: 'terminal',
			position: { x: 50, y: 500 },
			width: 500,
			height: 300,
			selected: false,
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
			selected: false,
			data: {
				label: 'Logs',
				logs: codeCanvasState.logs,
				onClearLogs: codeCanvasActions.clearLogs,
				bootStatus: codeCanvasState.bootStatus,
				lastActivity: codeCanvasState.lastActivity
			}
		}
	]);

	let edges = $state.raw([]);

	// Update node data reactively when shared state changes
	$effect(() => {
		// Update editor node
		const editorNode = nodes.find((n) => n.id === 'editor');
		if (editorNode) {
			Object.assign(editorNode.data, {
				content: codeCanvasState.editorContent
			});
		}

		// Update preview node
		const previewNode = nodes.find((n) => n.id === 'preview');
		if (previewNode) {
			Object.assign(previewNode.data, {
				url: codeCanvasState.previewUrl,
				bootStatus: codeCanvasState.bootStatus,
				buildStatus: codeCanvasState.buildStatus,
				lastActivity: codeCanvasState.lastActivity,
				installProgress: codeCanvasState.installProgress,
				webContainerError: codeCanvasState.webContainerError
			});
		}

		// Update logs node
		const logsNode = nodes.find((n) => n.id === 'logs');
		if (logsNode) {
			Object.assign(logsNode.data, {
				logs: codeCanvasState.logs,
				bootStatus: codeCanvasState.bootStatus,
				lastActivity: codeCanvasState.lastActivity
			});
		}
	});

	// Multi-select and keyboard handling
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Meta' || event.key === 'Cmd') {
			codeCanvasState.isMetaPressed = true;
		}

		// Delete selected nodes
		if (event.key === 'Delete' || event.key === 'Backspace') {
			if (codeCanvasState.selectedNodes.size > 0) {
				// Don't actually delete nodes in this demo, just clear selection
				codeCanvasState.selectedNodes.clear();
				// Update nodes to clear selection
				nodes = nodes.map((node) => ({ ...node, selected: false }));
			}
		}

		// Select all with Cmd+A
		if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
			event.preventDefault();
			codeCanvasState.selectedNodes = new Set(nodes.map((n) => n.id));
			nodes = nodes.map((node) => ({ ...node, selected: true }));
		}
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (event.key === 'Meta' || event.key === 'Cmd') {
			codeCanvasState.isMetaPressed = false;
		}
	}

	function handleNodeClick(event: CustomEvent) {
		const { node } = event.detail;

		if (codeCanvasState.isMetaPressed) {
			// Multi-select mode
			if (codeCanvasState.selectedNodes.has(node.id)) {
				codeCanvasState.selectedNodes.delete(node.id);
				node.selected = false;
			} else {
				codeCanvasState.selectedNodes.add(node.id);
				node.selected = true;
			}
		} else {
			// Single select mode
			codeCanvasState.selectedNodes.clear();
			codeCanvasState.selectedNodes.add(node.id);
			// Clear all selections first
			nodes = nodes.map((n) => ({ ...n, selected: false }));
			// Select the clicked node
			const nodeIndex = nodes.findIndex((n) => n.id === node.id);
			if (nodeIndex !== -1) {
				nodes[nodeIndex].selected = true;
			}
		}

		// Trigger reactivity
		nodes = [...nodes];
	}

	function handleSelectionChange(event: CustomEvent) {
		const { nodes: selectedNodesList } = event.detail;
		codeCanvasState.selectedNodes = new Set(selectedNodesList.map((n: any) => n.id));
	}

	function onPaneContextMenu(e: any) {
		e.preventDefault();
		console.log('context menu');
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('message', handleIframeMessage);
			window.addEventListener('keydown', handleKeyDown);
			window.addEventListener('keyup', handleKeyUp);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('message', handleIframeMessage);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		}
	});
</script>

<div class="bg-background h-screen w-full">
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		fitView
		selectionMode={SelectionMode.Partial}
		selectionOnDrag
		panOnScroll
		{panOnDrag}
		{onmovestart}
		{onmove}
		{onmoveend}
	>
		<Background color="var(--color-background)" />
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

	:global(.svelte-flow__minimap) {
		background-color: var(--color-muted);
	}

	:global(.svelte-flow__controls) {
		button {
			background-color: var(--color-background);
			border: 1px solid var(--color-border);
			color: var(--color-foreground);
		}

		button:hover {
			background-color: var(--color-muted);
		}
	}
</style>
