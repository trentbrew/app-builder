<script lang="ts">
	import { afterUpdate } from 'svelte';

	// Props from parent
	export let data: {
		label?: string;
		logs?: string[];
		onClearLogs?: () => void;
	} = {};

	let logsContainer: HTMLDivElement;
	let userScrolledUp = false;

	// Helper to check if user is at the bottom
	function isAtBottom(container: HTMLDivElement) {
		return container.scrollHeight - container.scrollTop - container.clientHeight < 5;
	}

	// Setup scroll listener
	function setupScrollListener() {
		if (!logsContainer) return;
		logsContainer.addEventListener('scroll', () => {
			userScrolledUp = !isAtBottom(logsContainer);
		});
	}

	// Auto-scroll after logs update
	afterUpdate(() => {
		if (logsContainer) {
			// Setup scroll listener once
			if (!logsContainer.dataset.listenerAttached) {
				setupScrollListener();
				logsContainer.dataset.listenerAttached = 'true';
			}

			// Auto-scroll if user hasn't scrolled up
			if (!userScrolledUp) {
				logsContainer.scrollTop = logsContainer.scrollHeight;
			}
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-xs font-semibold"
	>
		<span>{data.label ?? 'Logs'}</span>
		{#if data.onClearLogs}
			<button
				class="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-2 py-0.5 text-xs transition-colors"
				on:click={data.onClearLogs}
			>
				Clear
			</button>
		{/if}
	</div>
	<div
		bind:this={logsContainer}
		class="nodrag nowheel bg-background text-foreground flex-1 overflow-auto p-2 font-mono text-xs"
	>
		{#if data.logs && data.logs.length > 0}
			<pre class="whitespace-pre-wrap">{data.logs.join('\n')}</pre>
		{:else}
			<div class="text-muted-foreground italic">No logs yet...</div>
		{/if}
	</div>
</div>
