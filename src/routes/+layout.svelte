<script>
	import '../app.css';
</script>

<div class="flex h-screen w-screen flex-col bg-black">
	<!-- <div class="flex h-12 w-full items-center justify-between bg-[#222] px-4 text-white">hi</div> -->
	<main class="flex h-screen w-full flex-col bg-black">
		<slot />
	</main>
</div>
