<script>
	import { browser } from '$app/environment';
	import { cn } from '$lib/utils.js';
	import {
		SIDEBAR_COOKIE_MAX_AGE,
		SIDEBAR_COOKIE_NAME,
		SIDEBAR_WIDTH,
		SIDEBAR_WIDTH_ICON
	} from './constants.js';
	import { setSidebar } from './context.svelte.js';

	let {
		ref = $bindable(null),
		open = $bindable(true),
		onOpenChange = () => {},
		class: className,
		style,
		children,
		...restProps
	} = $props();

	const sidebar = setSidebar({
		open: () => open,
		setOpen: (value) => {
			open = value;
			onOpenChange(value);

			// This sets the cookie to keep the sidebar state.
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		}
	});

	let TooltipProviderComponent = $state(undefined);

	$effect(() => {
		if (browser) {
			import('$lib/components/ui/tooltip/index.js').then((module) => {
				TooltipProviderComponent = module.Provider; // Assuming 'Provider' is the correct export
			});
		}
	});
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

{#if TooltipProviderComponent}
	<TooltipProviderComponent delayDuration={0}>
		<div
			style="--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON}; {style}"
			class={cn(
				'group/sidebar-wrapper has-[[data-variant=inset]]:bg-sidebar flex min-h-svh w-full',
				className
			)}
			bind:this={ref}
			{...restProps}
		>
			{@render children?.()}
		</div>
	</TooltipProviderComponent>
{/if}
