let saveHandler: (() => void) | null = null;

export function registerEditorSaveHandler(handler: (() => void) | null) {
	saveHandler = handler;
}

export function invokeEditorSave() {
	saveHandler?.();
}
