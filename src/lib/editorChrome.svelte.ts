class EditorChromeState {
	consoleVisible = $state(true);

	setConsoleVisible(visible: boolean) {
		this.consoleVisible = visible;
	}

	toggleConsole() {
		this.consoleVisible = !this.consoleVisible;
	}
}

export const editorChrome = new EditorChromeState();
