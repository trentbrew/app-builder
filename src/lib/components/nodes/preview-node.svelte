<script lang="ts">
	export let data: { label?: string } = {};
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground border-b px-2 py-1 text-xs font-semibold"
	>
		{data.label ?? 'Preview'}
	</div>
	<div
		class="nodrag nowheel bg-background text-muted-foreground flex flex-1 items-center justify-center text-sm"
	>
		Loading preview...
	</div>
</div>
