import type { FileSystemTree } from '@webcontainer/api';
import type { ProjectTemplate } from '$lib/projects/types';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

const packageJson = {
	name: 'lit-repl',
	private: true,
	type: 'module',
	scripts: {
		dev: 'vite --host 0.0.0.0 --port 3000',
		build: 'vite build',
		preview: 'vite preview'
	},
	dependencies: {
		lit: '^3.2.1'
	},
	devDependencies: {
		typescript: '^5.7.2',
		vite: '^6.0.7'
	}
};

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lit App</title>
  </head>
  <body>
    <counter-app></counter-app>
    <script type="module" src="/src/counter-app.ts"></script>
  </body>
</html>
`;

export const defaultAppContents = `import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('counter-app')
export class CounterApp extends LitElement {
  static styles = css\`
    :host {
      display: block;
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
  \`;

  @state()
  private count = 0;

  render() {
    return html\`
      <main class="app">
        <h1>\${this.count}</h1>
        <div class="row">
          <button type="button" @click=\${() => (this.count -= 1)}>−</button>
          <button type="button" @click=\${() => (this.count += 1)}>+</button>
        </div>
        <button type="button" class="reset" @click=\${() => (this.count = 0)}>reset</button>
      </main>
    \`;
  }
}
`;

export function createLitMount(appContents: string): FileSystemTree {
	return {
		'package.json': { file: { contents: JSON.stringify(packageJson, null, 2) } },
		'.npmrc': { file: { contents: npmrc } },
		'index.html': { file: { contents: indexHtml } },
		src: {
			directory: {
				'counter-app.ts': { file: { contents: appContents } }
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
							experimentalDecorators: true,
							useDefineForClassFields: false,
							strict: true,
							skipLibCheck: true,
							noEmit: true
						},
						include: ['src/**/*.ts']
					},
					null,
					2
				)
			}
		}
	};
}

export const litTemplate: ProjectTemplate = {
	id: 'lit',
	label: 'Lit',
	entryFile: 'src/counter-app.ts',
	snapshotVersion: 'lit-v1',
	defaultAppContents,
	createMount: createLitMount
};
