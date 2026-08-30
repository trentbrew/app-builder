<script lang="ts">
  let { title, description = 'Coming soon.' }: { title: string; description?: string } = $props()
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2 p-6">
  <h1 class="text-lg font-semibold">{title}</h1>
  <p class="text-muted-foreground text-sm">{description}</p>
</div>
