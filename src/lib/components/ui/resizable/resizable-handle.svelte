<script>
	import * as ResizablePrimitive from 'paneforge';
	import { cn } from '$lib/utils.js';
	export let withHandle = false;
	export let el = undefined;
	let className = undefined;
	export { className as class };
</script>

<ResizablePrimitive.PaneResizer
	bind:el
	class={cn(
		'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-none data-[direction=vertical]:h-px data-[direction=vertical]:w-full data-[direction=vertical]:after:left-0 data-[direction=vertical]:after:h-1 data-[direction=vertical]:after:w-full data-[direction=vertical]:after:translate-x-0 data-[direction=vertical]:after:-translate-y-1/2 [&[data-direction=vertical]>div]:rotate-90',
		className
	)}
>
	{#if withHandle}
		<div class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
			<div class="grid h-2.5 w-2.5 grid-cols-2 gap-0.5">
				<div class="h-0.5 w-0.5 rounded-full bg-current"></div>
				<div class="h-0.5 w-0.5 rounded-full bg-current"></div>
				<div class="h-0.5 w-0.5 rounded-full bg-current"></div>
				<div class="h-0.5 w-0.5 rounded-full bg-current"></div>
			</div>
		</div>
	{/if}
</ResizablePrimitive.PaneResizer>
