<script>
	import '../app.css';
</script>

<div class="flex h-screen w-screen flex-col">
	<!-- <div class="flex h-12 w-full items-center justify-between bg-[#222] px-4 text-white">hi</div> -->
	<main class="flex h-[calc(100vh)] w-full flex-col bg-black">
		<slot />
	</main>
</div>
