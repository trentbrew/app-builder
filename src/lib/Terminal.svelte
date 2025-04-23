<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { webcontainerStore } from '$lib/webcontainerStore';

	let terminalContainer: HTMLDivElement;
	let xterm: any | null = null;
	let process: any;
	let unsubscribe: () => void;
	// Persistent writer for process input
	let writer: any;

	onMount(() => {
		if (!browser) return;

		(async () => {
			try {
				// Dynamically import @xterm/xterm
				const { Terminal } = await import('@xterm/xterm');
				await import('@xterm/xterm/css/xterm.css');

				if (typeof Terminal !== 'function') {
					console.error(
						'Failed to import @xterm/xterm: Terminal is not a function/constructor.',
						Terminal
					);
					return;
				}

				xterm = new Terminal({
					// Add some basic options if needed
					// cursorBlink: true,
					// theme: { background: '#1e1e1e' }
				});
				xterm.open(terminalContainer);

				unsubscribe = webcontainerStore.subscribe(async (state) => {
					if (state.container && !process && xterm) {
						const container = state.container;
						try {
							// Use jsh (WebContainer's shell) instead of bash for better compatibility
							process = await container.spawn('jsh', []);
							// Get a single writer for the input stream
							writer = process.input.getWriter();

							// Pipe process output to xterm
							process.output.pipeTo(
								new WritableStream({
									write(data) {
										xterm?.write(data);
									}
								})
							);
							// Pipe xterm input to process via the persistent writer
							xterm.onData((data: string) => {
								writer.write(data);
							});

							// Optional: Focus the terminal on load
							// setTimeout(() => xterm?.focus(), 100);
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
