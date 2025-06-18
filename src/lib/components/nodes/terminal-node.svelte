<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { codeCanvasState } from '../../../routes/code-canvas/state.svelte';
	import BaseNode from './BaseNode.svelte';

	// Dynamic imports for browser-only libraries
	let Terminal: any;
	let FitAddon: any;

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
			onResize?: (width: number, height: number) => void;
		};
	} = $props();

	let terminalContainer: HTMLDivElement;
	let terminal: any;
	let fitAddon: any;
	let initializationError = $state<string | null>(null);
	let isInitialized = $state(false);
	let isMinimized = $state(false);
	let isMaximized = $state(false);

	// Status info for BaseNode
	let statusInfo = $derived([
		...(initializationError
			? [{ type: 'error', text: 'Error' }]
			: isInitialized
				? [{ type: 'success', text: 'Ready' }]
				: [{ type: 'warning', text: 'Loading...' }]),
		...(codeCanvasState.webContainer
			? [{ type: 'success', text: 'WebContainer Connected' }]
			: [{ type: 'warning', text: 'WebContainer Disconnected' }])
	]);

	onMount(() => {
		if (!browser) return;

		console.log('🔧 Terminal: Starting initialization...');

		// Set a timeout to show fallback if initialization takes too long
		const initTimeout = setTimeout(() => {
			if (!isInitialized && terminalContainer) {
				console.warn('⏰ Terminal: Initialization timeout, using fallback...');
				createFallbackTerminal();
			}
		}, 5000);

		// Initialize terminal asynchronously
		(async () => {
			try {
				console.log('📦 Terminal: Loading xterm packages...');

				// Dynamic imports for browser-only libraries
				const [xtermPkg, fitAddonPkg] = await Promise.all([
					import('@xterm/xterm'),
					import('@xterm/addon-fit')
				]);

				Terminal = xtermPkg.Terminal;
				FitAddon = fitAddonPkg.FitAddon;

				console.log('🎨 Terminal: Loading CSS...');
				// Also import CSS dynamically
				await import('@xterm/xterm/css/xterm.css');

				console.log('⚙️ Terminal: Creating terminal instance...');
				// Initialize terminal
				terminal = new Terminal({
					theme: {
						background: '#0d1117',
						foreground: '#c9d1d9',
						cursor: '#c9d1d9',
						selection: '#264f78',
						black: '#0d1117',
						red: '#ff6b6b',
						green: '#51cf66',
						yellow: '#ffd43b',
						blue: '#74c0fc',
						magenta: '#f06292',
						cyan: '#4dd0e1',
						white: '#c9d1d9',
						brightBlack: '#495057',
						brightRed: '#ff8a80',
						brightGreen: '#69f0ae',
						brightYellow: '#ffff8d',
						brightBlue: '#82b1ff',
						brightMagenta: '#ff80ab',
						brightCyan: '#84ffff',
						brightWhite: '#ffffff'
					},
					fontSize: 14,
					fontFamily: 'Menlo, Monaco, "Courier New", monospace',
					cursorBlink: true,
					allowTransparency: false,
					convertEol: true,
					rows: 24,
					cols: 80
				});

				console.log('🔌 Terminal: Loading fit addon...');
				fitAddon = new FitAddon();
				terminal.loadAddon(fitAddon);

				console.log('🖥️ Terminal: Opening terminal in container...');
				if (!terminalContainer) {
					throw new Error('Terminal container not available');
				}

				terminal.open(terminalContainer);

				console.log('📏 Terminal: Fitting terminal to container...');
				// Wait a moment for the terminal to be ready, then fit and show content
				setTimeout(() => {
					try {
						// Try to fit, but handle the scrollBarWidth error gracefully
						try {
							fitAddon.fit();
							console.log('✅ Terminal: Fit completed');
						} catch (fitError) {
							console.warn('⚠️ Terminal: Fit failed, continuing without fit:', fitError);
							// Continue without fitting - the terminal will still work
						}

						// Welcome message with explicit styling
						terminal.writeln('\x1b[32m=== WebContainer Terminal ===\x1b[0m');
						terminal.writeln('');
						terminal.writeln(
							'WebContainer status: ' + (codeCanvasState.bootStatus || 'Initializing...')
						);
						terminal.writeln('');
						terminal.write('\x1b[36m$ \x1b[0m');

						isInitialized = true;
						clearTimeout(initTimeout);
						console.log('🎉 Terminal: Initialization complete!');
					} catch (generalError) {
						console.error('❌ Terminal: General error during initialization:', generalError);
						initializationError = `Initialization error: ${generalError}`;
					}
				}, 200);

				// Handle terminal input
				terminal.onData((data) => {
					if (data === '\r') {
						terminal.writeln('');
						terminal.write('\x1b[36m$ \x1b[0m');
					} else if (data === '\u007f') {
						// Backspace
						terminal.write('\b \b');
					} else {
						terminal.write(data);
					}
				});

				// Resize handler with error handling
				const resizeObserver = new ResizeObserver(() => {
					try {
						if (fitAddon && terminal && terminalContainer && isInitialized) {
							// Add a small delay to ensure the container is properly sized
							setTimeout(() => {
								try {
									fitAddon.fit();
								} catch (fitError) {
									console.warn('⚠️ Terminal: Resize fit error (ignoring):', fitError);
									// Ignore fit errors during resize - they're usually temporary
								}
							}, 100);
						}
					} catch (resizeError) {
						console.warn('⚠️ Terminal: Resize error:', resizeError);
					}
				});

				if (terminalContainer) {
					resizeObserver.observe(terminalContainer);
				}
			} catch (error) {
				console.error('❌ Terminal: Initialization failed:', error);
				initializationError = error instanceof Error ? error.message : String(error);

				// Try fallback terminal after a short delay
				setTimeout(() => {
					if (!isInitialized && terminalContainer) {
						console.log('🔄 Terminal: Attempting fallback...');
						clearTimeout(initTimeout);
						createFallbackTerminal();
					}
				}, 500);
			}
		})();

		return () => {
			console.log('🧹 Terminal: Cleaning up...');
			if (terminal) {
				terminal.dispose();
			}
		};
	});

	// Update terminal with WebContainer status changes
	$effect(() => {
		if (browser && terminal && codeCanvasState.bootStatus && isInitialized) {
			// Only show status updates, don't spam the terminal
			if (codeCanvasState.bootStatus === 'Ready' || codeCanvasState.bootStatus.includes('Error')) {
				terminal.writeln(`\r\n\x1b[33mWebContainer status: ${codeCanvasState.bootStatus}\x1b[0m`);
				terminal.write('\x1b[36m$ \x1b[0m');
			}
		}
	});

	// Function to manually reinitialize terminal
	function reinitializeTerminal() {
		console.log('🔄 Terminal: Manual reinitialization requested...');
		initializationError = null;
		isInitialized = false;

		if (terminal) {
			terminal.dispose();
			terminal = null;
		}

		// Trigger remount
		setTimeout(() => {
			window.location.reload();
		}, 100);
	}

	// Fallback terminal implementation
	function createFallbackTerminal() {
		console.log('🔧 Terminal: Creating fallback terminal...');
		const fallbackElement = terminalContainer;
		if (fallbackElement) {
			fallbackElement.innerHTML = `
				<div style="
					background: #0d1117;
					color: #c9d1d9;
					font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
					font-size: 14px;
					padding: 16px;
					height: 100%;
					overflow-y: auto;
					white-space: pre-wrap;
				">
=== WebContainer Terminal (Fallback Mode) ===

WebContainer status: ${codeCanvasState.bootStatus || 'Initializing...'}

This is a fallback terminal. XTerm failed to load.
Check the browser console for more details.

$ <span style="animation: blink 1s infinite;">_</span>
				</div>
				<style>
					@keyframes blink {
						0%, 50% { opacity: 1; }
						51%, 100% { opacity: 0; }
					}
				</style>
			`;
			isInitialized = true;
		}
	}
</script>

<BaseNode
	title={data.label ?? 'Terminal'}
	bind:isMinimized
	bind:isMaximized
	{statusInfo}
	on:close={() => console.log('Terminal close requested')}
	on:minimize={(e) => console.log('Terminal minimize:', e.detail)}
	on:maximize={(e) => console.log('Terminal maximize:', e.detail)}
	on:resize={(e) => {
		// Handle resize - fit terminal to new size
		if (fitAddon && terminal && isInitialized) {
			setTimeout(() => {
				try {
					fitAddon.fit();
				} catch (error) {
					console.warn('Terminal resize fit error:', error);
				}
			}, 100);
		}
		// Notify parent about resize
		if (data.onResize) {
			data.onResize(e.detail.width, e.detail.height);
		}
	}}
>
	{#snippet children()}
		{#if initializationError}
			<div class="flex flex-1 items-center justify-center p-4">
				<div class="text-center">
					<div class="mb-2 text-red-400">❌ Terminal initialization failed</div>
					<div class="text-muted-foreground mb-4 text-xs">{initializationError}</div>
					<div class="flex justify-center gap-2">
						<button
							class="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
							onclick={reinitializeTerminal}
						>
							🔄 Retry Initialization
						</button>
						{#if terminal}
							<button
								class="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
								onclick={() => terminal?.clear()}
							>
								Clear Terminal
							</button>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div bind:this={terminalContainer} class="nodrag nowheel terminal-wrapper flex-1"></div>
		{/if}
	{/snippet}
</BaseNode>

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
	.terminal-wrapper {
		background: #0d1117 !important;
		width: 100%;
		height: 100%;
		flex: 1 1 0;
		overflow: hidden;
		position: relative;
	}

	/* Ensure xterm terminal text is visible */
	:global(.terminal-wrapper .xterm) {
		background: #0d1117 !important;
		color: #c9d1d9 !important;
		font-size: 14px !important;
	}

	:global(.terminal-wrapper .xterm .xterm-screen) {
		background: #0d1117 !important;
		color: #c9d1d9 !important;
	}

	:global(.terminal-wrapper .xterm .xterm-rows) {
		color: #c9d1d9 !important;
	}

	:global(.terminal-wrapper .xterm .xterm-viewport) {
		background: #0d1117 !important;
	}

	:global(.terminal-wrapper .xterm-cursor-layer .xterm-cursor) {
		background: #c9d1d9 !important;
		color: #0d1117 !important;
	}

	:global(.terminal-wrapper .xterm .xterm-char-measure-element) {
		color: #c9d1d9 !important;
	}
</style>
