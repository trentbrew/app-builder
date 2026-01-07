<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		EditorView,
		lineNumbers,
		highlightActiveLineGutter,
		highlightSpecialChars,
		drawSelection,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		keymap,
		highlightActiveLine
	} from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import {
		foldGutter,
		indentOnInput,
		bracketMatching,
		syntaxHighlighting,
		defaultHighlightStyle
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { javascript } from '@codemirror/lang-javascript';
	import { oneDark } from '@codemirror/theme-one-dark';
	import BaseNode from './BaseNode.svelte';
	import { Handle, Position } from '@xyflow/svelte';
	import { createEventDispatcher } from 'svelte';

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
			isActiveContent?: boolean;
			onResize?: (width: number, height: number) => void;
			onMaximize?: (isMaximized: boolean) => void;
			sceneCode?: string;
			onSceneCodeChange?: (code: string) => void;
		};
	} = $props();

	const dispatch = createEventDispatcher();

	let isMinimized = $state(false);
	let isMaximized = $state(false);
	let isActiveContent = $state(data.isActiveContent || false);
	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;
	let updateTimeout: ReturnType<typeof setTimeout> | null = null;
	let sceneCode = $state(
		data.sceneCode ||
			`// Motion Canvas Scene
import { makeScene2D } from '@motion-canvas/2d';
import { Circle, Txt } from '@motion-canvas/2d/lib/components';
import { all, createRef } from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();
  const text = createRef<Txt>();

  view.add(
    <>
      <Circle
        ref={circle}
        width={120}
        height={120}
        fill={'#3b82f6'}
        x={-200}
      />
      <Txt
        ref={text}
        text={'Hello Motion Canvas!'}
        fontSize={48}
        fill={'#ffffff'}
        x={200}
      />
    </>
  );

  yield* all(
    circle().position.x(200, 1),
    text().position.x(-200, 1),
  );
});`
	);

	onMount(() => {
		// Initialize CodeMirror
		const state = EditorState.create({
			doc: sceneCode,
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
				javascript(),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const content = update.state.doc.toString();
						sceneCode = content;

						// Throttle updates to prevent too many rapid calls
						if (updateTimeout) {
							clearTimeout(updateTimeout);
						}

						updateTimeout = setTimeout(() => {
							// Dispatch the change to parent
							dispatch('sceneCodeChange', { code: content });
							// Also call the callback if provided
							if (data.onSceneCodeChange) {
								data.onSceneCodeChange(content);
							}
						}, 300); // 300ms throttle
					}
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: editorContainer
		});

		return () => {
			if (editorView) {
				editorView.destroy();
			}
			if (updateTimeout) {
				clearTimeout(updateTimeout);
			}
		};
	});

	// Update editor content when sceneCode changes externally
	$effect(() => {
		if (editorView && data.sceneCode && data.sceneCode !== editorView.state.doc.toString()) {
			const transaction = editorView.state.update({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: data.sceneCode
				}
			});
			editorView.dispatch(transaction);
		}
	});

	// Handle resize
	function handleResize(event: CustomEvent) {
		if (data.onResize) {
			data.onResize(event.detail.width, event.detail.height);
		}
		// Refresh editor layout
		if (editorView) {
			setTimeout(() => {
				editorView.requestMeasure();
			}, 100);
		}
	}

	// Handle maximize
	function handleMaximize(isMaximized: boolean) {
		if (data.onMaximize) {
			data.onMaximize(isMaximized);
		}
	}

	// Save scene function
	function saveScene() {
		// In a real app, this would save to a file or database
		console.log('Saving scene:', sceneCode);
	}

	// Load scene function
	function loadScene() {
		// In a real app, this would load from a file or database
		console.log('Loading scene');
	}
</script>

<BaseNode
	title="Scene Editor"
	bind:isMinimized
	bind:isMaximized
	{isActiveContent}
	onMaximize={handleMaximize}
	on:close={() => console.log('Scene Editor close requested')}
	on:minimize={(e) => console.log('Scene Editor minimize:', e.detail)}
	on:maximize={(e) => handleMaximize(e.detail.isMaximized)}
	on:resize={handleResize}
>
	{#snippet children()}
		<!-- Output handle for scene code -->
		<Handle
			type="source"
			position={Position.Right}
			id="scene-code-output"
			style="background: #10b981; width: 12px; height: 12px; border: 2px solid #059669;"
			title="Scene Code Output"
		/>

		<div class="flex h-full flex-col">
			<!-- Controls -->
			<div class="bg-muted border-border flex items-center justify-between border-b px-3 py-1">
				<span class="text-muted-foreground text-xs">Motion Canvas Scene</span>
				<div class="flex gap-2">
					<button
						class="hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
						title="Save scene"
						onclick={saveScene}
					>
						💾 Save
					</button>
					<button
						class="hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
						title="Load scene"
						onclick={loadScene}
					>
						📁 Load
					</button>
				</div>
			</div>

			<!-- Code Editor -->
			<div bind:this={editorContainer} class="nodrag nowheel flex-1 overflow-hidden"></div>

			<!-- Status -->
			<div class="bg-muted border-border flex items-center justify-between border-t px-3 py-1">
				<span class="text-muted-foreground text-xs"
					>Scene: Ready ({sceneCode.length} characters)</span
				>
				<span class="text-muted-foreground text-xs">Ready</span>
			</div>
		</div>
	{/snippet}
</BaseNode>

<style>
	/* CodeMirror styling overrides */
	:global(.cm-editor) {
		height: 100%;
		font-size: 14px;
	}

	:global(.cm-focused) {
		outline: none;
	}

	:global(.cm-scroller) {
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}
</style>
