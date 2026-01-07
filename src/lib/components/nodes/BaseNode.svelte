<!-- Start of Selection -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Snippet } from 'svelte';

	// Props
	let {
		title = 'Window',
		canResize = false,
		canMinimize = true,
		canMaximize = true,
		canClose = true,
		showStatusBar = false,
		statusInfo = null,
		isMinimized = $bindable(false),
		isMaximized = $bindable(false),
		children,
		onMaximize = null,
		isActiveContent = false
	}: {
		title?: string;
		canResize?: boolean;
		canMinimize?: boolean;
		canMaximize?: boolean;
		canClose?: boolean;
		showStatusBar?: boolean;
		statusInfo?: Array<{ type: string; text: string }> | null;
		isMinimized?: boolean;
		isMaximized?: boolean;
		children?: Snippet;
		onMaximize?: ((isMaximized: boolean) => void) | null;
		isActiveContent?: boolean;
	} = $props();

	const dispatch = createEventDispatcher();

	let nodeElement: HTMLDivElement;

	// Window actions
	function handleClose() {
		dispatch('close');
	}

	function handleMinimize() {
		const newState = !isMinimized;
		isMinimized = newState;
		dispatch('minimize', { isMinimized: newState });
	}

	function handleMaximize() {
		const newState = !isMaximized;
		isMaximized = newState;
		dispatch('maximize', { isMaximized: newState });
		if (onMaximize) {
			onMaximize(newState);
		}
	}

	// Cleanup on destroy (placeholder to keep symmetry)
	function cleanup() {}
</script>

<svelte:window on:beforeunload={cleanup} />

<div
	bind:this={nodeElement}
	class="base-node"
	class:minimized={isMinimized}
	class:maximized={isMaximized}
	role="group"
>
	<!-- Title bar -->
	<div class="title-bar" role="button" tabindex="0" data-handle>
		<div class="title-content">
			<span class="title-text">{title}</span>
			{#if statusInfo}
				<div class="status-indicators">
					{#each statusInfo as status}
						<span
							class="status-indicator"
							class:green={status.type === 'success'}
							class:red={status.type === 'error'}
							class:yellow={status.type === 'warning'}
						>
							<span class="status-dot"></span>
							<span class="status-text">{status.text}</span>
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="window-controls">
			{#if canMinimize}
				<button
					class="control-btn minimize-btn"
					onclick={handleMinimize}
					title="Minimize"
					aria-label="Minimize window"
				>
					<svg width="12" height="12" viewBox="0 0 12 12">
						<rect x="2" y="5" width="8" height="2" fill="currentColor" />
					</svg>
				</button>
			{/if}

			{#if canClose}
				<button
					class="control-btn close-btn"
					onclick={handleClose}
					title="Close"
					aria-label="Close window"
				>
					<svg width="12" height="12" viewBox="0 0 12 12">
						<path
							d="M2 2L10 10M10 2L2 10"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Content area -->
	<div
		class="content-area"
		class:hidden={isMinimized}
		class:inactive={!isActiveContent}
		role="region"
		aria-label="Node content"
		onmousedown={(e) => e.stopPropagation()}
		onwheel={(e) => e.stopPropagation()}
	>
		{@render children?.()}
	</div>

	<!-- Status bar (optional) -->
	{#if showStatusBar && !isMinimized}
		<div class="status-bar">
			<span class="status-text">Ready</span>
		</div>
	{/if}
</div>

<style>
	.base-node {
		position: relative;
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		box-shadow: 0 6px 24px -16px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		overflow: visible;
		min-width: 200px;
		min-height: 150px;
		width: 100%;
		height: 100%;
		transition: box-shadow 0.2s ease;
	}

	.base-node:hover {
		box-shadow: 0 8px 32px -16px rgba(0, 0, 0, 0.6);
	}

	.base-node.maximized {
		position: fixed !important;
		top: 0 !important;
		left: 0 !important;
		width: 100vw !important;
		height: 100vh !important;
		z-index: 1000;
		border-radius: 0;
	}

	.base-node.minimized {
		height: auto !important;
		min-height: auto;
	}

	.title-bar {
		background: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		padding: 8px 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		user-select: none;
		min-height: 36px;
	}

	.title-content {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}

	.title-text {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-indicators {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--color-muted-foreground);
	}

	.status-indicator.green {
		color: #10b981;
	}

	.status-indicator.red {
		color: #ef4444;
	}

	.status-indicator.yellow {
		color: #f59e0b;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	.status-text {
		font-size: 11px;
	}

	.window-controls {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.control-btn {
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--color-muted-foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		padding: 0;
	}

	.control-btn:hover {
		background: var(--color-accent);
		color: var(--color-accent-foreground);
	}

	.close-btn:hover {
		background: #ef4444;
		color: white;
	}

	.minimize-btn:hover {
		background: #f59e0b;
		color: white;
	}

	.content-area {
		flex: 1;
		overflow: auto;
		padding: 8px; /* ample padding so resize handles are easy to click */
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		pointer-events: auto;
		position: relative;
		z-index: 1;
		user-select: text;
	}

	.content-area.inactive {
		/* pointer-events: none; */
	}

	.content-area.hidden {
		/* display: none; */
	}

	.status-bar {
		background: var(--color-muted);
		border-top: 1px solid var(--color-border);
		padding: 4px 12px;
		font-size: 11px;
		color: var(--color-muted-foreground);
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 24px;
	}
</style>
