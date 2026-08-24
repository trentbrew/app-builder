<script lang="ts">
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import ChatMessage from '$lib/components/chat-message.svelte'
  import { chat } from '$lib/chat.svelte'

  let {
    busy = false,
  }: {
    busy?: boolean
  } = $props()

  const messages = $derived(chat.messages)
</script>

<MessageScroller.Root class="h-full min-h-0 flex-1">
  <MessageScroller.Viewport>
    <MessageScroller.Content aria-busy={busy} class="gap-4 p-3">
      {#each messages as message (message.id)}
        <ChatMessage {message} scrollAnchor={message.role === 'user'} />
      {/each}
    </MessageScroller.Content>
  </MessageScroller.Viewport>
  <MessageScroller.Button />
</MessageScroller.Root>
