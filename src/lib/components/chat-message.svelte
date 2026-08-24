<script lang="ts">
  import MarkdownView from '$lib/components/markdown-view.svelte'
  import * as Bubble from '$lib/components/ui/bubble/index.js'
  import * as Message from '$lib/components/ui/message/index.js'
  import * as MessageScroller from '$lib/components/ui/message-scroller/index.js'
  import * as Avatar from '$lib/components/ui/avatar/index.js'
  import { getMessageFiles, getMessageText, isMessageStreaming } from '$lib/ai/messages.js'
  import { chat } from '$lib/chat.svelte'
  import { cn } from '$lib/utils.js'
  import type { UIMessage } from 'ai'
  import BotIcon from '@lucide/svelte/icons/bot'
  import FileIcon from '@lucide/svelte/icons/file'
  import UserRoundIcon from '@lucide/svelte/icons/user-round'

  let {
    message,
    scrollAnchor = false,
  }: {
    message: UIMessage
    scrollAnchor?: boolean
  } = $props()

  const align = $derived(message.role === 'user' ? 'end' : 'start')
  const text = $derived(getMessageText(message))
  const files = $derived(getMessageFiles(message))
  const streaming = $derived(isMessageStreaming(message, chat.status))
  const label = $derived(message.role === 'user' ? 'You' : 'Assistant')
  const isUser = $derived(message.role === 'user')
</script>

<MessageScroller.Item messageId={message.id} {scrollAnchor} class="w-full">
  <Message.Root {align}>
    <Message.Avatar>
      <Avatar.Root class="size-7">
        <Avatar.Fallback
          class={cn(
            'text-[0.625rem] font-semibold',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {#if isUser}
            <UserRoundIcon class="size-3.5" />
          {:else}
            <BotIcon class="size-3.5" />
          {/if}
        </Avatar.Fallback>
      </Avatar.Root>
    </Message.Avatar>

    <Message.Content class={cn(isUser && 'items-end')}>
      <Message.Header class={cn(isUser && 'text-end')}>{label}</Message.Header>
      <Bubble.Root class="w-full">
        <Bubble.Content
          class={cn(
            'w-full px-3 py-2',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground border border-border/60',
          )}
        >
          {#if files.length > 0}
            <div class="mb-2 flex flex-col gap-1.5">
              {#each files as file, index (file.url + (file.filename ?? index))}
                <div
                  class={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                    isUser
                      ? 'border-primary-foreground/20 bg-primary-foreground/10'
                      : 'border-border/70 bg-background/40',
                  )}
                >
                  {#if file.mediaType.startsWith('image/')}
                    <img src={file.url} alt={file.filename ?? 'Attachment'} class="size-8 rounded object-cover" />
                  {:else}
                    <FileIcon class="size-3.5 shrink-0 opacity-70" />
                  {/if}
                  <span class="truncate">{file.filename ?? 'Attachment'}</span>
                </div>
              {/each}
            </div>
          {/if}

          {#if text}
            <MarkdownView markdown={text} compact variant={isUser ? 'user' : 'default'} />
          {:else if streaming}
            <span class="text-muted-foreground">Thinking…</span>
          {/if}

          {#if streaming && text}
            <span class="ms-0.5 inline-block animate-pulse" aria-hidden="true">▍</span>
          {/if}
        </Bubble.Content>
      </Bubble.Root>

      {#if message.role === 'assistant' && streaming}
        <Message.Footer>
          <span class="text-muted-foreground text-[0.65rem]">Streaming</span>
        </Message.Footer>
      {/if}
    </Message.Content>
  </Message.Root>
</MessageScroller.Item>
