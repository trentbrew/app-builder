<script lang="ts">
	// Props from parent
	export let data: {
		label?: string;
		loading?: boolean;
		error?: string;
		previewUrl?: string;
	} = {};
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground border-b px-2 py-1 text-xs font-semibold"
	>
		{data.label ?? 'Preview'}
	</div>
	<div class="nodrag nowheel flex flex-1 overflow-hidden">
		{#if data.loading}
			<div
				class="bg-background text-muted-foreground flex flex-1 flex-col items-center justify-center text-sm"
			>
				<p>Loading preview...</p>
				<p class="mt-1 text-xs opacity-70">
					This can take 15-30 seconds while dependencies are installed.
				</p>
			</div>
		{:else if data.error}
			<div
				class="bg-destructive/10 text-destructive flex flex-1 flex-col items-center justify-center text-sm"
			>
				<h3 class="font-semibold">Error</h3>
				<p class="mt-1 text-xs">{data.error}</p>
			</div>
		{:else if data.previewUrl}
			<iframe src={data.previewUrl} title="Svelte REPL Preview" class="h-full w-full border-0"
			></iframe>
		{:else}
			<div
				class="bg-background text-muted-foreground flex flex-1 items-center justify-center text-sm"
			>
				Waiting for preview...
			</div>
		{/if}
	</div>
</div>
