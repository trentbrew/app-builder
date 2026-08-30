<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    active = false,
    children,
  }: {
    active?: boolean
    children?: Snippet
  } = $props()
</script>

<div class="agent-busy-border" class:agent-busy-border--active={active}>
  {#if active}
    <span class="agent-busy-border__spark-wrap" aria-hidden="true">
      <span class="agent-busy-border__spark"></span>
    </span>
    <span class="agent-busy-border__backdrop" aria-hidden="true"></span>
  {/if}
  <div class="agent-busy-border__inner">
    {@render children?.()}
  </div>
</div>

<style>
  .agent-busy-border {
    position: relative;
    border-radius: 0.5rem;
  }

  .agent-busy-border--active {
    overflow: hidden;
    padding: 1px;
    background: color-mix(in oklch, var(--color-foreground) 12%, transparent);
  }

  .agent-busy-border__spark-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
    mask-image: linear-gradient(white, transparent 50%);
    -webkit-mask-image: linear-gradient(white, transparent 50%);
  }

  .agent-busy-border__spark {
    position: absolute;
    inset: 0 auto auto 50%;
    width: 200%;
    aspect-ratio: 1;
    translate: -50% -15%;
    rotate: -90deg;
    background: conic-gradient(from 0deg, transparent 0 340deg, white 360deg);
    animation: agent-busy-kitrotate 3s linear infinite;
  }

  .agent-busy-border__backdrop {
    position: absolute;
    inset: 1px;
    border-radius: calc(0.5rem - 1px);
    background: color-mix(in oklch, var(--color-foreground) 10%, transparent);
    pointer-events: none;
  }

  .agent-busy-border__inner {
    position: relative;
    z-index: 1;
    border-radius: calc(0.5rem - 1px);
  }

  @keyframes agent-busy-kitrotate {
    to {
      rotate: 270deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-busy-border__spark-wrap {
      display: none;
    }

    .agent-busy-border--active {
      background: var(--color-border);
    }
  }
</style>
