import { Node, mergeAttributes } from '@tiptap/core';
import mermaid from 'mermaid';

let mermaidReady = false;

function ensureMermaid() {
	if (mermaidReady || typeof document === 'undefined') return;
	mermaid.initialize({
		startOnLoad: false,
		theme: 'dark',
		securityLevel: 'strict',
		fontFamily: 'inherit'
	});
	mermaidReady = true;
}

async function renderMermaid(source: string, container: HTMLElement) {
	ensureMermaid();
	const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
	container.replaceChildren();
	try {
		const { svg } = await mermaid.render(id, source.trim() || 'graph TD\n  Empty');
		container.innerHTML = svg;
	} catch {
		const pre = document.createElement('pre');
		pre.className = 'mermaid-source-fallback';
		pre.textContent = source;
		container.replaceChildren(pre);
	}
}

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

			const diagram = document.createElement('div');
			diagram.className = 'mermaid-block__diagram';
			dom.append(diagram);

			let currentSource = node.attrs.source as string;
			void renderMermaid(currentSource, diagram);

			return {
				dom,
				update(updatedNode) {
					if (updatedNode.type.name !== 'mermaid') return false;
					const nextSource = updatedNode.attrs.source as string;
					if (nextSource !== currentSource) {
						currentSource = nextSource;
						void renderMermaid(nextSource, diagram);
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
