<script>
	import SettingsDialog from '$lib/components/settings-dialog.svelte';

	import '../app.css';
</script>

<div class="flex h-screen w-screen flex-col bg-black">
	<!-- Header with dialog trigger -->
	<div class="flex h-12 w-full items-center justify-end bg-[#222] px-4">
		<SettingsDialog />
	</div>

	<main class="flex h-screen w-full flex-col bg-black">
		<slot />
	</main>
</div>
