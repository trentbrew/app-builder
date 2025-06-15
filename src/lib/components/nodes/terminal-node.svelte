<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { codeCanvasState } from '../../../routes/code-canvas/state.svelte';

	// Dynamic imports for browser-only libraries
	let Terminal: any;
	let FitAddon: any;

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
		};
	} = $props();

	let terminalContainer: HTMLDivElement;
	let terminal: any;
	let fitAddon: any;

	onMount(() => {
		if (!browser) return;

		// Initialize terminal asynchronously
		(async () => {
			// Dynamic imports for browser-only libraries
			const [xtermPkg, fitAddonPkg] = await Promise.all([
				import('@xterm/xterm'),
				import('@xterm/addon-fit')
			]);

			Terminal = xtermPkg.Terminal;
			FitAddon = fitAddonPkg.FitAddon;

			// Also import CSS dynamically
			await import('@xterm/xterm/css/xterm.css');

			// Initialize terminal
			terminal = new Terminal({
				theme: {
					background: '#0d1117',
					foreground: '#c9d1d9',
					cursor: '#c9d1d9',
					selection: '#264f78'
				},
				fontSize: 12,
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				cursorBlink: true
			});

			fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);

			terminal.open(terminalContainer);
			fitAddon.fit();

			// Welcome message
			terminal.writeln('Welcome to WebContainer Terminal');
			terminal.writeln('WebContainer status: ' + (codeCanvasState.bootStatus || 'Initializing...'));
			terminal.write('$ ');

			// Handle terminal input
			terminal.onData((data) => {
				if (data === '\r') {
					terminal.writeln('');
					terminal.write('$ ');
				} else if (data === '\u007f') {
					// Backspace
					terminal.write('\b \b');
				} else {
					terminal.write(data);
				}
			});

			// Resize handler
			const resizeObserver = new ResizeObserver(() => {
				fitAddon.fit();
			});
			resizeObserver.observe(terminalContainer);
		})();

		return () => {
			if (terminal) {
				terminal.dispose();
			}
		};
	});

	// Update terminal with WebContainer status changes
	$effect(() => {
		if (browser && terminal && codeCanvasState.bootStatus) {
			// Only show status updates, don't spam the terminal
			if (codeCanvasState.bootStatus === 'Ready' || codeCanvasState.bootStatus.includes('Error')) {
				terminal.writeln(`\r\nWebContainer status: ${codeCanvasState.bootStatus}`);
				terminal.write('$ ');
			}
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-xs font-semibold"
	>
		<div class="flex items-center gap-2">
			<span>{data.label ?? 'Terminal'}</span>
			{#if codeCanvasState.webContainer}
				<span class="inline-flex items-center gap-1 text-green-400">
					<span class="h-2 w-2 rounded-full bg-current"></span>
					<span class="text-xs opacity-75">Connected</span>
				</span>
			{:else}
				<span class="inline-flex items-center gap-1 text-gray-400">
					<span class="h-2 w-2 rounded-full bg-current"></span>
					<span class="text-xs opacity-75">Disconnected</span>
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-1">
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Clear terminal"
				onclick={() => terminal?.clear()}
			>
				Clear
			</button>
		</div>
	</div>
	<div bind:this={terminalContainer} class="nodrag nowheel flex-1 overflow-hidden p-1"></div>
</div>

<style>
	.terminal-control-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #282c34;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		color: #eee;
		font-size: 0.85em;
		padding: 0 8px;
		height: 28px;
		user-select: none;
	}
	.terminal-title {
		font-weight: 500;
		letter-spacing: 0.5px;
	}
	.terminal-controls {
		display: flex;
		gap: 4px;
	}
	.terminal-btn {
		background: none;
		border: none;
		color: #bbb;
		font-size: 0.9em;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 3px;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.terminal-btn:hover {
		background: #333;
		color: #fff;
	}
	.terminal-container {
		padding: 8px;
		width: 100%;
		height: 100%;
		background: #282c34;
		flex: 1 1 0;
		overflow: auto;
		position: relative;
	}
	:global(.xterm .xterm-screen) {
		padding: 4px;
	}
</style>
