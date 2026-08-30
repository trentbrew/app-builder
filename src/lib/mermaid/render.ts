import mermaid from 'mermaid';

let mermaidReady = false;

export function ensureMermaid() {
	if (mermaidReady || typeof document === 'undefined') return;
	mermaid.initialize({
		startOnLoad: false,
		theme: 'dark',
		securityLevel: 'strict',
		fontFamily: 'inherit',
	});
	mermaidReady = true;
}

export async function renderMermaidDiagram(source: string, container: HTMLElement) {
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
