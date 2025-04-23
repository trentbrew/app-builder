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

	// Defensive fit call: only fit if both xterm and fitAddon are ready and terminalContainer is attached
	function safeFit() {
		if (xterm && fitAddon && terminalContainer) {
			try {
				fitAddon.fit();
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

				xterm = new Terminal();
				fitAddon = new FitAddon();
				xterm.loadAddon(fitAddon);

				// Only open the terminal if the container is available
				if (terminalContainer) {
					xterm.open(terminalContainer);
					safeFit();

					// Observe container size changes, but only if terminalContainer is defined
					resizeObserver = new ResizeObserver(() => {
						safeFit();
					});
					resizeObserver.observe(terminalContainer);
				} else {
					console.error('Terminal container is not available for xterm.');
				}

				unsubscribe = webcontainerStore.subscribe(async (state) => {
					if (state.container && !process && xterm) {
						const container = state.container;
						try {
							process = await container.spawn('jsh', []);
							container.on('preview-message', (msg: any) => {
								const text = msg.message || (msg.args ? msg.args.join(' ') : JSON.stringify(msg));
								xterm?.writeln(`[90m[preview][0m ${text}`);
							});
							writer = process.input.getWriter();

							process.output.pipeTo(
								new WritableStream({
									write(data) {
										xterm?.write(data);
									}
								})
							);
							xterm.onData((data: string) => {
								writer.write(data);
							});
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

<div bind:this={terminalContainer} class="terminal-container"></div>

<style>
	.terminal-container {
		width: 100%;
		height: 100%;
		background-color: #000;
	}
</style>
