export const initialCode = `<script>
	let count = 0;
	const handleClick = () => count += 1;
</script>

<h1>Svelte REPL</h1>
<button on:click={handleClick}>
	Clicked {count} times
</button>

<style>
	h1 {
		color: #7e22ce;
		font-family: sans-serif;
	}
	button {
		background: #7e22ce;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
	}
	button:hover {
		background: #6b21a8;
	}
</style>`;
