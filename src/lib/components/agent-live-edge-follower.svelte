<script lang="ts">
  import { tick } from 'svelte'
  import { useMessageScroller } from '$lib/components/ui/message-scroller/index.js'

  let { busy = false }: { busy?: boolean } = $props()

  const scroller = useMessageScroller()

  let wasBusy = $state(false)

  $effect(() => {
    if (busy && !wasBusy) {
      void tick().then(() => {
        scroller.scrollToEnd({ behavior: 'auto', releaseFollow: false })
      })
    }
    wasBusy = busy
  })
</script>
