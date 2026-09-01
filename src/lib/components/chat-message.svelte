<script lang="ts">
  import MarkdownView from '$lib/components/markdown-view.svelte'
  import * as Accordion from '$lib/components/ui/accordion/index.js'
  import * as Bubble from '$lib/components/ui/bubble/index.js'
  import * as Marker from '$lib/components/ui/marker/index.js'
  import * as Message from '$lib/components/ui/message/index.js'
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import { Spinner } from '$lib/components/ui/spinner/index.js'
  import TextShine from '$lib/components/text-shine.svelte'
  import {
    formatMessageTime,
    formatThoughtDuration,
    getMessageFiles,
    getMessageReasoning,
    getMessageText,
    getMessageTimestamp,
    isMessageStreaming,
  } from '$lib/ai/messages.js'
  import { toast } from '$lib/notify'
  import { cn } from '$lib/utils.js'
  import type { ChatStatus, UIMessage } from 'ai'
  import BrainIcon from '@lucide/svelte/icons/brain'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import FileIcon from '@lucide/svelte/icons/file'

  let {
    message,
    scrollAnchor = false,
    chatStatus = 'ready' as ChatStatus,
  }: {
    message: UIMessage
    scrollAnchor?: boolean
    chatStatus?: ChatStatus
  } = $props()

  const text = $derived(getMessageText(message))
  const reasoning = $derived(getMessageReasoning(message))
  const files = $derived(getMessageFiles(message))
  const streaming = $derived(isMessageStreaming(message, chatStatus))
  const isUser = $derived(message.role === 'user')
  const isAssistant = $derived(message.role === 'assistant')
  const timestamp = $derived(getMessageTimestamp(message))
  const timeLabel = $derived(timestamp ? formatMessageTime(timestamp) : null)
  const showMetaRow = $derived(Boolean(timeLabel) || (isAssistant && text && !streaming))

  let thinkingAccordion = $state<string | undefined>(undefined)
  let reasoningStartedAt = $state<number | null>(null)
  let reasoningDurationSec = $state<number | null>(null)

  const thinkingActive = $derived(isAssistant && streaming && !text.trim())
  const showThinkingSection = $derived(Boolean(reasoning.trim()) || thinkingActive)

  const thinkingLabel = $derived.by(() => {
    if (thinkingActive) return 'Thinking…'
    if (reasoningDurationSec != null) return formatThoughtDuration(reasoningDurationSec)
    return 'Thought'
  })

  $effect(() => {
    if (!showThinkingSection) return

    const inReasoningPhase = thinkingActive || (streaming && Boolean(reasoning.trim()) && !text.trim())
    if (inReasoningPhase && reasoningStartedAt == null) {
      reasoningStartedAt = Date.now()
    }

    if (reasoningStartedAt != null && reasoningDurationSec == null) {
      if (text.trim() || (!streaming && Boolean(reasoning.trim()))) {
        reasoningDurationSec = Math.max(1, (Date.now() - reasoningStartedAt) / 1000)
      }
    }

    if (streaming) {
      thinkingAccordion = 'thinking'
      return
    }

    thinkingAccordion = undefined
  })

  async function copyResponse() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied response')
    } catch {
      toast.error('Could not copy response')
    }
  }
</script>

<MessageScroller.Item messageId={message.id} {scrollAnchor} class="w-full">
  <Message.Root class={cn('w-full', isUser && scrollAnchor && 'pb-0.5', isAssistant && 'chat-message--assistant')}>
    <Message.Content class="relative w-full gap-1">
      {#if showThinkingSection && isAssistant}
        <div class="chat-message__thinking">
          <Accordion.Root type="single" collapsible bind:value={thinkingAccordion} class="w-full">
            <Accordion.Item value="thinking" class="border-0">
              <Accordion.Trigger
                class="text-muted-foreground hover:text-foreground flex w-fit max-w-full items-center justify-start gap-1 rounded-md px-0 py-0.5 text-left text-sm font-normal hover:no-underline **:data-[slot=accordion-trigger-icon]:ml-0 **:data-[slot=accordion-trigger-icon]:size-3"
              >
                <Marker.Root
                  class="gap-1.5 text-sm"
                  role={thinkingActive ? 'status' : undefined}
                  aria-live={thinkingActive ? 'polite' : undefined}
                >
                  <Marker.Icon>
                    <BrainIcon class="size-3.5" />
                  </Marker.Icon>
                  {#if thinkingActive}
                    <Marker.Icon>
                      <Spinner class="size-3" role="none" aria-hidden="true" />
                    </Marker.Icon>
                  {/if}
                  <Marker.Content class="font-sans">
                    {#if thinkingActive}
                      <TextShine>{thinkingLabel}</TextShine>
                    {:else}
                      {thinkingLabel}
                    {/if}
                  </Marker.Content>
                </Marker.Root>
              </Accordion.Trigger>
              <Accordion.Content class="pb-0 pt-0">
                <div class="chat-thinking-panel">
                  {#if reasoning.trim()}
                    <MarkdownView markdown={reasoning} compact />
                  {:else if thinkingActive}
                    <TextShine class="text-xs">Working through the request…</TextShine>
                  {/if}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      {/if}

      <Bubble.Root class="w-full max-w-full">
        <Bubble.Content
          class={cn(
            'w-full text-sm leading-relaxed',
            isUser &&
              'rounded-lg border border-border bg-muted px-3.5 py-1.5 text-foreground whitespace-normal',
            isAssistant && 'rounded-none border-0 bg-transparent p-0 shadow-none',
          )}
        >
          {#if files.length > 0}
            <div class="mb-1 flex flex-col gap-1">
              {#each files as file, index (file.url + (file.filename ?? index))}
                <div
                  class="border-border/60 bg-background/50 flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-sm"
                >
                  {#if file.mediaType.startsWith('image/')}
                    <img src={file.url} alt={file.filename ?? 'Attachment'} class="size-7 rounded object-cover" />
                  {:else}
                    <FileIcon class="size-3 shrink-0 opacity-70" />
                  {/if}
                  <span class="truncate">{file.filename ?? 'Attachment'}</span>
                </div>
              {/each}
            </div>
          {/if}

          {#if text}
            {#if isUser}
              <span class="chat-message__user-text block w-full wrap-break-word">{text}</span>
            {:else}
              <MarkdownView markdown={text} compact />
            {/if}
          {/if}

          {#if streaming && text}
            <span class="ms-0.5 inline-block animate-pulse" aria-hidden="true">▍</span>
          {/if}
        </Bubble.Content>
      </Bubble.Root>

      {#if showMetaRow}
        <div class="chat-message__meta">
          {#if isAssistant && text && !streaming}
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded transition-colors"
              aria-label="Copy response"
              onclick={() => void copyResponse()}
            >
              <CopyIcon class="size-3" />
            </button>
          {/if}
          {#if timeLabel}
            <time class="text-muted-foreground shrink-0 tabular-nums" datetime={new Date(timestamp!).toISOString()}>
              {timeLabel}
            </time>
          {/if}
        </div>
      {/if}
    </Message.Content>
  </Message.Root>
</MessageScroller.Item>

<style>
  :global(.chat-message--assistant) {
    margin-top: 0.75rem;
  }

  .chat-message__thinking {
    margin-bottom: 0.125rem;
  }

  .chat-thinking-panel {
    padding: 0.125rem 0 0.25rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: color-mix(in oklch, var(--color-muted-foreground) 92%, var(--color-background));
  }

  .chat-message__user-text {
    max-height: min(40vh, 12rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .chat-message__meta {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.375rem;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    line-height: 1;
  }
</style>
