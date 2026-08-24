export const initialCode = `<script>
	let count = $state(0);
</script>

<main>
	<h1>{count}</h1>
	<div class="row">
		<button onclick={() => count--}>−</button>
		<button onclick={() => count++}>+</button>
	</div>
	<button class="reset" onclick={() => (count = 0)}>reset</button>
</main>

<style>
	:global(body) {
		margin: 0;
		min-height: 100vh;
		display: grid;
		place-items: center;
		font-family: system-ui, sans-serif;
		background: #0f0f12;
		color: #f4f4f5;
	}

	main {
		display: grid;
		gap: 1rem;
		justify-items: center;
	}

	h1 {
		margin: 0;
		font-size: 4rem;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	button {
		font: inherit;
		font-size: 1.25rem;
		min-width: 3rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid #3f3f46;
		border-radius: 0.5rem;
		background: #18181b;
		color: inherit;
		cursor: pointer;
	}

	button:hover {
		background: #27272a;
	}

	.reset {
		font-size: 0.875rem;
		min-width: auto;
		opacity: 0.7;
	}
</style>
`;
