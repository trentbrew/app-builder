<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import { webcontainerStore } from '$lib/webcontainerStore';
	import { EditorState } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		foldGutter,
		indentOnInput,
		language
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { html } from '@codemirror/lang-html';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { initialCode } from '$lib/initialCode';
	import { browser } from '$app/environment';
	import Terminal from '$lib/Terminal.svelte';

	let editorContainer: HTMLDivElement;
	let loading = true;
	let error = '';
	let previewUrl = '';
	let logs: string[] = [];
	let logsContainer: HTMLDivElement;
	let userScrolledUp = false;
	let listenerAttached = false;

	// Subscribe to the store for loading, error, previewUrl, and logs
	const unsubscribe = webcontainerStore.subscribe((state) => {
		loading = state.loading;
		error = state.error;
		previewUrl = state.previewUrl;
		logs = state.logs;
	});

	// Helper to check if user is at the bottom
	function isAtBottom(container: HTMLDivElement) {
		return container.scrollHeight - container.scrollTop - container.clientHeight < 5;
	}

	// Attach scroll listener to logs container
	function setupLogsScrollListener() {
		if (!logsContainer) return;
		logsContainer.addEventListener('scroll', () => {
			userScrolledUp = !isAtBottom(logsContainer);
		});
	}

	// Listener for messages from the iframe
	function handleIframeMessage(event: MessageEvent) {
		// Optional: Check event.origin for security if needed
		if (event.data && event.data.type && ['log', 'error', 'warn'].includes(event.data.type)) {
			const prefix = `[iframe-${event.data.type}]`;
			const message = event.data.args
				.map((arg: any) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
				.join(' ');
			// Update logs directly here, or could dispatch to the store
			logs = [...logs, `${prefix} ${message}`];

			// After logs update, scroll to bottom if user is not scrolled up
			setTimeout(() => {
				if (logsContainer && !userScrolledUp) {
					logsContainer.scrollTop = logsContainer.scrollHeight;
				}
			}, 0);
		}
	}

	// Auto-scroll console panel after logs update
	afterUpdate(() => {
		// Attach scroll listener once
		if (logsContainer && !listenerAttached) {
			setupLogsScrollListener();
			listenerAttached = true;
		}
		// Auto-scroll if user hasn't scrolled up
		if (logsContainer && !userScrolledUp) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});

	onMount(() => {
		if (browser) window.addEventListener('message', handleIframeMessage);

		console.log('Editor container DOM element:', editorContainer);
		const state = EditorState.create({
			doc: initialCode,
			extensions: [
				oneDark,
				autocompletion(),
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightSpecialChars(),
				history(),
				foldGutter(),
				drawSelection(),
				dropCursor(),
				EditorState.allowMultipleSelections.of(true),
				indentOnInput(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				bracketMatching(),
				closeBrackets(),
				highlightActiveLine(),
				highlightSelectionMatches(),
				keymap.of([
					...closeBracketsKeymap,
					...completionKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					indentWithTab
				]),
				html(),
				EditorView.updateListener.of(async (update) => {
					if (update.docChanged) {
						const code = update.state.doc.toString();
						await webcontainerStore.write('/App.svelte', code);
					}
				})
			]
		});

		new EditorView({ state, parent: editorContainer });
	});

	onDestroy(() => {
		unsubscribe();
		if (browser) window.removeEventListener('message', handleIframeMessage);
	});
</script>

<div class="grid-layout">
	<!-- Code Editor Panel -->
	<div class="panel editor-panel" bind:this={editorContainer}></div>

	<!-- Preview Panel -->
	<div class="panel preview-panel">
		{#if loading}
			<div class="preview-loading">
				<p>Loading preview...</p>
				<p class="hint">This can take 15-30 seconds while dependencies are installed.</p>
			</div>
		{:else if error}
			<div class="preview-error">
				<h3>Error</h3>
				<p>{error}</p>
			</div>
		{:else}
			<iframe src={previewUrl} title="Svelte REPL Preview"></iframe>
		{/if}
	</div>

	<!-- Console Panel -->
	<div class="panel console-panel" bind:this={logsContainer}>
		<pre>{logs.join('\n')}</pre>
	</div>

	<!-- Terminal Panel -->
	<div class="panel terminal-panel">
		<Terminal />
	</div>
</div>

<style>
	/* Main 2x2 grid layout */
	.grid-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		height: 100vh;
		gap: 1px;
	}
	.panel {
		position: relative;
		overflow: hidden;
	}
	.editor-panel {
		background: #282c34;
	}
	.preview-panel iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
	.console-panel {
		background: #222;
		color: #eee;
		padding: 10px;
		font-family: monospace;
		font-size: 0.9em;
		overflow-y: auto;
	}
	.terminal-panel .terminal-container {
		width: 100%;
		height: 100%;
	}
	.hidden {
		display: none;
	}
	.preview-loading,
	.preview-error {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #f9f9f9;
		color: #333;
	}
	.preview-error {
		background: #fff0f0;
		color: #d00;
	}
	.hint {
		font-size: 0.8em;
		color: #777;
	}
</style>
