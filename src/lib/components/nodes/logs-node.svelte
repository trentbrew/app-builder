<script lang="ts">
	export let data: { label?: string } = {};
	let logs = `Starting dev server...\\n> svelte-repl dev\\n> pnpm run dev\\n`;
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground border-b px-2 py-1 text-xs font-semibold"
	>
		{data.label ?? 'Logs'}
	</div>
	<pre
		class="nodrag nowheel bg-background text-foreground flex-1 overflow-auto p-2 text-xs whitespace-pre-wrap">
		{logs}
	</pre>
</div>
