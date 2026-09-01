<script lang="ts">
  import { tick } from 'svelte'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { promptDialog } from '$lib/promptDialog.svelte'

  let inputEl = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!promptDialog.open) return
    void tick().then(() => {
      inputEl?.focus()
      inputEl?.select()
    })
  })

  function handleOpenChange(next: boolean) {
    if (!next) promptDialog.cancel()
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    promptDialog.submit()
  }
</script>

<Dialog.Root open={promptDialog.open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-sm" showCloseButton={false}>
    <form class="grid gap-4" onsubmit={handleSubmit}>
      <Dialog.Header>
        <Dialog.Title>{promptDialog.title}</Dialog.Title>
        {#if promptDialog.description}
          <Dialog.Description>{promptDialog.description}</Dialog.Description>
        {/if}
      </Dialog.Header>

      <div class="grid gap-2">
        <label class="text-sm font-medium" for="prompt-dialog-input">{promptDialog.inputLabel}</label>
        <Input
          id="prompt-dialog-input"
          bind:ref={inputEl}
          bind:value={promptDialog.value}
          placeholder={promptDialog.placeholder}
          autocomplete="off"
          spellcheck={false}
        />
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => promptDialog.cancel()}>Cancel</Button>
        <Button type="submit" disabled={!promptDialog.value.trim()}>{promptDialog.confirmLabel}</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
