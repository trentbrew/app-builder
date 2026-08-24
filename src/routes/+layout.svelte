<script>
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
</script>

<div class="flex h-svh w-screen flex-col">
	<main class="flex min-h-0 flex-1 flex-col">
		<slot />
	</main>
</div>

<Toaster richColors closeButton position="bottom-right" />
