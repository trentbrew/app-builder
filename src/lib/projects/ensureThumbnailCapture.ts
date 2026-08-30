import type { WebContainer } from '@webcontainer/api';
import { THUMBNAIL_CAPTURE_MARKER, thumbnailCaptureScriptTag } from '$lib/projects/thumbnailCaptureScript';

export async function ensureThumbnailCaptureScript(
	container: WebContainer,
	htmlPath = 'index.html'
): Promise<void> {
	try {
		let html = await container.fs.readFile(htmlPath, 'utf-8');
		if (html.includes(THUMBNAIL_CAPTURE_MARKER)) return;

		const tag = thumbnailCaptureScriptTag();
		html = html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : `${html}\n${tag}\n`;
		await container.fs.writeFile(htmlPath, html);
	} catch (error) {
		// Expo and other bundler-first templates have no static index.html — expected.
		if (isMissingFileError(error)) return;
		console.warn('Failed to inject thumbnail capture script:', error);
	}
}

function isMissingFileError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const code = (error as { code?: string }).code;
	return code === 'ENOENT' || (error instanceof Error && error.message.includes('ENOENT'));
}
