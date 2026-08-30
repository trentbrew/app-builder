import type { FileSystemTree } from '@webcontainer/api';
import type { ProjectTemplate } from '$lib/projects/types';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

const packageJson = {
	name: 'vanilla-repl',
	private: true,
	type: 'module',
	scripts: {
		dev: 'vite --host 0.0.0.0 --port 3000',
		build: 'vite build',
		preview: 'vite preview'
	},
	devDependencies: {
		vite: '^6.0.7'
	}
};

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vanilla App</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <main id="app" class="app"></main>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`;

const styleCss = `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: system-ui, sans-serif;
  background: #0f0f12;
  color: #f4f4f5;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.row {
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid #3f3f46;
  background: #18181b;
  color: inherit;
  cursor: pointer;
}

button:hover {
  background: #27272a;
}

.reset {
  font-size: 0.875rem;
  opacity: 0.8;
}
`;

export const defaultAppContents = `const app = document.querySelector('#app');
if (!app) throw new Error('Missing #app root');

let count = 0;

function render() {
  app.innerHTML = \`
    <h1>\${count}</h1>
    <div class="row">
      <button type="button" data-action="dec">−</button>
      <button type="button" data-action="inc">+</button>
    </div>
    <button type="button" class="reset" data-action="reset">reset</button>
  \`;

  app.querySelector('[data-action="dec"]')?.addEventListener('click', () => {
    count -= 1;
    render();
  });
  app.querySelector('[data-action="inc"]')?.addEventListener('click', () => {
    count += 1;
    render();
  });
  app.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    count = 0;
    render();
  });
}

render();
`;

export function createVanillaMount(appContents: string): FileSystemTree {
	return {
		'package.json': { file: { contents: JSON.stringify(packageJson, null, 2) } },
		'.npmrc': { file: { contents: npmrc } },
		'index.html': { file: { contents: indexHtml } },
		'style.css': { file: { contents: styleCss } },
		'main.js': { file: { contents: appContents } }
	};
}

export const vanillaTemplate: ProjectTemplate = {
	id: 'vanilla',
	label: 'Vanilla',
	entryFile: 'main.js',
	snapshotVersion: 'vanilla-v1',
	defaultAppContents,
	createMount: createVanillaMount
};
