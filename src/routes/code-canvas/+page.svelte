<script>
	import { SvelteFlow, MiniMap } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import TerminalNode from '$lib/components/nodes/terminal-node.svelte';
	import EditorNode from '$lib/components/nodes/editor-node.svelte';
	import PreviewNode from '$lib/components/nodes/preview-node.svelte';
	import LogsNode from '$lib/components/nodes/logs-node.svelte';

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
			data: { label: 'Editor' }
		},
		{
			id: 'preview',
			type: 'preview',
			position: { x: 700, y: 50 },
			width: 400,
			height: 400,
			data: { label: 'Preview' }
		},
		{
			id: 'terminal',
			type: 'terminal',
			position: { x: 50, y: 500 },
			width: 500,
			height: 300,
			data: { label: 'Terminal' }
		},
		{
			id: 'logs',
			type: 'logs',
			position: { x: 600, y: 500 },
			width: 500,
			height: 300,
			data: { label: 'Logs' }
		}
	]);

	let edges = $state.raw([]);
</script>

<div class="bg-background h-screen w-full">
	<SvelteFlow bind:nodes bind:edges {nodeTypes} fitView>
		<MiniMap
			nodeColor={(node) => {
				switch (node.type) {
					case 'editor':
						return 'hsl(var(--primary))';
					case 'preview':
						return 'hsl(var(--secondary))';
					case 'terminal':
						return 'hsl(var(--accent))';
					case 'logs':
						return 'hsl(var(--muted))';
					default:
						return 'hsl(var(--foreground))';
				}
			}}
			zoomable
			pannable
		/>
	</SvelteFlow>
</div>

<style>
	/* Dark theme for SvelteFlow */
	:global(.svelte-flow) {
		background-color: hsl(var(--background));
	}

	:global(.svelte-flow__pane) {
		background-color: hsl(var(--background));
	}

	:global(.svelte-flow__minimap) {
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: calc(var(--radius) - 2px);
	}

	:global(.svelte-flow__controls) {
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
	}

	:global(.svelte-flow__controls button) {
		background-color: hsl(var(--background));
		border: 1px solid hsl(var(--border));
		color: hsl(var(--foreground));
	}

	:global(.svelte-flow__controls button:hover) {
		background-color: hsl(var(--accent));
	}

	:global(.svelte-flow__attribution) {
		background-color: hsl(var(--card));
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
		border-radius: var(--radius);
	}
</style>
