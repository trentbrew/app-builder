<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { webcontainerStore } from '$lib/webcontainerStore';

	let terminalContainer: HTMLDivElement | null = null;
	let xterm: any | null = null;
	let process: any;
	let unsubscribe: () => void;
	let writer: any;
	let fitAddon: any;
	let resizeObserver: ResizeObserver | null = null;

	// Control bar actions
	function handleClear() {
		xterm?.clear();
	}
	
	function handleRestart() {
		if (process) {
			try {
				process.kill();
			} catch (killError) {
				console.warn('Error killing process:', killError);
			}
			process = null;
		}
		// The process will be respawned on next store update if container exists
		// Optionally, force a store update here if needed
		xterm?.writeln('\r\n[Terminal restarted]\r\n');
	}

	// Defensive fit call: only fit if both xterm and fitAddon are ready and terminalContainer is attached
	function safeFit() {
		// Extra guard: fitAddon._terminal and fitAddon._core should be defined (xterm internals)
		if (xterm && fitAddon && terminalContainer) {
			// xterm.open must have been called and terminalContainer must be in the DOM
			const containerInDom =
				terminalContainer.isConnected &&
				terminalContainer.offsetWidth > 0 &&
				terminalContainer.offsetHeight > 0;
			if (!containerInDom) {
				// Don't attempt fit if container is not visible or not in DOM
				return;
			}
			try {
				// Some xterm versions require fitAddon to be loaded and terminal to be opened
				if (typeof fitAddon.fit === 'function' && xterm.element && xterm.element.isConnected) {
					fitAddon.fit();
				}
			} catch (e) {
				console.warn('fitAddon.fit() failed:', e);
			}
		}
	}

	onMount(() => {
		if (!browser) return;

		(async () => {
			try {
				const { Terminal } = await import('@xterm/xterm');
				const { FitAddon } = await import('@xterm/addon-fit');
				await import('@xterm/xterm/css/xterm.css');

				if (typeof Terminal !== 'function') {
					console.error(
						'Failed to import @xterm/xterm: Terminal is not a function/constructor.',
						Terminal
					);
					return;
				}

				xterm = new Terminal({
					theme: {
						background: '#282c34'
					}
				});
				fitAddon = new FitAddon();
				xterm.loadAddon(fitAddon);

				// Only open the terminal if the container is available
				if (terminalContainer) {
					xterm.open(terminalContainer);
					// Wait for next microtask to ensure DOM is ready before fitting
					Promise.resolve().then(() => safeFit());

					// Observe container size changes, but only if terminalContainer is defined
					resizeObserver = new ResizeObserver(() => {
						safeFit();
					});
					resizeObserver.observe(terminalContainer);
				} else {
					console.error('Terminal container is not available for xterm.');
				}

				// Set up the key listener ONCE after xterm is created
				xterm.onKey(({ key }) => {
					// Only write if the writer is ready
					if (writer) {
						writer.write(key);
					}
				});

				unsubscribe = webcontainerStore.subscribe(async (state) => {
					if (state.container && !process && xterm) {
						const container = state.container;
						try {
							process = await container.spawn('jsh', []);
							container.on('preview-message', (msg: any) => {
								const text = msg.message || (msg.args ? msg.args.join(' ') : JSON.stringify(msg));
								xterm?.writeln(`\x1b[90m[preview]\x1b[0m ${text}`);
							});
							writer = process.input.getWriter();

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
			} catch (importError) {
				console.error('Failed to import or initialize @xterm/xterm:', importError);
			}
		})();
	});

	onDestroy(() => {
		if (resizeObserver && terminalContainer) {
			try {
				resizeObserver.unobserve(terminalContainer);
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

<div class="terminal-outer">
	<div class="terminal-control-bar">
		<span class="terminal-title">Terminal</span>
		<div class="terminal-controls">
			<button class="terminal-btn" title="Clear terminal" on:click={handleClear}>Clear</button>
			<button class="terminal-btn" title="Restart shell" on:click={handleRestart}>Reload</button>
		</div>
	</div>
	<div bind:this={terminalContainer} class="terminal-container"></div>
</div>

<style>
	.terminal-outer {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background: #282c34;
		border-radius: 8px;
		overflow: hidden;
	}
	.terminal-control-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #282c34;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
		color: #eee;
		font-size: 0.95em;
		padding: 0 10px;
		height: 36px;
		user-select: none;
	}
	.terminal-title {
		font-weight: 500;
		letter-spacing: 0.5px;
	}
	.terminal-controls {
		display: flex;
		gap: 6px;
	}
	.terminal-btn {
		background: none;
		border: none;
		color: #bbb;
		font-size: 1.1em;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.terminal-btn:hover {
		background: #333;
		color: #fff;
	}
	.terminal-container {
		padding: 12px;
		width: 100%;
		height: 100%;
		background: #282c34;
		flex: 1 1 0;
		overflow: hidden;
	}
</style>
