<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Handle, Position } from '@xyflow/svelte';
	import type { Snippet } from 'svelte';

	// Props
	let {
		title = 'Window',
		canResize = true,
		canMinimize = true,
		canMaximize = true,
		canClose = true,
		showStatusBar = false,
		statusInfo = null,
		isMinimized = $bindable(false),
		isMaximized = $bindable(false),
		children,
		onMaximize = null
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
	} = $props();

	const dispatch = createEventDispatcher();

	// Internal state
	let isResizing = $state(false);
	let resizeDirection = $state('');
	let startX = $state(0);
	let startY = $state(0);
	let startWidth = $state(0);
	let startHeight = $state(0);
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

	// Resize functionality
	function startResize(direction: string, event: MouseEvent) {
		if (!canResize) return;

		event.preventDefault();
		event.stopPropagation();

		isResizing = true;
		resizeDirection = direction;
		startX = event.clientX;
		startY = event.clientY;

		const rect = nodeElement.getBoundingClientRect();
		startWidth = rect.width;
		startHeight = rect.height;

		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', stopResize);
		document.body.style.cursor = getCursor(direction);
		document.body.style.userSelect = 'none';
	}

	function handleResize(event: MouseEvent) {
		if (!isResizing) return;

		const deltaX = event.clientX - startX;
		const deltaY = event.clientY - startY;

		let newWidth = startWidth;
		let newHeight = startHeight;

		// Calculate new dimensions based on resize direction
		if (resizeDirection.includes('e')) {
			newWidth = Math.max(200, startWidth + deltaX);
		}
		if (resizeDirection.includes('w')) {
			newWidth = Math.max(200, startWidth - deltaX);
		}
		if (resizeDirection.includes('s')) {
			newHeight = Math.max(150, startHeight + deltaY);
		}
		if (resizeDirection.includes('n')) {
			newHeight = Math.max(150, startHeight - deltaY);
		}

		// Apply the new dimensions to the BaseNode wrapper
		if (nodeElement) {
			nodeElement.style.width = `${newWidth}px`;
			nodeElement.style.height = `${newHeight}px`;

			// Force the parent Svelte Flow node to update its dimensions
			const parentNode = nodeElement.closest('.svelte-flow__node');
			if (parentNode) {
				(parentNode as HTMLElement).style.width = `${newWidth}px`;
				(parentNode as HTMLElement).style.height = `${newHeight}px`;
			}
		}

		dispatch('resize', { width: newWidth, height: newHeight });
	}

	function stopResize() {
		isResizing = false;
		resizeDirection = '';
		document.removeEventListener('mousemove', handleResize);
		document.removeEventListener('mouseup', stopResize);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function getCursor(direction: string): string {
		switch (direction) {
			case 'n':
			case 's':
				return 'ns-resize';
			case 'e':
			case 'w':
				return 'ew-resize';
			case 'ne':
			case 'sw':
				return 'nesw-resize';
			case 'nw':
			case 'se':
				return 'nwse-resize';
			default:
				return 'default';
		}
	}

	// Cleanup on destroy
	function cleanup() {
		if (isResizing) {
			stopResize();
		}
	}

	// Handle double-click on title bar to maximize/restore
	function handleTitleDoubleClick() {
		if (canMaximize) {
			handleMaximize();
		}
	}
</script>

<svelte:window on:beforeunload={cleanup} />

<div
	bind:this={nodeElement}
	class="base-node"
	class:minimized={isMinimized}
	class:maximized={isMaximized}
	class:resizing={isResizing}
>
	<!-- Connection handles for edges -->
	<Handle type="target" position={Position.Top} />
	<Handle type="source" position={Position.Right} />
	<Handle type="target" position={Position.Bottom} />
	<Handle type="source" position={Position.Left} />

	<!-- Title bar -->
	<div class="title-bar drag-handle" ondblclick={handleTitleDoubleClick} role="button" tabindex="0">
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

			{#if canMaximize}
				<button
					class="control-btn maximize-btn"
					onclick={handleMaximize}
					title={isMaximized ? 'Restore' : 'Maximize'}
					aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
				>
					{#if isMaximized}
						<svg width="12" height="12" viewBox="0 0 12 12">
							<rect
								x="2"
								y="2"
								width="6"
								height="6"
								stroke="currentColor"
								stroke-width="1.5"
								fill="none"
							/>
							<rect
								x="4"
								y="4"
								width="6"
								height="6"
								stroke="currentColor"
								stroke-width="1.5"
								fill="none"
							/>
						</svg>
					{:else}
						<svg width="12" height="12" viewBox="0 0 12 12">
							<rect
								x="2"
								y="2"
								width="8"
								height="8"
								stroke="currentColor"
								stroke-width="1.5"
								fill="none"
							/>
						</svg>
					{/if}
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
	<div class="content-area" class:hidden={isMinimized}>
		{@render children?.()}
	</div>

	<!-- Status bar (optional) -->
	{#if showStatusBar && !isMinimized}
		<div class="status-bar">
			<span class="status-text">Ready</span>
		</div>
	{/if}

	<!-- Resize handles -->
	{#if canResize && !isMinimized && !isMaximized}
		<!-- Corners -->
		<div
			class="resize-handle nw"
			onmousedown={(e) => startResize('nw', e)}
			role="button"
			tabindex="-1"
		></div>
		<div
			class="resize-handle ne"
			onmousedown={(e) => startResize('ne', e)}
			role="button"
			tabindex="-1"
		></div>
		<div
			class="resize-handle sw"
			onmousedown={(e) => startResize('sw', e)}
			role="button"
			tabindex="-1"
		></div>
		<div
			class="resize-handle se"
			onmousedown={(e) => startResize('se', e)}
			role="button"
			tabindex="-1"
		></div>

		<!-- Edges -->
		<div
			class="resize-handle n"
			onmousedown={(e) => startResize('n', e)}
			role="button"
			tabindex="-1"
		></div>
		<div
			class="resize-handle s"
			onmousedown={(e) => startResize('s', e)}
			role="button"
			tabindex="-1"
		></div>
		<div
			class="resize-handle e"
			onmousedown={(e) => startResize('e', e)}
			role="button"
			tabindex="-1"
		></div>
		<div
			class="resize-handle w"
			onmousedown={(e) => startResize('w', e)}
			role="button"
			tabindex="-1"
		></div>
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
		overflow: hidden;
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

	.base-node.resizing {
		user-select: none;
		pointer-events: none;
	}

	.base-node.resizing * {
		pointer-events: none;
	}

	.title-bar {
		background: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		padding: 8px 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: move;
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

	.maximize-btn:hover {
		background: #10b981;
		color: white;
	}

	.minimize-btn:hover {
		background: #f59e0b;
		color: white;
	}

	.content-area {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.content-area.hidden {
		display: none;
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

	/* Resize handles */
	.resize-handle {
		position: absolute;
		background: rgba(59, 130, 246, 0.1);
		z-index: 10;
		border: 1px solid rgba(59, 130, 246, 0.2);
		transition: opacity 0.2s ease;
	}

	.resize-handle:hover {
		background: rgba(59, 130, 246, 0.3);
		border: 1px solid rgba(59, 130, 246, 0.5);
	}

	/* Hide resize handles when maximized or minimized */
	.base-node.maximized .resize-handle,
	.base-node.minimized .resize-handle {
		display: none !important;
		opacity: 0;
		pointer-events: none;
	}

	/* Corner handles */
	.resize-handle.nw {
		top: -4px;
		left: -4px;
		width: 8px;
		height: 8px;
		cursor: nw-resize;
	}

	.resize-handle.ne {
		top: -4px;
		right: -4px;
		width: 8px;
		height: 8px;
		cursor: ne-resize;
	}

	.resize-handle.sw {
		bottom: -4px;
		left: -4px;
		width: 8px;
		height: 8px;
		cursor: sw-resize;
	}

	.resize-handle.se {
		bottom: -4px;
		right: -4px;
		width: 8px;
		height: 8px;
		cursor: se-resize;
	}

	/* Edge handles */
	.resize-handle.n {
		top: -4px;
		left: 8px;
		right: 8px;
		height: 8px;
		cursor: n-resize;
	}

	.resize-handle.s {
		bottom: -4px;
		left: 8px;
		right: 8px;
		height: 8px;
		cursor: s-resize;
	}

	.resize-handle.e {
		top: 8px;
		bottom: 8px;
		right: -4px;
		width: 8px;
		cursor: e-resize;
	}

	.resize-handle.w {
		top: 8px;
		bottom: 8px;
		left: -4px;
		width: 8px;
		cursor: w-resize;
	}

	/* Hide resize handles when resizing to prevent interference */
	.base-node.resizing .resize-handle {
		display: none;
	}

	/* SvelteFlow Handle styling */
	:global(.svelte-flow__handle) {
		width: 8px !important;
		height: 8px !important;
		background: var(--color-primary) !important;
		border: 2px solid var(--color-background) !important;
		opacity: 0 !important;
		transition: opacity 0.2s ease !important;
	}

	.base-node:hover :global(.svelte-flow__handle) {
		opacity: 1 !important;
	}

	:global(.svelte-flow__handle:hover) {
		background: var(--color-primary) !important;
		transform: scale(1.2) !important;
	}

	:global(.svelte-flow__handle.connectingfrom) {
		opacity: 1 !important;
	}

	:global(.svelte-flow__handle.valid) {
		background: #10b981 !important;
	}
</style>
