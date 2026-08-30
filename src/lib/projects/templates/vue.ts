import type { FileSystemTree } from '@webcontainer/api';
import type { ProjectTemplate } from '$lib/projects/types';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

const packageJson = {
	name: 'vue-repl',
	private: true,
	type: 'module',
	scripts: {
		dev: 'vite --host 0.0.0.0 --port 3000',
		build: 'vite build',
		preview: 'vite preview'
	},
	dependencies: {
		vue: '^3.5.13'
	},
	devDependencies: {
		'@vitejs/plugin-vue': '^5.2.1',
		vite: '^6.0.7'
	}
};

const viteConfig = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: { port: 3000, strictPort: true, host: true }
});
`;

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue REPL</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`;

const mainJs = `import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
`;

export const defaultAppContents = `<script setup>
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <main class="app">
    <h1>{{ count }}</h1>
    <div class="row">
      <button type="button" @click="count--">−</button>
      <button type="button" @click="count++">+</button>
    </div>
    <button type="button" class="reset" @click="count = 0">reset</button>
  </main>
</template>

<style>
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
</style>
`;

export function createVueMount(appContents: string): FileSystemTree {
	return {
		'package.json': { file: { contents: JSON.stringify(packageJson, null, 2) } },
		'.npmrc': { file: { contents: npmrc } },
		'vite.config.js': { file: { contents: viteConfig } },
		'index.html': { file: { contents: indexHtml } },
		'main.js': { file: { contents: mainJs } },
		'App.vue': { file: { contents: appContents } }
	};
}

export const vueTemplate: ProjectTemplate = {
	id: 'vue',
	label: 'Vue',
	entryFile: 'App.vue',
	snapshotVersion: 'vue-repl-v1',
	defaultAppContents,
	createMount: createVueMount
};
