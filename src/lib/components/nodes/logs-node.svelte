<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Handle, Position } from '@xyflow/svelte';
	import { codeCanvasState, codeCanvasActions } from '../../../routes/code-canvas/state.svelte';

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
		};
	} = $props();

	let container: HTMLDivElement;
	let autoScroll = $state(true);

	// Format time since last activity
	function getTimeSinceActivity() {
		if (!codeCanvasState.lastActivity) return '';
		const now = new Date();
		const diff = now.getTime() - codeCanvasState.lastActivity.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s ago`;
		}
		return `${seconds}s ago`;
	}

	// Get status color
	function getStatusColor() {
		if (!codeCanvasState.bootStatus) return 'text-gray-400';
		if (codeCanvasState.bootStatus.includes('Error')) return 'text-red-400';
		if (codeCanvasState.bootStatus === 'Ready') return 'text-green-400';
		return 'text-blue-400';
	}

	// Auto-scroll to bottom when new logs are added
	function scrollToBottom() {
		if (autoScroll && container) {
			container.scrollTop = container.scrollHeight;
		}
	}

	// Handle scroll to detect if user scrolled up
	function handleScroll() {
		if (container) {
			const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 5;
			autoScroll = isAtBottom;
		}
	}

	// Watch for changes in logs and scroll
	$effect(() => {
		if (codeCanvasState.logs.length > 0 || codeCanvasState.webContainerLogs.length > 0) {
			setTimeout(scrollToBottom, 10);
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<!-- Connection handles for edges -->
	<Handle type="target" position={Position.Top} />
	<Handle type="source" position={Position.Right} />
	<Handle type="target" position={Position.Bottom} />
	<Handle type="source" position={Position.Left} />

	<div
		class="drag-handle border-border bg-muted text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-xs font-semibold"
	>
		<div class="flex items-center gap-2">
			<span>{data.label ?? 'Logs'}</span>
			{#if codeCanvasState.bootStatus}
				<span class="inline-flex items-center gap-1 {getStatusColor()}">
					<span class="h-2 w-2 rounded-full bg-current"></span>
					<span class="text-xs opacity-75">{codeCanvasState.bootStatus}</span>
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-1">
			{#if codeCanvasState.lastActivity}
				<span class="text-xs opacity-50">
					{getTimeSinceActivity()}
				</span>
			{/if}
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Clear logs"
				onclick={codeCanvasActions.clearLogs}
			>
				Clear
			</button>
		</div>
	</div>

	<!-- Status bar -->
	{#if codeCanvasState.bootStatus || codeCanvasState.lastActivity}
		<div class="border-border bg-muted/30 border-b px-2 py-1 text-xs">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					{#if codeCanvasState.bootStatus}
						<span class="font-medium">Status:</span>
						<span class={getStatusColor()}>{codeCanvasState.bootStatus}</span>
					{/if}
				</div>
				{#if codeCanvasState.lastActivity}
					<span class="text-muted-foreground">
						Last activity: {getTimeSinceActivity()}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<div
		bind:this={container}
		onscroll={handleScroll}
		class="nodrag nowheel bg-background flex-1 overflow-y-auto p-2 font-mono text-xs"
	>
		{#if codeCanvasState.logs.length === 0 && codeCanvasState.webContainerLogs.length === 0}
			<div class="text-muted-foreground italic">No logs yet...</div>
		{:else}
			<!-- WebContainer logs -->
			{#if codeCanvasState.webContainerLogs.length > 0}
				<div class="mb-2">
					<div class="mb-1 font-semibold text-blue-400">WebContainer:</div>
					{#each codeCanvasState.webContainerLogs as log}
						<div class="mb-1 text-blue-300">{log}</div>
					{/each}
				</div>
			{/if}

			<!-- Application logs -->
			{#if codeCanvasState.logs.length > 0}
				<div>
					<div class="mb-1 font-semibold text-green-400">Application:</div>
					{#each codeCanvasState.logs as log}
						<div
							class="mb-1"
							class:text-red-400={log.includes('[iframe-error]')}
							class:text-yellow-400={log.includes('[iframe-warn]')}
							class:text-blue-400={log.includes('[iframe-log]')}
						>
							{log}
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Auto-scroll indicator -->
		{#if !autoScroll}
			<div class="fixed right-4 bottom-4 z-10">
				<button
					class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-3 py-1 text-xs shadow-lg transition-colors"
					onclick={() => {
						autoScroll = true;
						scrollToBottom();
					}}
				>
					↓ Scroll to bottom
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* SvelteFlow Handle styling */
	:global(.svelte-flow__handle) {
		width: 8px !important;
		height: 8px !important;
		background: var(--color-primary) !important;
		border: 2px solid var(--color-background) !important;
		opacity: 0 !important;
		transition: opacity 0.2s ease !important;
	}

	:global(.svelte-flow__handle:hover) {
		background: var(--color-primary) !important;
		transform: scale(1.2) !important;
		opacity: 1 !important;
	}

	:global(.svelte-flow__handle.connectingfrom) {
		opacity: 1 !important;
	}

	:global(.svelte-flow__handle.valid) {
		background: #10b981 !important;
	}

	/* Show handles on hover */
	div:hover :global(.svelte-flow__handle) {
		opacity: 1 !important;
	}
</style>
