<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    class: className = '',
    children,
  }: {
    class?: string
    children?: Snippet
  } = $props()
</script>

<span class="text-shine {className}">
  {@render children?.()}
</span>

<style>
  .text-shine {
    display: inline-block;
    background: linear-gradient(
      110deg,
      var(--color-muted-foreground) 0%,
      var(--color-muted-foreground) 35%,
      var(--color-foreground) 50%,
      var(--color-muted-foreground) 75%,
      var(--color-muted-foreground) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: text-shine 2s linear infinite;
  }

  @keyframes text-shine {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .text-shine {
      animation: none;
      color: var(--color-muted-foreground);
      background: none;
    }
  }
</style>
