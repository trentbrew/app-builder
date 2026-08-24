class EditorChromeState {
	consoleVisible = $state(true);
	settingsOpen = $state(false);

	setConsoleVisible(visible: boolean) {
		this.consoleVisible = visible;
	}

	toggleConsole() {
		this.consoleVisible = !this.consoleVisible;
	}

	openSettings() {
		this.settingsOpen = true;
	}

	closeSettings() {
		this.settingsOpen = false;
	}

	toggleSettings() {
		this.settingsOpen = !this.settingsOpen;
	}

	setSettingsOpen(open: boolean) {
		this.settingsOpen = open;
	}
}

export const editorChrome = new EditorChromeState();
