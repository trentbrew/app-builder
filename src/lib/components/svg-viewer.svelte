<script lang="ts">
  let { source }: { source: string } = $props()

  let url = $state('')

  $effect(() => {
    const text = source
    const blob = new Blob([text], { type: 'image/svg+xml' })
    const nextUrl = URL.createObjectURL(blob)
    url = nextUrl
    return () => URL.revokeObjectURL(nextUrl)
  })
</script>

<div class="svg-viewer">
  <img class="svg-viewer__img" src={url} alt="SVG preview" />
</div>

<style>
  .svg-viewer {
    display: flex;
    height: 100%;
    min-height: 0;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(45deg, var(--color-muted) 25%, transparent 25%) 0 0 / 16px 16px,
      linear-gradient(45deg, transparent 75%, var(--color-muted) 75%) 0 0 / 16px 16px,
      linear-gradient(45deg, transparent 75%, var(--color-muted) 75%) 8px 8px / 16px 16px,
      linear-gradient(45deg, var(--color-muted) 25%, transparent 25%) 8px 8px / 16px 16px,
      var(--color-background);
    padding: 1.5rem;
  }

  .svg-viewer__img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
  }
</style>
