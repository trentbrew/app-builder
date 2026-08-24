<script lang="ts">
  import PaneChrome from '$lib/components/pane-chrome.svelte'
  import PaneSplitMenu from '$lib/components/pane-split-menu.svelte'
  import PaneToolbar from '$lib/components/pane-toolbar.svelte'
  import ChatTranscript from '$lib/components/chat-transcript.svelte'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
  import * as Empty from '$lib/components/ui/empty/index.js'
  import * as InputGroup from '$lib/components/ui/input-group/index.js'
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import * as Tooltip from '$lib/components/ui/tooltip/index.js'
  import { formatFileSize } from '$lib/ai/messages.js'
  import { chat, isChatBusy, resetChat } from '$lib/chat.svelte'
  import {
    chatSettings,
    chatModelCatalog,
    loadAvailableModels,
    setChatModel,
    syncChatPersistence,
  } from '$lib/chat/settings.svelte.js'
  import { onMount } from 'svelte'
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import MessageCircleDashedIcon from '@lucide/svelte/icons/message-circle-dashed'
  import PaperclipIcon from '@lucide/svelte/icons/paperclip'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import RotateCwIcon from '@lucide/svelte/icons/rotate-cw'
  import XIcon from '@lucide/svelte/icons/x'

  let {
    canSplit = false,
    onSplit,
  }: {
    canSplit?: boolean
    onSplit?: (direction: 'left' | 'right' | 'up' | 'down') => void
  } = $props()

  let draft = $state('')
  let pendingFiles = $state<File[]>([])
  let fileInput = $state<HTMLInputElement | undefined>()

  const messages = $derived(chat.messages)
  const models = $derived(chatModelCatalog.available)
  const busy = $derived(isChatBusy())
  const streaming = $derived(chat.status === 'streaming')
  const hasError = $derived(chat.status === 'error')
  const canSend = $derived(Boolean(draft.trim() || pendingFiles.length > 0))

  onMount(() => {
    void loadAvailableModels()
  })

  $effect(() => {
    syncChatPersistence(chat.messages)
    void chatSettings.model
  })

  function openFilePicker(accept?: string) {
    if (!fileInput) return
    fileInput.accept = accept ?? 'image/*,.pdf,.txt,.md,.json,.csv,.ts,.js,.svelte'
    fileInput.click()
  }

  function handleFileSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const selected = input.files ? [...input.files] : []
    if (selected.length > 0) {
      pendingFiles = [...pendingFiles, ...selected]
    }
    input.value = ''
  }

  function removePendingFile(index: number) {
    pendingFiles = pendingFiles.filter((_, i) => i !== index)
  }

  function filesToFileList(files: File[]) {
    const dt = new DataTransfer()
    for (const file of files) dt.items.add(file)
    return dt.files
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    const text = draft.trim()
    if ((!text && pendingFiles.length === 0) || busy) return

    const files = pendingFiles.length > 0 ? filesToFileList(pendingFiles) : undefined
    draft = ''
    pendingFiles = []

    if (text && files) {
      await chat.sendMessage({ text, files })
      return
    }

    if (files) {
      await chat.sendMessage({ files })
      return
    }

    await chat.sendMessage({ text })
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  multiple
  class="sr-only"
  aria-hidden="true"
  tabindex="-1"
  onchange={handleFileSelection}
/>

<PaneChrome paneKind="chat">
  {#snippet toolbar()}
    <PaneToolbar>
        {#snippet meta()}
        <span class="pane-toolbar__detail">{messages.length} messages</span>
        <span class="pane-toolbar__sep" aria-hidden="true"></span>
        {#if streaming}
          <span class="pane-toolbar__sep" aria-hidden="true"></span>
          <span class="pane-toolbar__detail">streaming…</span>
        {:else if hasError}
          <span class="pane-toolbar__sep" aria-hidden="true"></span>
          <span class="pane-toolbar__detail text-destructive">error</span>
        {/if}
      {/snippet}

      {#snippet actions()}
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <button
                  {...props}
                  type="button"
                  class="pane-toolbar__btn"
                  aria-label="Reset conversation"
                  disabled={busy}
                  onclick={() => resetChat()}
                >
                  <RotateCwIcon class="size-3.5" />
                </button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Reset conversation</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <PaneSplitMenu disabled={!canSplit} {onSplit} />
      {/snippet}
    </PaneToolbar>
  {/snippet}

  {#snippet children()}
    <div class="chat-pane">
      <MessageScroller.Provider autoScroll defaultScrollPosition="last-anchor" scrollPreviousItemPeek={64}>
        <div class="chat-pane__transcript">
          {#if messages.length === 0}
            <Empty.Root class="h-full min-h-0 border-0 bg-transparent">
              <Empty.Header>
                <Empty.Media variant="icon">
                  <MessageCircleDashedIcon />
                </Empty.Media>
                <Empty.Title>How can I help?</Empty.Title>
                <Empty.Description>
                  Ask about your project or attach files for context. Replies stream from local Ollama ({chatSettings.model})
                  and render with the same markdown formatter as your notes.
                </Empty.Description>
              </Empty.Header>
            </Empty.Root>
          {:else}
            <ChatTranscript busy={streaming} />
          {/if}
        </div>

        <form class="chat-composer" onsubmit={handleSubmit}>
          <InputGroup.Root class="rounded-xl border-border/80 bg-background shadow-none">
            {#if pendingFiles.length > 0}
              <div class="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
                {#each pendingFiles as file, index (file.name + file.size + index)}
                  <div class="bg-muted/50 flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs">
                    <PaperclipIcon class="size-3 shrink-0 opacity-70" />
                    <span class="truncate">{file.name}</span>
                    <span class="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground ms-0.5 inline-flex"
                      aria-label={`Remove ${file.name}`}
                      onclick={() => removePendingFile(index)}
                    >
                      <XIcon class="size-3" />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            <InputGroup.Textarea
              bind:value={draft}
              rows={1}
              placeholder="Message the assistant…"
              aria-label="Message"
              disabled={busy}
              class="min-h-11 py-2.5"
              onkeydown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />

            <InputGroup.Addon align="block-end" class="justify-between pb-2 pe-2 ps-2 pt-0">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <InputGroup.Button
                      {...props}
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Add attachments"
                      disabled={busy}
                    >
                      <PlusIcon class="size-3.5" />
                    </InputGroup.Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start" side="top" class="w-44">
                  <DropdownMenu.Item onclick={() => openFilePicker()}>
                    <PaperclipIcon class="size-3.5" />
                    Add photos & files
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>

              <InputGroup.Button
                type="submit"
                variant="default"
                size="icon-sm"
                disabled={!canSend || busy}
                class="ms-auto"
              >
                <ArrowUpIcon class="size-3.5" />
                <span class="sr-only">Send</span>
              </InputGroup.Button>
            </InputGroup.Addon>
          </InputGroup.Root>

          <div class="chat-composer__footer">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <button
                    {...props}
                    type="button"
                    class="pane-toolbar__model"
                    aria-label="Choose model"
                    disabled={busy}
                  >
                    <span class="truncate">{chatSettings.model}</span>
                    <ChevronDownIcon class="size-3 shrink-0 opacity-70" />
                  </button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="top" class="max-h-64 w-52 overflow-y-auto">
                <DropdownMenu.Label>Model</DropdownMenu.Label>
                {#each models as model (model)}
                  <DropdownMenu.Item onclick={() => setChatModel(model)}>
                    <span class="truncate">{model}</span>
                    {#if chatSettings.model === model}
                      <CheckIcon class="ms-auto size-3.5" />
                    {/if}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </form>
      </MessageScroller.Provider>
    </div>
  {/snippet}
</PaneChrome>

<style>
  .chat-pane {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .chat-pane__transcript {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :global(.chat-composer) {
    flex: 0 0 auto;
    padding: 0 0.5rem 0.5rem;
    background: color-mix(in oklch, var(--color-background) 92%, var(--color-muted));
  }

  :global(.chat-composer__footer) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 0.375rem;
  }

  :global(.pane-toolbar__model) {
    display: inline-flex;
    max-width: 8.5rem;
    align-items: center;
    gap: 0.25rem;
    border: none;
    background: transparent;
    padding: 0;
    font-size: 0.6875rem;
    color: var(--color-muted-foreground);
    cursor: pointer;
  }

  :global(.pane-toolbar__model:hover:not(:disabled)) {
    color: var(--color-foreground);
  }

  :global(.pane-toolbar__model:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
