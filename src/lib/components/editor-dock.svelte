<script lang="ts">
	import { HorizonLayout, type LayoutConfig, type View } from 'horizon-layout';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Snippet } from 'svelte';

	let {
		editorTitle,
		editor,
		preview,
		logs,
		terminal
	}: {
		editorTitle: string;
		editor: Snippet;
		preview: Snippet;
		logs: Snippet;
		terminal: Snippet;
	} = $props();

	const views = $derived(
		new SvelteMap<string, View>([
			['editor', { title: editorTitle, snippet: editor }],
			['preview', { title: 'Preview', snippet: preview }],
			['logs', { title: 'Server logs', snippet: logs }],
			['terminal', { title: 'Terminal', snippet: terminal }]
		])
	);

	let config = $state<LayoutConfig>({
		root: {
			direction: 'vertical',
			splitPoints: [0.68],
			views: [
				{
					direction: 'horizontal',
					splitPoints: [0.38, 0.75],
					views: [
						{ tabs: ['editor'], activeTabIndex: 0 },
						{ tabs: ['preview'], activeTabIndex: 0 },
						{ tabs: ['logs'], activeTabIndex: 0 }
					]
				},
				{ tabs: ['terminal'], activeTabIndex: 0 }
			]
		}
	});
</script>

<div class="editor-dock h-full min-h-0 overflow-hidden rounded-xl border">
	<HorizonLayout bind:config {views} />
</div>
