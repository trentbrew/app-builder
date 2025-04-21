<script lang="ts">
	import { onMount } from 'svelte';
	import { WebContainer } from '@webcontainer/api';
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
	import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { lintKeymap } from '@codemirror/lint';
	import { html } from '@codemirror/lang-html';
	import { initialCode } from '$lib/initialCode';

	let editorContainer: HTMLDivElement;
	let iframeContainer: HTMLIFrameElement;
	let webcontainer: WebContainer;
	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			console.log('Attempting to boot WebContainer...');
			// Boot WebContainer
			webcontainer = await WebContainer.boot({ forwardPreviewErrors: true });
			console.log('WebContainer booted:', webcontainer);

			// Mount a minimal project
			console.log('Mounting project files...');
			await webcontainer.mount({
				'package.json': {
					file: {
						contents: JSON.stringify(
							{
								name: 'svelte-repl',
								type: 'module',
								scripts: { dev: 'vite --port 3000 --host 0.0.0.0' },
								dependencies: { svelte: '^5.0.0' },
								devDependencies: {
									vite: '^4.0.0',
									'@sveltejs/vite-plugin-svelte': '^3.0.0'
								}
							},
							null,
							2
						)
					}
				},
				'vite.config.js': {
					file: {
						contents: `import { svelte } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [svelte()] };`
					}
				},
				'index.html': {
					file: {
						contents:
							`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Svelte REPL</title>
</head>
<body>
  <scr` +
							`ipt type="module" src="/main.js"></scr` +
							`ipt>
</body>
</html>`
					}
				},
				'main.js': {
					file: {
						contents: `import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.body });`
					}
				},
				'App.svelte': { file: { contents: initialCode } }
			});

			// Install dependencies
			console.log('Installing dependencies...');
			const install = await webcontainer.spawn('pnpm', ['install']);
			install.output.pipeTo(
				new WritableStream({
					write(data) {
						console.log('[install]', data);
					}
				})
			);
			await install.exit;
			console.log('Dependencies installed');

			// Start dev server
			console.log('Starting dev server...');
			const dev = await webcontainer.spawn('pnpm', ['run', 'dev']);
			dev.output.pipeTo(
				new WritableStream({
					write(data) {
						console.log('[dev server]', data);
					}
				})
			);

			// When the server is ready, point the iframe
			webcontainer.on('server-ready', (port, url) => {
				console.log('Server ready on port', port, 'at', url);
				iframeContainer.src = url;
				loading = false;
			});

			// Initialize CodeMirror editor
			console.log('Initializing editor...');
			const state = EditorState.create({
				doc: initialCode,
				extensions: [
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
						...defaultKeymap,
						...searchKeymap,
						...historyKeymap,
						...lintKeymap,
						indentWithTab
					]),
					html(),
					EditorView.updateListener.of(async (update) => {
						if (update.docChanged) {
							const code = update.state.doc.toString();
							await webcontainer.fs.writeFile('/App.svelte', code);
						}
					})
				]
			});

			new EditorView({
				state,
				parent: editorContainer
			});
			console.log('Editor initialized');
		} catch (e) {
			console.error('Error in WebContainer setup:', e);
			error = e.message || 'An error occurred setting up WebContainer';
			loading = false;
		}
	});
</script>

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
	{/if}
	<iframe bind:this={iframeContainer} title="Svelte REPL Preview" class={loading ? 'hidden' : ''}
	></iframe>
</div>

<style>
	.split {
		display: flex;
		height: 100vh;
		margin: 0;
		padding: 0;
	}
	.editor {
		flex: 1;
		border-right: 1px solid #ddd;
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
</style>
