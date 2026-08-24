import type { FileSystemTree } from '@webcontainer/api';

const packageJson = {
	name: 'svelte-repl',
	type: 'module',
	scripts: {
		dev: 'vite --port 3000 --host 0.0.0.0',
		start: 'npm run dev'
	},
	dependencies: {
		svelte: '5.56.3'
	},
	devDependencies: {
		vite: '6.3.2',
		'@sveltejs/vite-plugin-svelte': '5.1.1'
	}
};

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

const viteConfig = `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	server: {
		port: 3000,
		host: '0.0.0.0'
	}
});
`;

const svelteConfig = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess()
};
`;

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Svelte Counter</title>
</head>
<body>
  <script type="module" src="/main.js"></script>
  <script>
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    console.log = (...args) => {
      originalLog(...args);
      window.parent.postMessage({ type: 'log', args }, '*');
    };
    console.error = (...args) => {
      originalError(...args);
      window.parent.postMessage({ type: 'error', args }, '*');
    };
    console.warn = (...args) => {
      originalWarn(...args);
      window.parent.postMessage({ type: 'warn', args }, '*');
    };
  </script>
</body>
</html>`;

const mainJs = `import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.body });
`;

export function createWebContainerMount(appContents: string): FileSystemTree {
	return {
		'package.json': {
			file: { contents: JSON.stringify(packageJson, null, 2) }
		},
		'.npmrc': {
			file: { contents: npmrc }
		},
		'vite.config.js': {
			file: { contents: viteConfig }
		},
		'svelte.config.js': {
			file: { contents: svelteConfig }
		},
		'index.html': {
			file: { contents: indexHtml }
		},
		'main.js': {
			file: { contents: mainJs }
		},
		'App.svelte': {
			file: { contents: appContents }
		}
	};
}
