import {
	AGENT_MANIFEST_JSON,
	COMPONENTS_GITKEEP,
	GUEST_SDK_INDEX,
	GUEST_SDK_TYPES
} from '$lib/agentHarness/guestMount';
import { thumbnailCaptureScriptTag } from '$lib/projects/thumbnailCaptureScript';

export const REPL_PACKAGE_JSON = {
	name: 'svelte-repl',
	type: 'module',
	scripts: {
		dev: 'vite --host 127.0.0.1',
		start: 'bun run dev'
	},
	dependencies: {
		svelte: '5.56.3'
	},
	devDependencies: {
		vite: '6.3.2',
		'@sveltejs/vite-plugin-svelte': '5.1.1'
	}
} as const;

export function replViteConfig(port: number, base = '/') {
	return `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	base: ${JSON.stringify(base)},
	server: {
		port: ${port},
		host: '127.0.0.1',
		strictPort: true
	}
});
`;
}

export const REPL_SVELTE_CONFIG = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess()
};
`;

const REPL_INDEX_HTML_BASE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Svelte Counter</title>
</head>
<body>
  <script type="module" src="./main.js"></script>
  <script>
    const post = (type, args) => window.parent.postMessage({ type, args }, '*');
    const wrap = (original, type) => (...args) => {
      original(...args);
      post(type, args);
    };
    console.log = wrap(console.log.bind(console), 'log');
    console.info = wrap(console.info.bind(console), 'info');
    console.warn = wrap(console.warn.bind(console), 'warn');
    console.error = wrap(console.error.bind(console), 'error');
    console.debug = wrap(console.debug.bind(console), 'debug');
    window.addEventListener('error', (event) => {
      post('error', [event.message || 'Uncaught error']);
    });
    window.addEventListener('unhandledrejection', (event) => {
      post('error', [String(event.reason ?? 'Unhandled promise rejection')]);
    });
  </script>
</body>
</html>`;

export const REPL_INDEX_HTML = REPL_INDEX_HTML_BASE.replace(
	'</body>',
	`${thumbnailCaptureScriptTag()}\n</body>`
);

export const REPL_MAIN_JS = `import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.body });
`;

export interface WriteReplProjectOptions {
	port: number;
	appContents: string;
	previewBase?: string;
}

export function replProjectFiles(options: WriteReplProjectOptions): Record<string, string> {
	return {
		'package.json': JSON.stringify(REPL_PACKAGE_JSON, null, 2),
		'vite.config.js': replViteConfig(options.port, options.previewBase ?? '/'),
		'svelte.config.js': REPL_SVELTE_CONFIG,
		'index.html': REPL_INDEX_HTML,
		'main.js': REPL_MAIN_JS,
		'App.svelte': options.appContents,
		'agent.manifest.json': AGENT_MANIFEST_JSON,
		'lib/agent-sdk/types.ts': GUEST_SDK_TYPES,
		'lib/agent-sdk/index.ts': GUEST_SDK_INDEX,
		'components/.gitkeep': COMPONENTS_GITKEEP
	};
}
