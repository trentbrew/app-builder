import { saveTextToWorkspace } from '$lib/fileOps';
import { createMermaidBlockElement } from '$lib/mermaid/blockElement';

const ENHANCED = 'data-block-enhanced';
const MERMAID_ENHANCED = 'data-mermaid-enhanced';

const MERMAID_SOURCE =
	/^(graph\s|flowchart\s|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie\s|gitGraph|mindmap|timeline)\b/i;

function languageFromPre(pre: HTMLPreElement): string {
	const code = pre.querySelector('code');
	if (!code) return 'txt';
	for (const cls of code.classList) {
		if (cls.startsWith('language-')) return cls.slice('language-'.length) || 'txt';
	}
	return 'txt';
}

function sourceFromPre(pre: HTMLPreElement): string {
	const code = pre.querySelector('code');
	return (code?.textContent ?? pre.textContent ?? '').trim();
}

function isMermaidPre(pre: HTMLPreElement): boolean {
	if (pre.closest('.mermaid-block')) return false;
	const lang = languageFromPre(pre).toLowerCase();
	if (lang === 'mermaid' || lang === 'mmd') return true;
	const source = sourceFromPre(pre);
	if (!MERMAID_SOURCE.test(source)) return false;
	return source.split('\n').filter((line) => line.trim()).length >= 2;
}

function extensionForLanguage(lang: string): string {
	switch (lang) {
		case 'typescript':
			return 'ts';
		case 'javascript':
			return 'js';
		case 'markdown':
			return 'md';
		case 'plaintext':
			return 'txt';
		default:
			return lang.includes('.') ? lang : lang || 'txt';
	}
}

function createActionButton(label: string, onClick: () => void) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'markdown-block-action';
	button.textContent = label;
	button.addEventListener('click', onClick);
	return button;
}

function wrapPreBlock(pre: HTMLPreElement) {
	if (pre.hasAttribute(ENHANCED)) return;
	if (isMermaidPre(pre)) return;

	const code = pre.querySelector('code');
	const content = code?.textContent ?? pre.textContent ?? '';
	const lang = languageFromPre(pre);
	const defaultName = `snippet.${extensionForLanguage(lang)}`;

	const wrapper = document.createElement('div');
	wrapper.className = 'markdown-code-block-wrap';
	pre.parentNode?.insertBefore(wrapper, pre);
	wrapper.append(pre);

	const actions = document.createElement('div');
	actions.className = 'markdown-block-actions';
	actions.append(
		createActionButton('Add to workspace', () => {
			void saveTextToWorkspace(defaultName, content);
		}),
	);
	wrapper.append(actions);
	pre.setAttribute(ENHANCED, 'true');
}

function upgradePreToMermaid(pre: HTMLPreElement) {
	if (pre.hasAttribute(MERMAID_ENHANCED)) return;

	const source = sourceFromPre(pre);
	if (!source || !isMermaidPre(pre)) return;

	const block = createMermaidBlockElement(source);
	block.setAttribute(MERMAID_ENHANCED, 'true');

	const host = pre.closest('.markdown-code-block-wrap') ?? pre;
	host.replaceWith(block);
}

/** Render fenced mermaid blocks that TipTap kept as highlighted code blocks. */
export function enhanceMermaidBlocks(root: HTMLElement | null | undefined) {
	if (!root) return;
	for (const pre of root.querySelectorAll('pre')) {
		upgradePreToMermaid(pre as HTMLPreElement);
	}
}

/** Attach save actions to rendered markdown code blocks (view mode). */
export function enhanceMarkdownCodeBlocks(root: HTMLElement | null | undefined) {
	if (!root) return;
	for (const pre of root.querySelectorAll('pre')) {
		if (pre.closest('.mermaid-block')) continue;
		wrapPreBlock(pre as HTMLPreElement);
	}
}
