import { saveTextToWorkspace } from '$lib/fileOps';
import { renderMermaidDiagram } from '$lib/mermaid/render';

const EXPAND_ICON =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';

export function openMermaidDialog(source: string) {
	const dialog = document.createElement('dialog');
	dialog.className = 'mermaid-expand-dialog';

	const panel = document.createElement('div');
	panel.className = 'mermaid-expand-dialog__panel';

	const header = document.createElement('div');
	header.className = 'mermaid-expand-dialog__header';

	const title = document.createElement('span');
	title.className = 'mermaid-expand-dialog__title';
	title.textContent = 'Diagram';

	const close = document.createElement('button');
	close.type = 'button';
	close.className = 'mermaid-expand-dialog__close';
	close.setAttribute('aria-label', 'Close');
	close.innerHTML =
		'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
	close.addEventListener('click', () => dialog.close());

	header.append(title, close);

	const body = document.createElement('div');
	body.className = 'mermaid-expand-dialog__body';

	panel.append(header, body);
	dialog.append(panel);
	document.body.append(dialog);

	void renderMermaidDiagram(source, body);

	dialog.addEventListener('close', () => dialog.remove());
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});

	dialog.showModal();
}

export function createMermaidBlockElement(source: string) {
	const dom = document.createElement('div');
	dom.className = 'mermaid-block';
	dom.dataset.mermaid = '';
	dom.dataset.source = source;

	const header = document.createElement('div');
	header.className = 'mermaid-block__header';

	const expand = document.createElement('button');
	expand.type = 'button';
	expand.className = 'mermaid-block__expand';
	expand.setAttribute('aria-label', 'View diagram');
	expand.innerHTML = EXPAND_ICON;
	expand.addEventListener('click', () => openMermaidDialog(source));

	header.append(expand);

	const diagram = document.createElement('div');
	diagram.className = 'mermaid-block__diagram';

	const actions = document.createElement('div');
	actions.className = 'markdown-block-actions';

	const save = document.createElement('button');
	save.type = 'button';
	save.className = 'markdown-block-action';
	save.textContent = 'Add to workspace';
	save.addEventListener('click', () => {
		void saveTextToWorkspace('diagram.mmd', source);
	});
	actions.append(save);

	dom.append(header, diagram, actions);
	void renderMermaidDiagram(source, diagram);

	return dom;
}
