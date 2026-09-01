<script lang="ts">
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import ChatMessage from '$lib/components/chat-message.svelte'
  import ChatStatusMarker from '$lib/components/chat-status-marker.svelte'
  import { getAgentChat } from '$lib/agentChatSessions'
  import { createMessageMetadata, getChatStatusLabel, getMessageReasoning, getMessageText, type ChatMessageMetadata } from '$lib/ai/messages.js'
  import type { UIMessage } from 'ai'

  let {
    sessionId,
    busy = false,
  }: {
    sessionId: string
    busy?: boolean
  } = $props()

  const scroller = MessageScroller.useMessageScroller()
  const chat = $derived(getAgentChat(sessionId))
  const messages = $derived(chat.messages)

  const statusLabel = $derived(getChatStatusLabel(chat.status, messages, busy))

  const showStatusRow = $derived(Boolean(statusLabel))

  function stampAssistantMessage(message: UIMessage) {
    const metadata = message.metadata as ChatMessageMetadata | undefined
    if (typeof metadata?.createdAt === 'number') return

    const index = chat.messages.findIndex((entry) => entry.id === message.id)
    if (index < 0) return

    const existing = chat.messages[index]
    chat.messages[index] = {
      ...existing,
      metadata: createMessageMetadata((existing.metadata ?? {}) as ChatMessageMetadata),
    }
  }

  $effect(() => {
    if (chat.status !== 'streaming' && chat.status !== 'submitted') return
    const last = chat.messages.at(-1)
    if (last?.role === 'assistant') stampAssistantMessage(last)
  })

  $effect(() => {
    if (chat.status !== 'streaming' && chat.status !== 'submitted') return

    const last = messages.at(-1)
    if (!last) return

    getMessageText(last)
    getMessageReasoning(last)

    queueMicrotask(() => scroller.followStreamingOutput())
  })
</script>

<MessageScroller.Root class="h-full min-h-0 flex-1 text-sm">
  <MessageScroller.Viewport>
    <MessageScroller.Content aria-busy={busy} class="gap-2 p-2">
      {#each messages as message (message.id)}
        <ChatMessage {message} chatStatus={chat.status} scrollAnchor={message.role === 'user'} />
      {/each}
      {#if showStatusRow && statusLabel}
        <ChatStatusMarker label={statusLabel} />
      {/if}
    </MessageScroller.Content>
  </MessageScroller.Viewport>
  <MessageScroller.Button />
</MessageScroller.Root>
