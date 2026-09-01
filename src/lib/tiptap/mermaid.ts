import { Node, mergeAttributes } from '@tiptap/core';
import { renderMermaidDiagram } from '$lib/mermaid/render';
import { openMermaidDialog } from '$lib/mermaid/blockElement';
import { saveTextToWorkspace } from '$lib/fileOps';

const EXPAND_ICON =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';

export const Mermaid = Node.create({
	name: 'mermaid',
	group: 'block',
	atom: true,
	defining: true,
	isolating: true,
	priority: 1000,

	markdownTokenName: 'code' as never,

	addAttributes() {
		return {
			source: {
				default: 'graph TD\n  A[Start] --> B[End]',
				parseHTML: (el) => el.getAttribute('data-source') ?? el.textContent ?? '',
				renderHTML: (attrs) => ({ 'data-source': attrs.source })
			}
		};
	},

	parseMarkdown(token: { lang?: string; text?: string }) {
		if ((token.lang ?? '').toLowerCase() !== 'mermaid') return [] as never;
		const text = token.text?.trim() || 'graph TD\n  A[Start] --> B[End]';
		return {
			type: 'mermaid',
			attrs: { source: text }
		};
	},

	renderMarkdown(node: { attrs?: { source?: string } }) {
		const source = node.attrs?.source ?? '';
		return `\`\`\`mermaid\n${source}\n\`\`\`\n`;
	},

	parseHTML() {
		return [{ tag: 'div[data-mermaid]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, { 'data-mermaid': '', class: 'mermaid-block' })
		];
	},

	addNodeView() {
		return ({ node }) => {
			const dom = document.createElement('div');
			dom.className = 'mermaid-block';
			dom.dataset.mermaid = '';

			const header = document.createElement('div');
			header.className = 'mermaid-block__header';

			const expand = document.createElement('button');
			expand.type = 'button';
			expand.className = 'mermaid-block__expand';
			expand.setAttribute('aria-label', 'View diagram');
			expand.innerHTML = EXPAND_ICON;
			header.append(expand);

			const diagram = document.createElement('div');
			diagram.className = 'mermaid-block__diagram';

			const actions = document.createElement('div');
			actions.className = 'markdown-block-actions';

			const save = document.createElement('button');
			save.type = 'button';
			save.className = 'markdown-block-action';
			save.textContent = 'Add to workspace';
			actions.append(save);

			dom.append(header, diagram, actions);

			let currentSource = node.attrs.source as string;

			const render = () => void renderMermaidDiagram(currentSource, diagram);

			expand.addEventListener('click', () => openMermaidDialog(currentSource));
			save.addEventListener('click', () => {
				void saveTextToWorkspace('diagram.mmd', currentSource);
			});

			render();

			return {
				dom,
				update(updatedNode) {
					if (updatedNode.type.name !== 'mermaid') return false;
					const nextSource = updatedNode.attrs.source as string;
					if (nextSource !== currentSource) {
						currentSource = nextSource;
						render();
					}
					return true;
				},
				selectNode() {
					dom.classList.add('mermaid-block--selected');
				},
				deselectNode() {
					dom.classList.remove('mermaid-block--selected');
				}
			};
		};
	}
});
