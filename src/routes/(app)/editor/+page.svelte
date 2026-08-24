<script lang="ts">
	import { webcontainerStore } from '$lib/webcontainerStore';
	import { EditorState } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		foldGutter,
		indentOnInput
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
	import { onMount, untrack } from 'svelte';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import EditorDock from '$lib/components/editor-dock.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import Terminal from '$lib/Terminal.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { toast } from 'svelte-sonner';

	let editorContainer = $state<HTMLDivElement | undefined>();
	let editorView = $state<EditorView | null>(null);
	let loading = $state(false);
	let booting = $state(false);
	let error = $state('');
	let previewUrl = $state('');
	let bootPhase = $state('idle');
	let logs = $state<string[]>([]);
	let logsContainer = $state<HTMLElement | undefined>();
	let userScrolledUp = $state(false);
	let activeFile = $state('/App.svelte');
	let editorContent = $state(initialCode);

	onMount(() => {
		const unsubscribe = webcontainerStore.subscribe((state) => {
			loading = state.loading;
			booting = state.booting;
			error = state.error;
			previewUrl = state.previewUrl;
			bootPhase = state.phase;
			logs = state.logs;
		});

		if (browser) {
			window.addEventListener('message', handleIframeMessage);
			void webcontainerStore.boot();
		}

		return () => {
			unsubscribe();
			if (browser) {
				window.removeEventListener('message', handleIframeMessage);
			}
		};
	});

	const logText = $derived(logs.slice(-80).join('\n') || 'Waiting for server output…');

	const breadcrumbParts = $derived(
		activeFile
			.split('/')
			.filter(Boolean)
			.map((part, index, parts) => ({
				label: part,
				isLast: index === parts.length - 1
			}))
	);

	function isAtBottom(container: HTMLElement) {
		return container.scrollHeight - container.scrollTop - container.clientHeight < 5;
	}

	function handleIframeMessage(event: MessageEvent) {
		if (event.data?.type === 'gamepad') {
			const label = event.data.label ?? 'Controller';
			if (event.data.event === 'connected') {
				toast.success(`${label} connected`);
			} else if (event.data.event === 'disconnected') {
				toast.info(`${label} disconnected`);
			}
			return;
		}

		if (event.data && event.data.type && ['log', 'error', 'warn'].includes(event.data.type)) {
			const prefix = `[iframe-${event.data.type}]`;
			const message = event.data.args
				.map((arg: unknown) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
				.join(' ');
			logs = [...logs, `${prefix} ${message}`];
		}
	}

	$effect(() => {
		const container = editorContainer;
		if (!browser || !container) return;

		const state = EditorState.create({
			doc: untrack(() => editorContent),
			extensions: [
				oneDark,
				EditorView.theme({
					'&': { backgroundColor: 'var(--color-background)' },
					'.cm-scroller': { backgroundColor: 'var(--color-background)' },
					'.cm-content': { backgroundColor: 'var(--color-background)' },
					'.cm-gutters': {
						backgroundColor: 'var(--color-background)',
						color: 'var(--color-muted-foreground)',
						borderRight: '1px solid var(--color-border)'
					},
					'.cm-activeLine': { backgroundColor: 'var(--color-muted)' },
					'.cm-activeLineGutter': { backgroundColor: 'var(--color-muted)' }
				}),
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
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						editorContent = update.state.doc.toString();
					}
				})
			]
		});

		const view = new EditorView({ state, parent: container });
		editorView = view;

		return () => {
			view.destroy();
			editorView = null;
		};
	});

	$effect(() => {
		const container = logsContainer;
		if (!container) return;

		const onScroll = () => {
			userScrolledUp = !isAtBottom(container);
		};
		container.addEventListener('scroll', onScroll, { passive: true });
		return () => container.removeEventListener('scroll', onScroll);
	});

	$effect(() => {
		const container = logsContainer;
		if (!container || userScrolledUp) return;
		logs;
		container.scrollTop = container.scrollHeight;
	});

	function handleFileSelect(path: string, content: string) {
		activeFile = path;
		editorContent = content;
		editorView?.dispatch({
			changes: { from: 0, to: editorView.state.doc.length, insert: content }
		});
	}

	async function handleRun() {
		await webcontainerStore.boot();
		const code = editorView?.state.doc.toString() ?? editorContent;
		const path = activeFile.startsWith('/') ? activeFile : `/${activeFile}`;
		await webcontainerStore.write(path, code);
	}

	async function handleStartPreview() {
		await webcontainerStore.boot();
	}

	const editorTabTitle = $derived(activeFile.split('/').filter(Boolean).at(-1) ?? 'Editor');
</script>

<Sidebar.Provider class="h-full min-h-0">
	<AppSidebar {activeFile} onSelectFile={handleFileSelect} />
	<Sidebar.Inset class="flex min-h-0 flex-col overflow-hidden">
		<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
			<Breadcrumb.Root class="min-w-0 flex-1">
				<Breadcrumb.List>
					{#each breadcrumbParts as part, index (index)}
						{#if index > 0}
							<Breadcrumb.Separator class="hidden md:block" />
						{/if}
						<Breadcrumb.Item class={index < breadcrumbParts.length - 1 ? 'hidden md:block' : ''}>
							{#if part.isLast}
								<Breadcrumb.Page>{part.label}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href="#">{part.label}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
			<Button size="sm" variant="outline" onclick={() => webcontainerStore.reboot()}>Reboot</Button>
			<Button size="sm" onclick={handleRun}>Run</Button>
		</header>

		<div class="flex min-h-0 flex-1 flex-col">
			<EditorDock editorTitle={editorTabTitle}>
				{#snippet editor()}
					<div
						class="editor-panel h-full min-h-0 overflow-hidden"
						bind:this={editorContainer}
					></div>
				{/snippet}
				{#snippet preview()}
					<div class="bg-background relative h-full min-h-0">
						{#if !booting && !loading && !previewUrl && !error}
							<div
								class="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm"
							>
								<p>Starting preview…</p>
								<Button size="sm" variant="outline" onclick={handleStartPreview}
									>Start preview</Button
								>
							</div>
						{:else if loading || booting}
							<div
								class="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm"
							>
								<p>Loading preview…</p>
								<p class="text-foreground/80 text-xs font-medium">{bootPhase}</p>
								<p class="text-xs opacity-75">
									First boot can take 30–60s while npm installs inside WebContainer.
								</p>
							</div>
						{:else if error}
							<div
								class="text-destructive flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm"
							>
								<h3 class="font-medium">Error</h3>
								<p>{error}</p>
							</div>
						{:else}
							<iframe
								src={previewUrl}
								allow="cross-origin-isolated"
								title="Threlte REPL Preview"
								class="absolute inset-0 h-full w-full border-0"
							></iframe>
						{/if}
					</div>
				{/snippet}
				{#snippet logs()}
					<pre
						class="h-full min-h-0 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
						bind:this={logsContainer}>{logText}</pre>
				{/snippet}
				{#snippet terminal()}
					<div class="h-full min-h-0 overflow-hidden">
						{#if booting || previewUrl}
							<Terminal />
						{:else}
							<p class="text-muted-foreground p-3 text-xs">
								Terminal available after preview starts.
							</p>
						{/if}
					</div>
				{/snippet}
			</EditorDock>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<style>
	.editor-panel {
		background-color: var(--color-background);
	}

	:global(.editor-panel .cm-editor) {
		height: 100%;
		background-color: var(--color-background) !important;
	}

	:global(.editor-panel .cm-scroller) {
		overflow: auto;
		background-color: var(--color-background) !important;
	}

	:global(.editor-panel .cm-content) {
		background-color: var(--color-background) !important;
	}

	:global(.editor-panel .cm-gutters) {
		background-color: var(--color-background) !important;
		border-right: 1px solid var(--color-border);
		color: var(--color-muted-foreground);
	}

	:global(.editor-panel .cm-activeLine),
	:global(.editor-panel .cm-activeLineGutter) {
		background-color: var(--color-muted) !important;
	}
</style>
