class AppChromeState {
	commandPaletteOpen = $state(false);
	pluginsDialogOpen = $state(false);

	openCommandPalette() {
		this.commandPaletteOpen = true;
	}

	closeCommandPalette() {
		this.commandPaletteOpen = false;
	}

	toggleCommandPalette() {
		this.commandPaletteOpen = !this.commandPaletteOpen;
	}

	openPluginsDialog() {
		this.pluginsDialogOpen = true;
	}

	closePluginsDialog() {
		this.pluginsDialogOpen = false;
	}

	togglePluginsDialog() {
		this.pluginsDialogOpen = !this.pluginsDialogOpen;
	}
}

export const appChrome = new AppChromeState();
