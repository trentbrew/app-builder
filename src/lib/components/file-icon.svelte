<script lang="ts">
	import { basename, fileIconUrl, folderIconUrl } from '$lib/fileIcons';

	let {
		path,
		kind = 'file',
		open = false,
		class: className = ''
	}: {
		path: string;
		kind?: 'file' | 'folder';
		open?: boolean;
		class?: string;
	} = $props();

	const name = $derived(basename(path));
	const src = $derived(kind === 'folder' ? folderIconUrl(name, open) : fileIconUrl(name));
</script>

<img {src} alt="" class="file-type-icon shrink-0 {className}" draggable="false" />

<style>
	.file-type-icon {
		width: 1rem;
		height: 1rem;
		object-fit: contain;
	}
</style>
