import { expect, test } from '@playwright/test';
import {
	createExpoProject,
	readSandboxFile,
	readSandboxLogs,
	readSandboxState,
	waitForExpoPreviewReady
} from './helpers/sandbox';
import { EXPO_COMPAT_VERSION, EXPO_DEV_SCRIPT } from '../src/lib/projects/templates/expoConstants';

test.describe('Expo preview boot', () => {
	test.describe.configure({ mode: 'serial' });

	test('fresh Expo project boots dev server and bundles web preview', async ({ page }) => {
		test.setTimeout(600_000);

		await createExpoProject(page, `E2E Expo ${Date.now()}`);
		await waitForExpoPreviewReady(page);

		const pkgRaw = await readSandboxFile(page, 'package.json');
		const pkg = JSON.parse(pkgRaw) as {
			scripts?: { dev?: string };
			appBuilderExpoCompat?: string;
		};
		expect(pkg.scripts?.dev).toBe(EXPO_DEV_SCRIPT);
		expect(pkg.appBuilderExpoCompat).toBe(EXPO_COMPAT_VERSION);

		await expect(readSandboxFile(page, 'expo-dev.cjs')).resolves.toContain('wc-preload.cjs');
		await expect(readSandboxFile(page, 'wc-preload.cjs')).resolves.toContain('caller-callsite');

		const state = await readSandboxState(page);
		expect(state?.error).toBe('');
		expect(state?.previewUrl).toMatch(/^https?:\/\//);

		const logs = await readSandboxLogs(page);
		const joined = logs.join('\n');
		expect(joined).not.toMatch(/getFileName|callerCallsite/i);
		expect(joined).toMatch(/Web Bundled|Server ready at/i);

		await expect(page.getByRole('heading', { name: 'Error' })).toHaveCount(0);
	});

	test('Expo project survives reload with dev server still healthy', async ({ page }) => {
		test.setTimeout(600_000);

		await createExpoProject(page, `E2E Expo Reload ${Date.now()}`);
		await waitForExpoPreviewReady(page);

		const url = page.url();
		await page.reload();
		await expect(page).toHaveURL(url);
		await waitForExpoPreviewReady(page);

		const logs = await readSandboxLogs(page);
		expect(logs.join('\n')).not.toMatch(/getFileName|callerCallsite/i);
	});
});
