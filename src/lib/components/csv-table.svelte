<script lang="ts">
  import { delimiterForPath, parseDelimited, serializeDelimited } from '$lib/csv'

  let {
    path,
    content = '',
    onChange,
  }: {
    path: string
    content?: string
    onChange: (content: string) => void
  } = $props()

  const ROW_HEIGHT = 28
  const OVERSCAN = 12

  const delimiter = $derived(delimiterForPath(path))
  let rows = $state<string[][]>([])
  let source = $state('')
  let viewport = $state<HTMLDivElement | undefined>()
  let scrollTop = $state(0)
  let viewportHeight = $state(400)
  let editing = $state<{ row: number; col: number } | null>(null)

  $effect(() => {
    const next = content ?? ''
    if (next === source) return
    source = next
    rows = parseDelimited(next, delimiter)
  })

  const colCount = $derived(rows[0]?.length ?? 1)
  const headers = $derived(Array.from({ length: colCount }, (_, index) => columnLabel(index)))

  const start = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN))
  const visibleCount = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2)
  const end = $derived(Math.min(rows.length, start + visibleCount))
  const visible = $derived(rows.slice(start, end))
  const topPad = $derived(start * ROW_HEIGHT)
  const bottomPad = $derived(Math.max(0, (rows.length - end) * ROW_HEIGHT))

  function columnLabel(index: number) {
    let n = index
    let label = ''
    do {
      label = String.fromCharCode(65 + (n % 26)) + label
      n = Math.floor(n / 26) - 1
    } while (n >= 0)
    return label
  }

  function commit(row: number, col: number, value: string) {
    if ((rows[row]?.[col] ?? '') === value) return
    const next = rows.map((current) => current.slice())
    if (!next[row]) next[row] = Array.from({ length: colCount }, () => '')
    next[row][col] = value
    rows = next
    source = serializeDelimited(next, delimiter)
    onChange(source)
  }

  function handleScroll(event: Event) {
    const target = event.currentTarget as HTMLDivElement
    scrollTop = target.scrollTop
    viewportHeight = target.clientHeight
  }

  $effect(() => {
    if (!viewport) return
    viewportHeight = viewport.clientHeight
  })
</script>

<div class="csv-grid">
  <div class="csv-grid__viewport" bind:this={viewport} onscroll={handleScroll}>
    <table class="csv-grid__table">
      <thead>
        <tr>
          <th class="csv-grid__gutter"></th>
          {#each headers as header}
            <th>{header}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if topPad}
          <tr aria-hidden="true">
            <td colspan={colCount + 1} style:height="{topPad}px"></td>
          </tr>
        {/if}
        {#each visible as row, offset (start + offset)}
          {@const rowIndex = start + offset}
          <tr>
            <th class="csv-grid__gutter">{rowIndex + 1}</th>
            {#each row as cell, colIndex}
              <td class:csv-grid__cell--active={editing?.row === rowIndex && editing?.col === colIndex}>
                <input
                  value={cell}
                  spellcheck="false"
                  aria-label={`Cell ${headers[colIndex]}${rowIndex + 1}`}
                  onfocus={() => (editing = { row: rowIndex, col: colIndex })}
                  onblur={(event) => {
                    commit(rowIndex, colIndex, event.currentTarget.value)
                    if (editing?.row === rowIndex && editing?.col === colIndex) editing = null
                  }}
                  onkeydown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                />
              </td>
            {/each}
          </tr>
        {/each}
        {#if bottomPad}
          <tr aria-hidden="true">
            <td colspan={colCount + 1} style:height="{bottomPad}px"></td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
  <p class="csv-grid__meta">{rows.length} rows × {colCount} columns</p>
</div>

<style>
  .csv-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--color-background);
  }

  .csv-grid__viewport {
    flex: 1 1 0;
    min-height: 0;
    overflow: auto;
  }

  .csv-grid__table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .csv-grid__table th,
  .csv-grid__table td {
    border: 1px solid var(--color-border);
    height: 28px;
    padding: 0;
    background: var(--color-background);
  }

  .csv-grid__table thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: color-mix(in oklch, var(--color-background) 88%, var(--color-muted));
    color: var(--color-muted-foreground);
    font-weight: 500;
    text-align: center;
    min-width: 8rem;
    padding: 0 0.5rem;
  }

  .csv-grid__gutter {
    position: sticky;
    left: 0;
    z-index: 3;
    width: 3rem;
    min-width: 3rem;
    text-align: right;
    padding: 0 0.5rem !important;
    color: var(--color-muted-foreground);
    background: color-mix(in oklch, var(--color-background) 88%, var(--color-muted)) !important;
  }

  .csv-grid__table thead .csv-grid__gutter {
    z-index: 4;
  }

  .csv-grid__table td input {
    display: block;
    width: 12rem;
    height: 27px;
    border: 0;
    background: transparent;
    color: var(--color-foreground);
    padding: 0 0.5rem;
    font: inherit;
    outline: none;
  }

  .csv-grid__cell--active {
    outline: 1px solid var(--color-foreground);
    outline-offset: -1px;
  }

  .csv-grid__meta {
    flex-shrink: 0;
    margin: 0;
    padding: 0.25rem 0.5rem;
    border-top: 1px solid var(--color-border);
    color: var(--color-muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }
</style>
