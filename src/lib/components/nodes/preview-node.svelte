<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { codeCanvasState, codeCanvasActions } from '../../../routes/code-canvas/state.svelte';

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
		};
	} = $props();

	let iframeElement: HTMLIFrameElement | null = $state(null);
	let iframeLoaded = $state(false);
	let showConsole = $state(false);
	let isFullscreen = $state(false);
	let showDetails = $state(false);

	// Format time since last activity
	function getTimeSinceActivity() {
		if (!codeCanvasState.lastActivity) return '';
		const now = new Date();
		const diff = now.getTime() - codeCanvasState.lastActivity.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s ago`;
		}
		return `${seconds}s ago`;
	}

	// Get overall status color based on boot and build status
	function getOverallStatusColor() {
		if (codeCanvasState.webContainerError) return 'text-red-400';
		if (
			codeCanvasState.bootStatus?.includes('Error') ||
			codeCanvasState.buildStatus?.includes('Error')
		)
			return 'text-red-400';
		if (codeCanvasState.bootStatus === 'Ready' && codeCanvasState.buildStatus === 'Ready')
			return 'text-green-400';
		if (codeCanvasState.bootStatus === 'Ready' && codeCanvasState.buildStatus === 'Building...')
			return 'text-yellow-400';
		if (
			codeCanvasState.bootStatus?.includes('Installing') ||
			codeCanvasState.buildStatus?.includes('Installing')
		)
			return 'text-blue-400';
		return 'text-blue-400';
	}

	// Get overall status text
	function getOverallStatus() {
		if (codeCanvasState.webContainerError) return 'Error';
		if (
			codeCanvasState.bootStatus?.includes('Error') ||
			codeCanvasState.buildStatus?.includes('Error')
		)
			return 'Error';
		if (codeCanvasState.bootStatus === 'Ready' && codeCanvasState.buildStatus === 'Ready')
			return 'Ready';
		if (codeCanvasState.bootStatus === 'Ready' && codeCanvasState.buildStatus === 'Building...')
			return 'Building...';
		if (codeCanvasState.installProgress && codeCanvasState.installProgress.total > 0) {
			return `Installing... (${codeCanvasState.installProgress.current}/${codeCanvasState.installProgress.total})`;
		}
		return codeCanvasState.bootStatus || 'Initializing...';
	}

	// Handle iframe load
	function handleIframeLoad() {
		iframeLoaded = true;

		// Set up console message listener
		if (iframeElement?.contentWindow) {
			try {
				// Override console methods in iframe
				const iframe = iframeElement.contentWindow as any;
				const originalConsole = iframe.console;

				iframe.console = {
					...originalConsole,
					log: (...args: any[]) => {
						originalConsole.log(...args);
						codeCanvasActions.addConsoleMessage(
							'log',
							args
								.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
								.join(' ')
						);
					},
					error: (...args: any[]) => {
						originalConsole.error(...args);
						codeCanvasActions.addConsoleMessage(
							'error',
							args
								.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
								.join(' ')
						);
					},
					warn: (...args: any[]) => {
						originalConsole.warn(...args);
						codeCanvasActions.addConsoleMessage(
							'warn',
							args
								.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
								.join(' ')
						);
					}
				};
			} catch (e) {
				// Cross-origin restrictions might prevent this
				console.log('Could not override iframe console due to cross-origin restrictions');
			}
		}
	}

	// Handle iframe error
	function handleIframeError() {
		iframeLoaded = false;
		codeCanvasActions.addConsoleMessage('error', 'Failed to load preview');
	}

	// Toggle fullscreen
	function toggleFullscreen() {
		isFullscreen = !isFullscreen;
	}

	// Format timestamp
	function formatTime(date: Date) {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<div
	class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border"
	class:fixed={isFullscreen}
	class:inset-0={isFullscreen}
	class:z-50={isFullscreen}
>
	<div
		class="drag-handle border-border bg-muted text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-xs font-semibold"
	>
		<div class="flex items-center gap-2">
			<span>{data.label ?? 'Preview'}</span>
			<span class="inline-flex items-center gap-1 {getOverallStatusColor()}">
				<span class="h-2 w-2 rounded-full bg-current"></span>
				<span class="text-xs opacity-75">{getOverallStatus()}</span>
			</span>
		</div>
		<div class="flex items-center gap-1">
			{#if codeCanvasState.lastActivity}
				<span class="text-xs opacity-50">
					{getTimeSinceActivity()}
				</span>
			{/if}
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Toggle details"
				onclick={() => (showDetails = !showDetails)}
			>
				{showDetails ? '📊' : '📈'}
			</button>
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Toggle console"
				onclick={() => (showConsole = !showConsole)}
			>
				🖥️
			</button>
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Refresh preview"
				onclick={codeCanvasActions.refreshPreview}
			>
				🔄
			</button>
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Reboot WebContainer"
				onclick={codeCanvasActions.rebootWebContainer}
			>
				🔥
			</button>
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Toggle fullscreen"
				onclick={toggleFullscreen}
			>
				{isFullscreen ? '🗗' : '🗖'}
			</button>
		</div>
	</div>

	<!-- Detailed status panel -->
	{#if showDetails}
		<div class="border-border bg-muted/30 space-y-1 border-b px-2 py-2 text-xs">
			<div class="flex items-center justify-between">
				<span class="font-medium">Boot Status:</span>
				<span
					class={codeCanvasState.bootStatus?.includes('Error')
						? 'text-red-400'
						: codeCanvasState.bootStatus === 'Ready'
							? 'text-green-400'
							: 'text-blue-400'}
				>
					{codeCanvasState.bootStatus || 'Initializing...'}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="font-medium">Build Status:</span>
				<span
					class={codeCanvasState.buildStatus?.includes('Error')
						? 'text-red-400'
						: codeCanvasState.buildStatus === 'Ready'
							? 'text-green-400'
							: 'text-blue-400'}
				>
					{codeCanvasState.buildStatus || 'Waiting...'}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="font-medium">URL Ready:</span>
				<span class={codeCanvasState.previewUrl ? 'text-green-400' : 'text-gray-400'}>
					{codeCanvasState.previewUrl ? 'Yes' : 'No'}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="font-medium">Iframe State:</span>
				<span class={iframeLoaded ? 'text-green-400' : 'text-gray-400'}>
					{iframeLoaded ? 'Loaded' : 'Loading...'}
				</span>
			</div>
			{#if codeCanvasState.installProgress && codeCanvasState.installProgress.total > 0}
				<div class="space-y-1">
					<div class="flex items-center justify-between">
						<span class="font-medium">Installing:</span>
						<span class="text-blue-400"
							>{codeCanvasState.installProgress.current}/{codeCanvasState.installProgress
								.total}</span
						>
					</div>
					{#if codeCanvasState.installProgress.currentPackage}
						<div class="text-muted-foreground truncate text-xs">
							{codeCanvasState.installProgress.currentPackage}
						</div>
					{/if}
					<div class="bg-muted h-1 w-full rounded-full">
						<div
							class="h-1 rounded-full bg-blue-400 transition-all duration-300"
							style="width: {(codeCanvasState.installProgress.current /
								codeCanvasState.installProgress.total) *
								100}%"
						></div>
					</div>
				</div>
			{/if}
			{#if codeCanvasState.webContainerError}
				<div class="text-xs text-red-400">
					Error: {codeCanvasState.webContainerError}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Console panel -->
	{#if showConsole}
		<div class="border-border bg-muted/20 max-h-32 overflow-y-auto border-b">
			<div class="border-border flex items-center justify-between border-b px-2 py-1">
				<span class="text-xs font-medium">Console</span>
				<button
					class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
					onclick={codeCanvasActions.clearConsoleMessages}
				>
					Clear
				</button>
			</div>
			<div class="space-y-1 p-2 font-mono text-xs">
				{#if codeCanvasState.consoleMessages.length === 0}
					<div class="text-muted-foreground italic">No console messages...</div>
				{:else}
					{#each codeCanvasState.consoleMessages as msg}
						<div class="flex gap-2">
							<span class="text-muted-foreground text-xs">{formatTime(msg.timestamp)}</span>
							<span
								class="flex-1"
								class:text-red-400={msg.type === 'error'}
								class:text-yellow-400={msg.type === 'warn'}
								class:text-blue-400={msg.type === 'log'}
							>
								{msg.message}
							</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-hidden">
		{#if codeCanvasState.loading}
			<div class="flex h-full items-center justify-center">
				<div class="space-y-2 text-center">
					<div
						class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
					></div>
					<div class="text-muted-foreground text-sm">
						{#if codeCanvasState.bootStatus}
							{codeCanvasState.bootStatus}
						{:else}
							Loading preview...
						{/if}
					</div>
					{#if codeCanvasState.installProgress}
						<div class="w-64 space-y-2">
							<div class="text-center text-xs">
								Installing dependencies ({codeCanvasState.installProgress.current}/{codeCanvasState
									.installProgress.total})
							</div>
							<div class="bg-muted h-2 w-full rounded-full">
								<div
									class="bg-primary h-2 rounded-full transition-all duration-300"
									style="width: {(codeCanvasState.installProgress.current /
										codeCanvasState.installProgress.total) *
										100}%"
								></div>
							</div>
							{#if codeCanvasState.installProgress.currentPackage}
								<div class="text-center text-xs opacity-75">
									{codeCanvasState.installProgress.currentPackage}
								</div>
							{/if}
						</div>
					{:else}
						<p class="text-xs opacity-70">
							This can take 15-30 seconds while dependencies are installed.
						</p>
					{/if}
					{#if codeCanvasState.lastActivity}
						<div class="text-xs opacity-50">
							Last activity: {getTimeSinceActivity()}
						</div>
					{/if}
				</div>
			</div>
		{:else if codeCanvasState.error || codeCanvasState.webContainerError}
			<div class="flex h-full items-center justify-center">
				<div class="space-y-2 text-center">
					<div class="text-red-400">
						<div class="mb-2 text-lg">❌</div>
						<div class="font-semibold">Preview Error</div>
						<div class="mt-2 max-w-md text-xs break-words">
							{codeCanvasState.error || codeCanvasState.webContainerError}
						</div>
					</div>
					<div class="flex gap-2">
						<button
							class="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1 text-xs"
							onclick={codeCanvasActions.refreshPreview}
						>
							🔄 Retry
						</button>
						<button
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded px-3 py-1 text-xs"
							onclick={codeCanvasActions.rebootWebContainer}
						>
							🔥 Reboot
						</button>
					</div>
				</div>
			</div>
		{:else if codeCanvasState.previewUrl}
			{#if !iframeLoaded}
				<div class="flex h-full items-center justify-center">
					<div class="space-y-2 text-center">
						<div
							class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
						></div>
						<div class="text-muted-foreground text-sm">
							Loading iframe...
							<br />
							<span class="text-xs opacity-75">This usually takes 15-30 seconds</span>
						</div>
					</div>
				</div>
			{/if}
			<iframe
				bind:this={iframeElement}
				src={codeCanvasState.previewUrl}
				class="h-full w-full border-0"
				class:hidden={!iframeLoaded}
				onload={handleIframeLoad}
				onerror={handleIframeError}
				title="Preview"
			></iframe>
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="space-y-2 text-center">
					<div
						class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
					></div>
					<div class="text-muted-foreground text-sm">
						Starting WebContainer...
						<br />
						<span class="text-xs opacity-75">This usually takes 15-30 seconds</span>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
