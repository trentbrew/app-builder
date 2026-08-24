import type { FileSystemTree } from '@webcontainer/api';
import {
	REPL_INDEX_HTML,
	REPL_MAIN_JS,
	REPL_PACKAGE_JSON,
	REPL_SVELTE_CONFIG,
	replViteConfig
} from '$lib/replProject';

const npmrc = `legacy-peer-deps=true
engine-strict=false
`;

export function createWebContainerMount(appContents: string): FileSystemTree {
	return {
		'package.json': {
			file: { contents: JSON.stringify(REPL_PACKAGE_JSON, null, 2) }
		},
		'.npmrc': {
			file: { contents: npmrc }
		},
		'vite.config.js': {
			file: { contents: replViteConfig(3000) }
		},
		'svelte.config.js': {
			file: { contents: REPL_SVELTE_CONFIG }
		},
		'index.html': {
			file: { contents: REPL_INDEX_HTML }
		},
		'main.js': {
			file: { contents: REPL_MAIN_JS }
		},
		'App.svelte': {
			file: { contents: appContents }
		},
		'README.md': {
			file: {
				contents: `---
title: Svelte Counter
description: Markdown editor demo with frontmatter, callouts, and wiki-links
tags:
  - demo
  - markdown
draft: false
---

# Svelte Counter

Welcome to the app builder sandbox.

> [!TIP]
> Paste markdown from anywhere — headings, lists, callouts, and \`[[README.md]]\` wiki-links auto-format in rich mode.

## Features

- Live preview in WebContainer
- **Rich/source toggle** for markdown files
- YAML **Properties** panel for frontmatter
- Slash commands — type \`/\` at line start
- @ mentions for open project files

## Task list

- [x] Boot WebContainer
- [ ] Try slash commands
- [ ] Paste markdown from another app
`
			}
		}
	};
}
