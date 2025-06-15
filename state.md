```ts
import { browser } from '$app/environment';
import { WebContainer } from '@webcontainer/api';
import { initialCode } from '$lib/initialCode';

// Shared state using Svelte 5 runes - each variable must be declared separately
let webContainer = $state<WebContainer | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);
let previewUrl = $state<string | null>(null);

// Enhanced status tracking
let bootStatus = $state('Initializing...');
let buildStatus = $state('Waiting...');
let lastActivity = $state<Date | null>(null);
let installProgress = $state<{ current: number; total: number; currentPackage?: string } | null>(
	null
);
let webContainerError = $state<string | null>(null);

// Editor state
let editorContent = $state(initialCode);

// Logs
let logs = $state<string[]>([]);
let webContainerLogs = $state<string[]>([]);
let consoleMessages = $state<Array<{ type: string; message: string; timestamp: Date }>>([]);

// UI state
let selectedNodes = $state(new Set<string>());
let isMetaPressed = $state(false);

// Export state as an object for easier access
export const codeCanvasState = {
	get webContainer() {
		return webContainer;
	},
	set webContainer(value) {
		webContainer = value;
	},
	get loading() {
		return loading;
	},
	set loading(value) {
		loading = value;
	},
	get error() {
		return error;
	},
	set error(value) {
		error = value;
	},
	get previewUrl() {
		return previewUrl;
	},
	set previewUrl(value) {
		previewUrl = value;
	},
	get bootStatus() {
		return bootStatus;
	},
	set bootStatus(value) {
		bootStatus = value;
	},
	get buildStatus() {
		return buildStatus;
	},
	set buildStatus(value) {
		buildStatus = value;
	},
	get lastActivity() {
		return lastActivity;
	},
	set lastActivity(value) {
		lastActivity = value;
	},
	get installProgress() {
		return installProgress;
	},
	set installProgress(value) {
		installProgress = value;
	},
	get webContainerError() {
		return webContainerError;
	},
	set webContainerError(value) {
		webContainerError = value;
	},
	get editorContent() {
		return editorContent;
	},
	set editorContent(value) {
		editorContent = value;
	},
	get logs() {
		return logs;
	},
	set logs(value) {
		logs = value;
	},
	get webContainerLogs() {
		return webContainerLogs;
	},
	set webContainerLogs(value) {
		webContainerLogs = value;
	},
	get consoleMessages() {
		return consoleMessages;
	},
	set consoleMessages(value) {
		consoleMessages = value;
	},
	get selectedNodes() {
		return selectedNodes;
	},
	set selectedNodes(value) {
		selectedNodes = value;
	},
	get isMetaPressed() {
		return isMetaPressed;
	},
	set isMetaPressed(value) {
		isMetaPressed = value;
	}
};

// Actions
export const codeCanvasActions = {
	// Update activity timestamp
	updateActivity() {
		lastActivity = new Date();
	},

	// Add log message
	addLog(message: string) {
		logs = [...logs, message];
	},

	// Add WebContainer log
	addWebContainerLog(message: string) {
		webContainerLogs = [...webContainerLogs, message];
	},

	// Add console message
	addConsoleMessage(type: string, message: string) {
		consoleMessages = [...consoleMessages, { type, message, timestamp: new Date() }];
	},

	// Clear logs
	clearLogs() {
		logs = [];
	},

	// Clear console messages
	clearConsoleMessages() {
		consoleMessages = [];
	},

	// Update editor content
	updateEditorContent(content: string) {
		editorContent = content;
	},

	// Write file to WebContainer
	async writeFile(path: string, content: string) {
		if (webContainer) {
			try {
				await webContainer.fs.writeFile(path, content);
				this.updateActivity();
				codeCanvasActions.addLog(`Updated ${path}`);
			} catch (err) {
				console.error('Error writing file:', err);
				codeCanvasActions.addLog(`Error writing ${path}: ${err}`);
			}
		}
	},

	// Run the current code
	async runCode() {
		if (webContainer && editorContent) {
			buildStatus = 'Building...';
			this.updateActivity();

			try {
				await this.writeFile('/App.svelte', editorContent);
				buildStatus = 'Ready';
			} catch (err) {
				buildStatus = 'Error';
				webContainerError = err instanceof Error ? err.message : String(err);
			}
		}
	},

	// Refresh preview
	refreshPreview() {
		console.log('🔄 Refreshing preview...');
		buildStatus = 'Refreshing...';
		this.updateActivity();
		this.runCode();
	},

	// Reboot WebContainer
	async rebootWebContainer() {
		console.log('🔥 Rebooting WebContainer...');
		bootStatus = 'Rebooting...';
		buildStatus = 'Waiting...';
		lastActivity = null;
		installProgress = null;
		webContainerError = null;
		loading = true;
		error = null;
		previewUrl = null;
		logs = [];
		webContainerLogs = [];
		consoleMessages = [];

		this.updateActivity();

		// Force a page reload to restart WebContainer
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	},

	// Initialize WebContainer
	async initWebContainer() {
		if (!browser) return;

		try {
			bootStatus = 'Booting WebContainer...';
			this.addWebContainerLog('Booting WebContainer...');

			const container = await WebContainer.boot({
				forwardPreviewErrors: true,
				workdirName: 'svelte-repl'
			});

			webContainer = container;
			bootStatus = 'Mounting files...';
			this.addWebContainerLog('WebContainer booted.');
			this.updateActivity();

			// Mount project files
			this.addWebContainerLog('Mounting project files...');
			await container.mount({
				'package.json': {
					file: {
						contents: JSON.stringify(
							{
								name: 'svelte-repl',
								type: 'module',
								scripts: { dev: 'vite --port 3000 --host 0.0.0.0' },
								dependencies: { svelte: '^5.0.0' },
								devDependencies: {
									vite: '^4.0.0',
									'@sveltejs/vite-plugin-svelte': '^3.0.0'
								}
							},
							null,
							2
						)
					}
				},
				'vite.config.js': {
					file: {
						contents: `import { svelte } from '@sveltejs/vite-plugin-svelte';\nexport default { plugins: [svelte()] };`
					}
				},
				'index.html': {
					file: {
						contents: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Svelte REPL</title>\n</head>\n<body>\n  <script type="module" src="/main.js"></script>\n  <!-- Script to forward console logs -->\n  <script>\n    const originalLog = console.log;\n    const originalError = console.error;\n    const originalWarn = console.warn;\n    console.log = (...args) => {\n      originalLog(...args);\n      window.parent.postMessage({ type: 'log', args }, '*');\n    };\n    console.error = (...args) => {\n      originalError(...args);\n      window.parent.postMessage({ type: 'error', args }, '*');\n    };\n    console.warn = (...args) => {\n      originalWarn(...args);\n      window.parent.postMessage({ type: 'warn', args }, '*');\n    };\n  </script>\n</body>\n</html>`
					}
				},
				'main.js': {
					file: {
						contents: `import { mount } from 'svelte';\nimport App from './App.svelte';\n\nmount(App, { target: document.body });`
					}
				},
				'App.svelte': { file: { contents: editorContent } }
			});

			// Install dependencies
			bootStatus = 'Installing dependencies...';
			this.addWebContainerLog('Installing dependencies (pnpm install)...');

			const install = await container.spawn('pnpm', ['install']);
			install.output.pipeTo(
				new WritableStream({
					write: (data) => {
						this.addWebContainerLog(`[install] ${data}`);

						// Parse install progress if possible
						const installMatch = data.match(/(\d+)\/(\d+)/);
						if (installMatch) {
							installProgress = {
								current: parseInt(installMatch[1]),
								total: parseInt(installMatch[2])
							};
						}
					}
				})
			);
			await install.exit;

			installProgress = null;
			bootStatus = 'Starting dev server...';
			this.addWebContainerLog('Dependencies installed.');

			// Start dev server
			this.addWebContainerLog('Starting dev server (pnpm run dev)...');
			const dev = await container.spawn('pnpm', ['run', 'dev']);
			dev.output.pipeTo(
				new WritableStream({
					write: (data) => {
						this.addWebContainerLog(`[dev] ${data}`);
					}
				})
			);

			// Listen for server ready
			container.on('server-ready', (port, url) => {
				this.addWebContainerLog(`Server ready at ${url}`);
				previewUrl = url;
				loading = false;
				bootStatus = 'Ready';
				buildStatus = 'Ready';
				this.updateActivity();
			});
		} catch (err) {
			console.error('Error initializing WebContainer:', err);
			const errorMsg = err instanceof Error ? err.message : 'Boot error';
			loading = false;
			error = errorMsg;
			bootStatus = 'Error';
			webContainerError = errorMsg;
			this.addWebContainerLog(`Error: ${errorMsg}`);
		}
	}
};

// Initialize WebContainer when this module loads (browser only)
if (browser) {
	codeCanvasActions.initWebContainer();
}
```
