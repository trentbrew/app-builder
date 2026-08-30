<script lang="ts">
  import { page } from '$app/state'
  import * as Sidebar from '$lib/components/ui/sidebar/index.js'
  import { cn } from '$lib/utils.js'
  import LayoutGridIcon from '@lucide/svelte/icons/layout-grid'
  import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import UsersIcon from '@lucide/svelte/icons/users'
  import BotIcon from '@lucide/svelte/icons/bot'
  import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3'
  import UserCircleIcon from '@lucide/svelte/icons/user-circle'

  type NavItem = {
    href: string
    label: string
    icon: typeof LayoutGridIcon
  }

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Projects', icon: LayoutGridIcon },
    { href: '/templates', label: 'Templates', icon: LayoutTemplateIcon },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
    { href: '/community', label: 'Community', icon: UsersIcon },
    { href: '/agents', label: 'Agents', icon: BotIcon },
    { href: '/usage', label: 'Usage', icon: BarChart3Icon },
    { href: '/profile', label: 'Profile', icon: UserCircleIcon },
  ]

  function isActive(href: string) {
    if (href === '/dashboard') return page.url.pathname === '/dashboard'
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  }
</script>

<Sidebar.Root
  collapsible="icon"
  variant="inset"
  data-dashboard-sidebar
  class="border-0 bg-transparent [&_[data-sidebar=sidebar]]:bg-transparent"
>
  <Sidebar.Content class="pt-14">
    <Sidebar.Group>
      <Sidebar.GroupLabel class="text-muted-foreground/80">Workspace</Sidebar.GroupLabel>
      <Sidebar.Menu>
        {#each items as item (item.href)}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton isActive={isActive(item.href)} class="dashboard-nav-item">
              {#snippet child({ props })}
                <a
                  {...props}
                  href={item.href}
                  class={cn('dashboard-nav-item__link gap-2', props.class)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  <item.icon class="size-4 shrink-0" />
                  <span>{item.label}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/each}
      </Sidebar.Menu>
    </Sidebar.Group>
  </Sidebar.Content>
</Sidebar.Root>

<style>
  :global([data-dashboard-sidebar] [data-sidebar='menu-button']) {
    background: transparent !important;
    box-shadow: none !important;
  }

  :global([data-dashboard-sidebar] [data-sidebar='menu-button']:hover),
  :global([data-dashboard-sidebar] .dashboard-nav-item__link:hover) {
    background: color-mix(in oklch, var(--color-foreground) 7%, transparent) !important;
  }

  :global([data-dashboard-sidebar] [data-sidebar='menu-button'][data-active='true']) {
    background: color-mix(in oklch, var(--color-foreground) 11%, transparent) !important;
    font-weight: 500;
  }

  :global([data-dashboard-sidebar] [data-slot='sidebar-container']) {
    border-inline-end: none !important;
  }
</style>
