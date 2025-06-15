<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { webcontainerStore } from '$lib/webcontainerStore';
	// NOTE: xterm and its addons access browser globals. Only load them on client.
	// They are imported dynamically inside onMount to avoid SSR errors (self is not defined).

	export let data: { label?: string } = {};
	let container: HTMLDivElement | null = null;
	let xterm: any | null = null;
	let fitAddon: any;
	let resizeObserver: ResizeObserver | null = null;
	let unsubscribe: (() => void) | null = null;
	let process: any = null;
	let writer: any = null;

	// Control bar actions
	function handleClear() {
		xterm?.clear();
	}

	function handleRestart() {
		xterm?.clear();
		// Kill existing process and let the store subscription respawn it
		if (process) {
			try {
				process.kill();
				process = null;
			} catch (e) {
				console.warn('Error killing process:', e);
			}
		}
		if (writer) {
			try {
				writer.releaseLock();
				writer = null;
			} catch (e) {
				console.warn('Error releasing writer:', e);
			}
		}
		xterm?.writeln('\r\n[Terminal restarted]\r\n');
	}

	// Defensive fit call
	function safeFit() {
		if (xterm && fitAddon && container) {
			const containerInDom =
				container.isConnected && container.offsetWidth > 0 && container.offsetHeight > 0;
			if (!containerInDom) return;

			try {
				// Check if terminal is properly opened and has dimensions
				if (typeof fitAddon.fit === 'function' && xterm.element && xterm.element.isConnected) {
					// Additional check to ensure terminal has been properly initialized
					const terminalElement = xterm.element.querySelector('.xterm-screen');
					if (terminalElement) {
						fitAddon.fit();
					}
				}
			} catch (e) {
				console.warn('fitAddon.fit() failed:', e);
			}
		}
	}

	onMount(async () => {
		if (!browser) return;

		try {
			// Dynamically import to avoid SSR issues
			const { Terminal } = await import('@xterm/xterm');
			const { FitAddon } = await import('@xterm/addon-fit');
			await import('@xterm/xterm/css/xterm.css');

			xterm = new Terminal({
				fontFamily: 'Menlo, monospace',
				fontSize: 12,
				theme: {
					background: '#282c34',
					foreground: '#d1d5db'
				},
				cursorStyle: 'bar',
				scrollback: 1000,
				allowTransparency: false
			});

			fitAddon = new FitAddon();
			xterm.loadAddon(fitAddon);

			if (container) {
				xterm.open(container);
				// Wait for terminal to be fully rendered before fitting
				setTimeout(() => safeFit(), 200);

				// Auto-scroll to bottom when new content is added
				xterm.onData(() => {
					// Scroll to bottom after a brief delay to ensure content is rendered
					setTimeout(() => {
						xterm.scrollToBottom();
					}, 10);
				});

				// Also auto-scroll when content is written programmatically
				const originalWrite = xterm.write.bind(xterm);
				const originalWriteln = xterm.writeln.bind(xterm);

				xterm.write = (data) => {
					const result = originalWrite(data);
					setTimeout(() => xterm.scrollToBottom(), 10);
					return result;
				};

				xterm.writeln = (data) => {
					const result = originalWriteln(data);
					setTimeout(() => xterm.scrollToBottom(), 10);
					return result;
				};

				// Observe container size changes
				resizeObserver = new ResizeObserver(() => {
					// Debounce resize calls
					setTimeout(() => safeFit(), 100);
				});
				resizeObserver.observe(container);

				// Set up key listener to send input to shell process
				xterm.onKey(({ key }) => {
					// Only write if the writer is ready
					if (writer) {
						writer.write(key);
					}
				});

				// Subscribe to WebContainer store to get shell process
				unsubscribe = webcontainerStore.subscribe(async (state) => {
					if (state.container && !process && xterm) {
						const webContainer = state.container;
						try {
							// Spawn jsh shell process
							process = await webContainer.spawn('jsh', []);

							// Listen for preview messages
							webContainer.on('preview-message', (msg: any) => {
								const text = msg.message || (msg.args ? msg.args.join(' ') : JSON.stringify(msg));
								xterm?.writeln(`\x1b[90m[preview]\x1b[0m ${text}`);
							});

							// Get writer for input
							writer = process.input.getWriter();

							// Pipe shell output to terminal
							process.output.pipeTo(
								new WritableStream({
									write(data) {
										xterm?.write(data);
									}
								})
							);
						} catch (spawnError) {
							console.error('Failed to spawn jsh process:', spawnError);
							xterm?.write('\r\nFailed to start shell.\r\n');
						}
					}
				});
			}
		} catch (error) {
			console.error('Failed to initialize terminal:', error);
		}
	});

	onDestroy(() => {
		if (resizeObserver && container) {
			try {
				resizeObserver.unobserve(container);
			} catch {}
			resizeObserver.disconnect();
		}
		if (unsubscribe) unsubscribe();
		if (writer) {
			try {
				writer.releaseLock();
			} catch {}
		}
		if (process) {
			try {
				process.kill();
			} catch (killError) {
				console.warn('Error killing process:', killError);
			}
		}
		if (xterm) {
			xterm.dispose();
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground border-b px-2 py-1 text-xs font-semibold"
	>
		{data.label ?? 'Terminal'}
	</div>
	<div class="terminal-control-bar">
		<span class="terminal-title">Shell</span>
		<div class="terminal-controls">
			<button class="terminal-btn" title="Clear terminal" on:click={handleClear}>Clear</button>
			<button class="terminal-btn" title="Restart shell" on:click={handleRestart}>Reload</button>
		</div>
	</div>
	<div bind:this={container} class="terminal-container nodrag nowheel cursor-text"></div>
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
