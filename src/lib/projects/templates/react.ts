import type { FileSystemTree } from '@webcontainer/api';
import type { ProjectTemplate } from '$lib/projects/types';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

const packageJson = {
	name: 'react-repl',
	private: true,
	type: 'module',
	scripts: {
		dev: 'vite --host 0.0.0.0 --port 3000',
		build: 'vite build',
		preview: 'vite preview'
	},
	dependencies: {
		react: '^19.0.0',
		'react-dom': '^19.0.0'
	},
	devDependencies: {
		'@types/react': '^19.0.2',
		'@types/react-dom': '^19.0.2',
		'@vitejs/plugin-react': '^4.3.4',
		typescript: '^5.7.2',
		vite: '^6.0.7'
	}
};

const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve('.') }
  },
  server: { port: 3000, strictPort: true, host: true }
});
`;

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React REPL</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
`;

const mainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Page from './app/page';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>
);
`;

const pageCss = `body {
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

export const defaultAppContents = `'use client';

import { useState } from 'react';
import './page.css';

export default function Page() {
  const [count, setCount] = useState(0);

  return (
    <main className="app">
      <h1>{count}</h1>
      <div className="row">
        <button type="button" onClick={() => setCount((c) => c - 1)}>−</button>
        <button type="button" onClick={() => setCount((c) => c + 1)}>+</button>
      </div>
      <button type="button" className="reset" onClick={() => setCount(0)}>
        reset
      </button>
    </main>
  );
}
`;

export function createReactMount(appContents: string): FileSystemTree {
	return {
		'package.json': { file: { contents: JSON.stringify(packageJson, null, 2) } },
		'.npmrc': { file: { contents: npmrc } },
		'vite.config.js': { file: { contents: viteConfig } },
		'index.html': { file: { contents: indexHtml } },
		'main.tsx': { file: { contents: mainTsx } },
		app: {
			directory: {
				'page.tsx': { file: { contents: appContents } },
				'page.css': { file: { contents: pageCss } }
			}
		},
		'tsconfig.json': {
			file: {
				contents: JSON.stringify(
					{
						compilerOptions: {
							target: 'ES2022',
							module: 'ESNext',
							moduleResolution: 'bundler',
							jsx: 'react-jsx',
							strict: true,
							skipLibCheck: true,
							noEmit: true,
							baseUrl: '.',
							paths: { '@/*': ['./*'] }
						},
						include: ['**/*.ts', '**/*.tsx']
					},
					null,
					2
				)
			}
		}
	};
}

export const reactTemplate: ProjectTemplate = {
	id: 'react',
	label: 'React',
	entryFile: 'app/page.tsx',
	snapshotVersion: 'react-v1',
	defaultAppContents,
	createMount: createReactMount
};
