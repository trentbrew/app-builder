import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { clipboardHasImage } from '$lib/tiptap/clipboard';

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

async function insertImage(editor: Editor, file: File, pos?: number) {
	const src = await readFileAsDataUrl(file);
	const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
	const attrs = { src, alt, title: file.name };
	const chain = editor.chain().focus();

	if (pos !== undefined) {
		chain.insertContentAt(pos, { type: 'image', attrs });
	} else {
		const { from, to } = editor.state.selection;
		chain.insertContentAt({ from, to }, { type: 'image', attrs });
	}

	chain.run();
}

export const ImagePaste = Extension.create({
	name: 'imagePaste',

	addProseMirrorPlugins() {
		const editor = this.editor;

		return [
			new Plugin({
				key: new PluginKey('imagePaste'),
				props: {
					handlePaste(_view, event) {
						const clipboardData = event.clipboardData;
						if (!clipboardData || !clipboardHasImage(clipboardData)) return false;

						const file = Array.from(clipboardData.items)
							.filter((item) => item.type.startsWith('image/'))
							.map((item) => item.getAsFile())
							.find(Boolean);

						if (!file) return false;

						event.preventDefault();
						void insertImage(editor, file);
						return true;
					},
					handleDrop(view, event) {
						const files = event.dataTransfer?.files;
						if (!files?.length) return false;

						const image = Array.from(files).find((file) => file.type.startsWith('image/'));
						if (!image) return false;

						event.preventDefault();
						const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
						void insertImage(editor, image, pos);
						return true;
					}
				}
			})
		];
	}
});
