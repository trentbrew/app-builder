<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		SvelteFlow,
		Background,
		MiniMap,
		Controls,
		Handle,
		Position,
		type Node,
		type Edge,
		SelectionMode
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	// Import our clean Motion Canvas components
	import MotionCanvasNode from '$lib/components/nodes/motion-canvas-clean.svelte';
	import SceneEditorNode from '$lib/components/nodes/scene-editor-working.svelte';

	// SvelteFlow instance
	let svelteFlowComponent: any = $state(null);

	// Node types
	const nodeTypes = {
		motionCanvas: MotionCanvasNode,
		sceneEditor: SceneEditorNode
	} as any;

	// Pan and drag settings
	const panOnDrag = [1, 2];

	// Nodes array
	let nodes = $state.raw([
		{
			id: 'sceneEditor',
			type: 'sceneEditor',
			position: { x: 100, y: 100 },
			width: 600,
			height: 500,
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
		},
		{
			id: 'motionCanvas',
			type: 'motionCanvas',
			position: { x: 800, y: 100 },
			width: 600,
			height: 500,
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
		}
	]);

	// Edges array
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

	// Handle node maximize
	function handleNodeMaximize(nodeId: string, isMaximized: boolean) {
		const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
		if (nodeIndex !== -1) {
			// Update the node's maximize state
			nodes[nodeIndex] = {
				...nodes[nodeIndex],
				data: {
					...nodes[nodeIndex].data,
					isMaximized
				} as any
			};
		}
	}

	// Handle viewport movement
	function onmovestart(e: any) {
		console.log('move start', e);
	}

	function onmove(e: any) {
		// Handle move if needed
	}

	function onmoveend(e: any) {
		console.log('move end', e);
	}

	// Initialize the flow when component mounts
	onMount(() => {
		if (browser && svelteFlowComponent) {
			// Fit view to show both nodes nicely
			setTimeout(() => {
				svelteFlowComponent.fitView({ padding: 0.1 });
			}, 100);
		}
	});
</script>

<svelte:head>
	<title>Motion Canvas Editor</title>
</svelte:head>

<div class="motion-canvas-page">
	<div class="header">
		<h1>Motion Canvas Editor</h1>
		<p>Create and preview Motion Canvas animations with a dedicated scene editor</p>
	</div>

	<div class="flow-container">
		{#if browser}
			<SvelteFlow
				bind:this={svelteFlowComponent}
				{nodes}
				{edges}
				{nodeTypes}
				fitView
				selectionMode={SelectionMode.Partial}
				panOnScroll
				panOnDrag={false}
				nodesConnectable={true}
				{onmovestart}
				{onmove}
				{onmoveend}
			>
				<Background class="!bg-muted" />
				<MiniMap
					nodeColor="var(--color-primary)"
					nodeStrokeColor="var(--color-border)"
					nodeBorderRadius={2}
					maskColor="rgba(0, 0, 0, 0.1)"
					style="background: var(--color-background); border: 1px solid var(--color-border);"
				/>
				<Controls
					style="background: var(--color-background); border: 1px solid var(--color-border);"
				/>
			</SvelteFlow>
		{/if}
	</div>
</div>

<style>
	.motion-canvas-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--color-background);
	}

	.header {
		padding: 1rem 2rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-card);
	}

	.header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-foreground);
	}

	.header p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted-foreground);
	}

	.flow-container {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	/* Global styles for nodes */
	:global(.svelte-flow__node) {
		z-index: 1;
	}

	:global(.svelte-flow__node .content-area) {
		z-index: 2;
		position: relative;
	}

	:global(.svelte-flow__node button),
	:global(.svelte-flow__node input),
	:global(.svelte-flow__node textarea),
	:global(.svelte-flow__node select) {
		z-index: 10;
		position: relative;
	}

	/* Handle styles */
	:global(.svelte-flow__handle) {
		z-index: 20;
	}

	/* Edge styles */
	:global(.svelte-flow__edge-path) {
		stroke-width: 2px;
	}

	:global(.svelte-flow__edge.animated .svelte-flow__edge-path) {
		stroke-dasharray: 5;
		animation: dashdraw 0.5s linear infinite;
	}

	@keyframes dashdraw {
		to {
			stroke-dashoffset: -10;
		}
	}
</style>
