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

<div class="editor-layout">
	<div class="split">
		<div bind:this={editorContainer} class="editor"></div>
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
			<iframe src={previewUrl} title="Svelte REPL Preview" class={loading ? 'hidden' : ''}></iframe>
		{/if}
	</div>
	{#if logs.length > 0}
		<div bind:this={logsContainer} class="console-panel">
			<pre>{logs.join('\n')}</pre>
		</div>
	{/if}
</div>

<style>
	/* Make the main layout a column flex filling the viewport */
	.editor-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.split {
		display: flex;
		flex: 1; /* Take available vertical space */
		min-height: 0;
		margin: 0;
		padding: 0;
	}

	.editor {
		flex: 1;
		background: #282c34;
		min-width: 0; /* Prevent shrinking */
		border-right: 1px solid #ddd;
		overflow: auto;
	}
	iframe {
		flex: 1;
		border: none;
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
	.console-panel {
		height: 200px;
		overflow-y: scroll;
		background: #222;
		color: #eee;
		padding: 10px;
		font-family: monospace;
		font-size: 0.9em;
		border-top: 1px solid #444;
	}
	.console-panel pre {
		margin: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>
