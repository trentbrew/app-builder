#!/usr/bin/env bun
/**
 * Agent UI smoke — Bun.WebView headless checks before agents declare done.
 * Exit 0 pass · 1 assertion/console fail · 2 dev server unreachable
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.env.AGENT_BASE_URL ?? 'http://localhost:9898').replace(/\/$/, '');
const healthUrl = process.env.VERIFY_HEALTH_URL || `${base}/dashboard`;
const touched = (process.env.AGENT_VERIFY_TOUCHED ?? '')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

const manifestPath = join(import.meta.dir, '..', '.agent', 'verify.json');
let manifest = { checks: {} };
if (existsSync(manifestPath)) {
	manifest = { ...manifest, ...JSON.parse(await Bun.file(manifestPath).text()) };
}

function globMatch(file, pattern) {
	const normalized = file.replace(/^\//, '').replace(/\\/g, '/');
	const re = pattern
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*\*/g, '<<<GLOBSTAR>>>')
		.replace(/\*/g, '[^/]*')
		.replace(/<<<GLOBSTAR>>>/g, '.*')
		.replace(/\?/g, '.');
	return new RegExp(`^${re}$`).test(normalized);
}

function shouldRunSettingsCenterCheck() {
	const cfg = manifest.checks?.settingsCentered;
	if (!cfg?.whenTouched?.length) return false;
	return touched.some((file) => cfg.whenTouched.some((pattern) => globMatch(file, pattern)));
}

async function probe(url, { attempts = 6, intervalMs = 2000 } = {}) {
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
			if (res.ok) return true;
		} catch {
			// retry — Vite may still be binding after `pnpm dev`
		}
		if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
	}
	return false;
}

/** Poll page until expression is truthy (SPA hydration). */
async function waitFor(view, expression, { timeoutMs = 20_000, intervalMs = 250, label = 'condition' } = {}) {
	const deadline = Date.now() + timeoutMs;
	let last = null;
	while (Date.now() < deadline) {
		last = await view.evaluate(expression);
		if (last) return last;
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	return last;
}

const consoleErrors = [];

try {
if (!(await probe(healthUrl))) {
	console.error(`smoke: dev server not reachable at ${healthUrl}`);
	console.error('smoke: run `pnpm dev` (port 9898), wait for Vite ready, then stop again');
	process.exit(2);
}

await using view = new Bun.WebView({
	width: 1280,
	height: 720,
	// WKWebView headless renders a blank page for this Vite/SvelteKit app; Chrome works.
	backend: process.env.AGENT_SMOKE_BACKEND === 'webkit' ? 'webkit' : { type: 'chrome', url: false },
	console: (type, ...args) => {
		if (type === 'error') consoleErrors.push(args.map(String).join(' '));
	}
});

await view.navigate(`${base}/dashboard`);
await view.evaluate(`document.fonts?.ready`);

const dashboardOk = await waitFor(
	view,
	`(() => {
    const text = document.body?.innerText ?? '';
    return (
      text.includes('Projects') ||
      text.includes('New project') ||
      text.includes('Loading projects') ||
      text.includes('No projects yet')
    );
  })()`,
	{ label: 'dashboard content' }
);

if (!dashboardOk) {
	const snippet = await view.evaluate(
		`(() => (document.body?.innerText ?? '').slice(0, 400))()`
	);
	console.error('smoke: dashboard did not load expected content');
	console.error('smoke: body snippet:', JSON.stringify(snippet));
	await Bun.write('.agent/last-smoke-fail.png', await view.screenshot());
	process.exit(1);
}

if (shouldRunSettingsCenterCheck()) {
	const onEditor = await waitFor(
		view,
		`location.pathname.startsWith('/editor/')`,
		{ label: 'editor route', timeoutMs: 2_000 }
	);

	if (!onEditor) {
		const openedProject = await view.evaluate(`(() => {
      const card = document.querySelector('article button');
      if (!card) return false;
      card.click();
      return true;
    })()`);

		if (openedProject) {
			await waitFor(view, `location.pathname.startsWith('/editor/')`, {
				label: 'editor route after project open',
				timeoutMs: 30_000
			});
		}
	}

	const canOpenSettings = await waitFor(
		view,
		`(() => {
      if (!location.pathname.startsWith('/editor/')) return false;
      return Boolean(document.querySelector('[aria-label="Settings"]'));
    })()`,
		{ label: 'settings trigger in editor chrome', timeoutMs: 30_000 }
	);

	if (!canOpenSettings) {
		console.log('smoke: skip settings center check (editor chrome unavailable)');
	} else {
		await view.click('[aria-label="Settings"]');

		const centerCheck = await waitFor(
			view,
			`(() => {
      const el = document.querySelector('[data-slot="dialog-content"].settings-dialog, .settings-dialog');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 100) return null;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const vx = window.innerWidth / 2;
      const vy = window.innerHeight / 2;
      const dx = Math.abs(cx - vx);
      const dy = Math.abs(cy - vy);
      const tolerance = Math.max(48, Math.min(window.innerWidth, window.innerHeight) * 0.1);
      return {
        ok: dx <= tolerance && dy <= tolerance,
        dx, dy, tolerance, cx, cy, vx, vy,
        left: r.left, top: r.top, width: r.width, height: r.height
      };
    })()`,
			{ label: 'settings dialog centered', timeoutMs: 10_000 }
		);

		if (!centerCheck?.ok) {
			console.error('smoke: settings dialog not centered:', JSON.stringify(centerCheck));
			await Bun.write('.agent/last-smoke-fail.png', await view.screenshot());
			process.exit(1);
		}
	}
}

const ignoredConsole = /favicon|404.*main\.js/i;
const seriousErrors = consoleErrors.filter((line) => !ignoredConsole.test(line));
if (seriousErrors.length) {
	console.error('smoke: console errors:', seriousErrors.slice(0, 5).join('\n'));
	await Bun.write('.agent/last-smoke-fail.png', await view.screenshot());
	process.exit(1);
}

console.log('smoke: exit 0');
} catch (error) {
	console.error('smoke: fatal error:', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
