<script lang="ts">
  import { onMount } from 'svelte'
  import {
    inferenceSettings,
    setMaxTokens,
    setStopSequences,
    setTemperature,
    setThinkingLevel,
    setTopP,
    resetInference,
  } from '$lib/agent/inference/settings.svelte'
  import { THINKING_LEVELS, type ThinkingLevel } from '$lib/agent/inference/params'
  import {
    chatModelCatalog,
    chatSettings,
    loadAvailableModels,
    setChatModel,
  } from '$lib/chat/settings.svelte.js'

  onMount(() => void loadAvailableModels())

  const models = $derived(chatModelCatalog.available)

  function onNumber(event: Event, set: (n: number) => void) {
    const value = Number((event.currentTarget as HTMLInputElement).value)
    if (Number.isFinite(value)) set(value)
  }
</script>

<div class="inf">
  <label class="inf__field">
    <span class="inf__label">Model</span>
    <select
      class="inf__select"
      value={chatSettings.model}
      onchange={(e) => setChatModel((e.currentTarget as HTMLSelectElement).value)}
    >
      {#each models as model (model)}
        <option value={model}>{model}</option>
      {/each}
    </select>
  </label>

  <label class="inf__field">
    <span class="inf__label">Thinking</span>
    <select
      class="inf__select"
      value={inferenceSettings.thinkingLevel}
      onchange={(e) => setThinkingLevel((e.currentTarget as HTMLSelectElement).value as ThinkingLevel)}
    >
      {#each THINKING_LEVELS as level (level)}
        <option value={level}>{level}</option>
      {/each}
    </select>
  </label>

  <label class="inf__field">
    <span class="inf__label">Temperature <span class="inf__val">{inferenceSettings.temperature.toFixed(2)}</span></span>
    <input
      class="inf__range"
      type="range"
      min="0"
      max="2"
      step="0.05"
      value={inferenceSettings.temperature}
      oninput={(e) => onNumber(e, setTemperature)}
    />
  </label>

  <label class="inf__field">
    <span class="inf__label">Top P <span class="inf__val">{inferenceSettings.topP.toFixed(2)}</span></span>
    <input
      class="inf__range"
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={inferenceSettings.topP}
      oninput={(e) => onNumber(e, setTopP)}
    />
  </label>

  <label class="inf__field">
    <span class="inf__label">Max tokens</span>
    <input
      class="inf__input"
      type="number"
      min="1"
      max="32768"
      step="1"
      value={inferenceSettings.maxTokens}
      onchange={(e) => onNumber(e, setMaxTokens)}
    />
  </label>

  <label class="inf__field">
    <span class="inf__label">Stop sequences</span>
    <input
      class="inf__input"
      type="text"
      placeholder="comma or newline separated"
      value={inferenceSettings.stopSequences}
      onchange={(e) => setStopSequences((e.currentTarget as HTMLInputElement).value)}
    />
  </label>

  <button type="button" class="inf__reset" onclick={() => resetInference()}>Reset to defaults</button>
</div>

<style>
  .inf {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .inf__field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .inf__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--muted-foreground);
  }

  .inf__val {
    font-family: var(--font-mono, ui-monospace, monospace);
    color: var(--foreground);
  }

  .inf__select,
  .inf__input {
    height: 1.75rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: var(--background);
    color: var(--foreground);
    padding: 0 0.5rem;
    font-size: 0.75rem;
  }

  .inf__range {
    width: 100%;
    accent-color: var(--color-primary, var(--primary));
  }

  .inf__reset {
    align-self: flex-start;
    margin-top: 0.25rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: transparent;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    color: var(--muted-foreground);
    cursor: pointer;
  }

  .inf__reset:hover {
    color: var(--foreground);
    background: color-mix(in oklch, var(--foreground) 6%, transparent);
  }
</style>
