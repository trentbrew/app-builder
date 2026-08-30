import Link from '@tiptap/extension-link';
import { getAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { resolveMarkdownLinkHref } from '$lib/tiptap/markdown-link-utils.js';

export type MarkdownLinkOptions = {
	onNavigateFile?: (path: string) => void;
	onOpenUrl?: (url: string) => void;
	getCurrentFilePath?: () => string | undefined;
};

function findAnchor(target: EventTarget | null, root: HTMLElement): HTMLAnchorElement | null {
	if (!(target instanceof Element)) return null;
	const anchor = target.closest('a');
	if (!anchor || !root.contains(anchor)) return null;
	return anchor;
}

function scrollToAnchor(root: HTMLElement, id: string) {
	const escaped =
		typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
			? CSS.escape(id)
			: id.replace(/"/g, '\\"');
	const target =
		root.querySelector(`#${escaped}`) ??
		root.querySelector(`[id="${id.replace(/"/g, '\\"')}"]`) ??
		root.querySelector(`a[name="${id.replace(/"/g, '\\"')}"]`);
	target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function markdownLinkClickPlugin(options: MarkdownLinkOptions, typeName: string) {
	return new Plugin({
		key: new PluginKey('markdownLinkClick'),
		props: {
			handleClick(view, _pos, event) {
				if (event.button !== 0) return false;

				const anchor = findAnchor(event.target, view.dom);
				if (!anchor) return false;

				const attrs = getAttributes(view.state, typeName);
				const href = anchor.getAttribute('href') ?? attrs.href;
				if (!href) return false;

				event.preventDefault();
				event.stopPropagation();

				const action = resolveMarkdownLinkHref(href, options.getCurrentFilePath?.());

				switch (action.type) {
					case 'file':
						options.onNavigateFile?.(action.path);
						if (action.hash) scrollToAnchor(view.dom, action.hash);
						return true;
					case 'url':
						options.onOpenUrl?.(action.url);
						return true;
					case 'external':
						window.location.href = action.href;
						return true;
					case 'anchor':
						scrollToAnchor(view.dom, action.id);
						return true;
					default:
						return true;
				}
			}
		}
	});
}

export const MarkdownLink = Link.extend<MarkdownLinkOptions>({
	addOptions() {
		return {
			...this.parent?.(),
			openOnClick: false,
			HTMLAttributes: {
				target: null,
				rel: null,
				class: 'markdown-link'
			},
			onNavigateFile: undefined,
			onOpenUrl: undefined,
			getCurrentFilePath: undefined
		};
	},

	addProseMirrorPlugins() {
		const plugins = this.parent?.() ?? [];
		plugins.push(
			markdownLinkClickPlugin(
				{
					onNavigateFile: this.options.onNavigateFile,
					onOpenUrl: this.options.onOpenUrl,
					getCurrentFilePath: this.options.getCurrentFilePath
				},
				this.type.name
			)
		);
		return plugins;
	}
});
