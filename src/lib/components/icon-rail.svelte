<script lang="ts">
	import { page } from '$app/state';
	import Code2Icon from '@lucide/svelte/icons/code-2';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { cn } from '$lib/utils.js';
	import type { Component } from 'svelte';

	type RailItem = {
		href: string;
		label: string;
		icon: Component;
	};

	const items: RailItem[] = [
		{ href: '/editor', label: 'Editor', icon: Code2Icon },
		{ href: '/settings', label: 'Settings', icon: SettingsIcon }
	];

	function isActive(href: string) {
		const pathname = page.url.pathname;
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<nav
	class="bg-card fixed inset-y-0 left-0 z-20 flex w-12 shrink-0 flex-col items-center gap-1 border-r py-3"
	aria-label="App navigation"
>
	{#each items as item (item.href)}
		<a
			href={item.href}
			aria-label={item.label}
			aria-current={isActive(item.href) ? 'page' : undefined}
			title={item.label}
			class={cn(
				'flex size-9 items-center justify-center rounded-md transition-colors',
				isActive(item.href)
					? 'bg-sidebar-accent text-sidebar-accent-foreground'
					: 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
			)}
		>
			<item.icon class="size-[18px]" />
		</a>
	{/each}
</nav>
