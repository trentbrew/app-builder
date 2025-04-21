import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { WebContainer } from '@webcontainer/api';
import { initialCode } from '$lib/initialCode';

interface PreviewState {
	loading: boolean;
	error: string;
	previewUrl: string;
	fs?: any;
	container?: WebContainer;
	logs: string[];
}

function createWebContainerStore() {
	const { subscribe, set, update } = writable<PreviewState>({
		loading: true,
		error: '',
		previewUrl: '',
		logs: []
	});

	async function init() {
		// Ensure this only runs in the browser
		if (!browser) return;

		try {
			update((s) => ({ ...s, logs: ['Booting WebContainer...'] }));
			const container = await WebContainer.boot({
				forwardPreviewErrors: true,
				workdirName: 'svelte-repl'
			});
			update((s) => ({ ...s, container, logs: [...s.logs, 'WebContainer booted.'] }));

			// Mount project
			update((s) => ({ ...s, logs: [...s.logs, 'Mounting project files...'] }));
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
						contents: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Svelte REPL</title>\n</head>\n<body>\n  <script type="module" src="/main.js"></script>\n  <!-- Script to forward console logs -->\n  <script>\n    const originalLog = console.log;\n    const originalError = console.error;\n    const originalWarn = console.warn;\n    console.log = (...args) => {\n      originalLog(...args); // Keep original behavior\n      window.parent.postMessage({ type: 'log', args }, '*');\n    };\n    console.error = (...args) => {\n      originalError(...args);\n      window.parent.postMessage({ type: 'error', args }, '*');\n    };\n    console.warn = (...args) => {\n      originalWarn(...args);\n      window.parent.postMessage({ type: 'warn', args }, '*');\n    };\n  </script>\n</body>\n</html>`
					}
				},
				'main.js': {
					file: {
						contents: `import { mount } from 'svelte';\nimport App from './App.svelte';\n\nmount(App, { target: document.body });`
					}
				},
				'App.svelte': { file: { contents: initialCode } }
			});

			// Install deps
			update((s) => ({ ...s, logs: [...s.logs, 'Installing dependencies (pnpm install)...'] }));
			const install = await container.spawn('pnpm', ['install']);
			install.output.pipeTo(
				new WritableStream({
					write(data) {
						update((s) => ({ ...s, logs: [...s.logs, `[install] ${data}`] }));
					}
				})
			);
			await install.exit;
			update((s) => ({ ...s, logs: [...s.logs, 'Dependencies installed.'] }));

			// Start dev server
			update((s) => ({ ...s, logs: [...s.logs, 'Starting dev server (pnpm run dev)...'] }));
			const dev = await container.spawn('pnpm', ['run', 'dev']);
			dev.output.pipeTo(
				new WritableStream({
					write(data) {
						update((s) => ({ ...s, logs: [...s.logs, `[dev] ${data}`] }));
					}
				})
			);

			// Server ready
			container.on('server-ready', (port, url) => {
				update((s) => ({ ...s, logs: [...s.logs, `Server ready at ${url}`] }));
				update((s) => ({ ...s, previewUrl: url, loading: false, fs: container.fs }));

				// Listen for console messages from the preview iframe
				container.on('preview-message', (msg) => {
					update((s) => ({
						...s,
						logs: [...s.logs, `[preview] ${msg.message || JSON.stringify(msg)}`]
					}));
				});
			});
		} catch (e: any) {
			console.error('Error initializing WebContainer:', e);
			const errorMsg = e.message || 'Boot error';
			set({ loading: false, error: errorMsg, previewUrl: '', logs: [errorMsg] });
		}
	}

	if (browser) {
		init(); // Call init only in browser
	}

	return {
		subscribe,
		logs: { subscribe: (run) => subscribe((s) => run(s.logs)) },
		write: async (path: string, content: string) => {
			let snapshot: PreviewState;
			subscribe((s) => (snapshot = s))();
			if (snapshot?.fs) {
				await snapshot.fs.writeFile(path, content);
			}
		}
	};
}

export const webcontainerStore = createWebContainerStore();
