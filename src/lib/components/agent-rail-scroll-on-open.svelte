<script lang="ts">
  import { tick } from 'svelte'
  import { useMessageScroller } from '$lib/components/ui/message-scroller/index.js'

  let { open }: { open: boolean } = $props()

  const scroller = useMessageScroller()

  $effect(() => {
    if (!open) return
    void tick().then(() => {
      scroller.scrollToEnd({ behavior: 'auto' })
    })
  })
</script>
