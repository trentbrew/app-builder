<script lang="ts">
  // Faithful Svelte port of the Magic UI "border-beam" used in
  // pi-sprite/examples/webcontainer-react (src/components/ui/border-beam).
  // A light travels the border via CSS offset-path while the agent is working.

  let {
    size = 80,
    duration = 12,
    anchor = 90,
    borderWidth = 1,
    colorFrom = '#ffffff',
    colorTo = '#ffffff',
    delay = 0,
    pathRadius = 8,
    class: className = '',
  }: {
    size?: number
    duration?: number
    anchor?: number
    borderWidth?: number
    colorFrom?: string
    colorTo?: string
    delay?: number
    pathRadius?: number
    class?: string
  } = $props()
</script>

<div
  class={`border-beam ${className}`}
  aria-hidden="true"
  style={`--size:${size}; --duration:${duration}; --anchor:${anchor}; --border-width:${borderWidth}; --color-from:${colorFrom}; --color-to:${colorTo}; --delay:-${delay}s; --path-radius:${pathRadius};`}
></div>

<style>
  .border-beam {
    pointer-events: none;
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: inherit;
    border: calc(var(--border-width) * 1px) solid transparent;
    /* Clip painting to the border band only. */
    -webkit-mask:
      linear-gradient(transparent, transparent),
      linear-gradient(white, white);
    mask:
      linear-gradient(transparent, transparent),
      linear-gradient(white, white);
    -webkit-mask-clip: padding-box, border-box;
    mask-clip: padding-box, border-box;
    mask-composite: intersect;
  }

  .border-beam::after {
    content: '';
    position: absolute;
    aspect-ratio: 1;
    width: calc(var(--size) * 1px);
    background: linear-gradient(to left, var(--color-from), var(--color-to), transparent);
    offset-anchor: calc(var(--anchor) * 1%) 50%;
    offset-path: rect(0 auto auto 0 round calc(var(--path-radius) * 1px));
    animation: border-beam calc(var(--duration) * 1s) infinite linear;
    animation-delay: var(--delay);
  }

  @keyframes border-beam {
    to {
      offset-distance: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .border-beam::after {
      animation: none;
    }
  }
</style>
