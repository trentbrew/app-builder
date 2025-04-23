export const initialCode = `<script>
  let count = 0;
  function handleClick() {
    console.log('clicked');
    count += 1;
  }
</script>

<h1>Svelte REPL</h1>
<button on:click={handleClick}>
  Clicked {count} {count === 1 ? 'time' : 'times'}
</button>

<style>
  h1 { color: #7e22ce; }
</style>
`;
