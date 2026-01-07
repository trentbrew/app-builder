<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		SvelteFlow,
		MiniMap,
		SelectionMode,
		Background,
		type SvelteFlowStore
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { EditorView } from '@codemirror/view';
	import { browser } from '$app/environment';
	import { codeCanvasState, codeCanvasActions } from './state.svelte';

	import TerminalNode from '$lib/components/nodes/terminal-node.svelte';
	import EditorNode from '$lib/components/nodes/editor-node.svelte';
	import PreviewNode from '$lib/components/nodes/preview-node.svelte';
	import LogsNode from '$lib/components/nodes/logs-node.svelte';
	import FileExplorerNode from '$lib/components/nodes/file-explorer-node.svelte';
	import MotionCanvasNode from '$lib/components/nodes/motion-canvas-node.svelte';
	import SceneEditorNode from '$lib/components/nodes/scene-editor-node.svelte';

	// Editor reference
	let editorView: EditorView | null = null;

	// SvelteFlow instance and viewport state
	let svelteFlowComponent: any = $state(null);
	let originalViewport: { x: number; y: number; zoom: number } | null = null;
	let maximizedNodeId: string | null = null;

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
		logs: LogsNode,
		fileExplorer: FileExplorerNode,
		motionCanvas: MotionCanvasNode,
		sceneEditor: SceneEditorNode
	} as any;

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

	let nodes: any = $state.raw([
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
				setEditorView,
				onResize: (width: number, height: number) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'editor');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = width;
						nodes[nodeIndex].height = height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('editor', isMaximized)
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
				webContainerError: codeCanvasState.webContainerError,
				onResize: (width: number, height: number) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'preview');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = width;
						nodes[nodeIndex].height = height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('preview', isMaximized)
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
				label: 'Terminal',
				onResize: (width: number, height: number) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'terminal');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = width;
						nodes[nodeIndex].height = height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('terminal', isMaximized)
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
				lastActivity: codeCanvasState.lastActivity,
				onResize: (width: number, height: number) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'logs');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = width;
						nodes[nodeIndex].height = height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('logs', isMaximized)
			}
		},
		{
			id: 'fileExplorer',
			type: 'fileExplorer',
			position: { x: 1150, y: 50 },
			width: 500,
			height: 600,
			selected: false,
			data: {
				label: 'File Explorer',
				onResize: (size: { width: number; height: number }) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'fileExplorer');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = size.width;
						nodes[nodeIndex].height = size.height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('fileExplorer', isMaximized)
			}
		},
		{
			id: 'motionCanvas',
			type: 'motionCanvas',
			position: { x: 1150, y: 700 },
			width: 500,
			height: 400,
			selected: false,
			data: {
				label: 'Motion Canvas',
				sceneCode: '',
				onResize: (width: number, height: number) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'motionCanvas');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = width;
						nodes[nodeIndex].height = height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('motionCanvas', isMaximized)
			}
		},
		{
			id: 'sceneEditor',
			type: 'sceneEditor',
			position: { x: 600, y: 700 },
			width: 500,
			height: 400,
			selected: false,
			data: {
				label: 'Scene Editor',
				onResize: (width: number, height: number) => {
					const nodeIndex = nodes.findIndex((n) => n.id === 'sceneEditor');
					if (nodeIndex !== -1) {
						nodes[nodeIndex].width = width;
						nodes[nodeIndex].height = height;
					}
				},
				onMaximize: (isMaximized: boolean) => handleNodeMaximize('sceneEditor', isMaximized),
				onSceneCodeChange: (code: string) => {
					// Update the Motion Canvas node with the new scene code
					const motionCanvasNode = nodes.find((n) => n.id === 'motionCanvas');
					if (motionCanvasNode) {
						motionCanvasNode.data.sceneCode = code;
					}
				}
			}
		}
	]);

	let edges = $state.raw([
		{
			id: 'scene-editor-to-motion-canvas',
			source: 'sceneEditor',
			target: 'motionCanvas',
			sourceHandle: 'scene-code-output',
			targetHandle: 'scene-code-input',
			type: 'smoothstep',
			animated: true,
			style: 'stroke: #3b82f6; stroke-width: 2px;'
		}
	]);

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

		// Activate content for clicked node, deactivate others
		nodes = nodes.map((n) => ({
			...n,
			data: { ...n.data, isActiveContent: n.id === node.id }
		}));
	}

	function handleSelectionChange(event: CustomEvent) {
		const { nodes: selectedNodesList } = event.detail;
		codeCanvasState.selectedNodes = new Set(selectedNodesList.map((n: any) => n.id));
	}

	function onPaneContextMenu(e: any) {
		e.preventDefault();
		console.log('context menu');
	}

	// Prevent browser zoom (Cmd/Ctrl + scroll) when over the flow container
	function preventBrowserZoom(e: WheelEvent) {
		if ((e.ctrlKey || e.metaKey) && (e as any).deltaY) {
			e.preventDefault();
		}
	}

	// Function to handle node maximize/restore with zoom
	function handleNodeMaximize(nodeId: string, isMaximized: boolean) {
		if (!svelteFlowComponent) return;

		if (isMaximized) {
			// Store current viewport state
			const currentViewport = svelteFlowComponent.getViewport();
			originalViewport = currentViewport;
			maximizedNodeId = nodeId;

			// Find the node
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			// Get viewport dimensions
			const container = document.querySelector('.svelte-flow');
			if (!container) return;

			const viewportWidth = container.clientWidth;
			const viewportHeight = container.clientHeight;

			// Calculate zoom to fit the node nicely in viewport
			const padding = 40; // padding around the node
			const targetWidth = viewportWidth - padding * 2;
			const targetHeight = viewportHeight - padding * 2;

			// Calculate zoom level
			const zoomX = targetWidth / (node.width || 400);
			const zoomY = targetHeight / (node.height || 300);
			const zoom = Math.min(zoomX, zoomY, 2.0); // Allow up to 2x zoom

			// Calculate center position for the node
			const centerX = viewportWidth / 2;
			const centerY = viewportHeight / 2;

			// Calculate the position to center the node
			const nodeX = node.position.x + (node.width || 400) / 2;
			const nodeY = node.position.y + (node.height || 300) / 2;

			const x = centerX - nodeX * zoom;
			const y = centerY - nodeY * zoom;

			// Smoothly transition to the new viewport
			svelteFlowComponent.setViewport({ x, y, zoom }, { duration: 300 });
		} else {
			// Restore original viewport
			maximizedNodeId = null;
			if (originalViewport) {
				svelteFlowComponent.setViewport(originalViewport, { duration: 300 });
				originalViewport = null;
			}
		}
	}

	// Handle file selection from file explorer
	function handleFileExplorerOpen(event: CustomEvent) {
		const { path, name, content } = event.detail;
		handleFileSelect(path, content);
		console.log(`Loaded ${name} from file explorer`);
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('message', handleIframeMessage);
			window.addEventListener('keydown', handleKeyDown);
			window.addEventListener('keyup', handleKeyUp);
			window.addEventListener('fileExplorer:openFile', handleFileExplorerOpen as EventListener);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('message', handleIframeMessage);
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			window.removeEventListener('fileExplorer:openFile', handleFileExplorerOpen as EventListener);
		}
	});
</script>

<div class="bg-background h-screen w-full" onwheel={preventBrowserZoom}>
	<SvelteFlow
		bind:this={svelteFlowComponent}
		bind:nodes
		bind:edges
		{nodeTypes}
		fitView
		selectionMode={SelectionMode.Partial}
		selectionOnDrag
		panOnScroll
		nodesConnectable={true}
		{panOnDrag}
		{onmovestart}
		{onmove}
		{onmoveend}
	>
		<Background class="!bg-muted" />
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
		/* controls styling intentionally minimal; no nested button selectors needed */
	}

	/* Ensure only title bars are draggable */
	:global(.svelte-flow__node) {
		/* Make the entire node non-draggable by default */
		pointer-events: auto;
		position: relative;
		z-index: 1;
	}

	:global(.svelte-flow__node .content-area) {
		/* Content area should not trigger dragging */
		pointer-events: auto;
		position: relative;
		z-index: 2;
	}

	:global(.svelte-flow__node .title-bar[data-handle]) {
		/* Only title bar with data-handle should be draggable */
		cursor: move;
	}

	/* Ensure interactive elements are above everything */
	:global(.svelte-flow__node button),
	:global(.svelte-flow__node input),
	:global(.svelte-flow__node textarea),
	:global(.svelte-flow__node select) {
		position: relative;
		z-index: 10;
	}
</style>
