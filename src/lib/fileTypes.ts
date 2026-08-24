export type MarkdownEditorMode = 'rich' | 'raw';
export type FileViewMode = 'rich' | 'raw' | 'table';

export type FileKind = 'markdown' | 'csv' | 'pdf' | 'video' | 'audio' | 'image' | 'code';

const RUNNABLE_EXTENSIONS = new Set(['svelte', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx']);
const CSV_EXTENSIONS = new Set(['csv', 'tsv', 'tab']);
const PDF_EXTENSIONS = new Set(['pdf']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'aac', 'm4a', 'oga', 'opus', 'weba']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico']);

export const LARGE_FILE_BYTES = 256 * 1024;
export const LARGE_FILE_LINES = 5_000;

export function extensionOf(path: string): string {
	const base = path.split('/').pop() ?? path;
	const dot = base.lastIndexOf('.');
	if (dot <= 0) return '';
	return base.slice(dot + 1).toLowerCase();
}

export function isMarkdownPath(path: string): boolean {
	const ext = extensionOf(path);
	return ext === 'md' || ext === 'markdown';
}

/** Files whose contents can be synced/run in the sandbox preview pipeline. */
export function isRunnablePath(path: string): boolean {
	return RUNNABLE_EXTENSIONS.has(extensionOf(path));
}

export function isCsvPath(path: string): boolean {
	return CSV_EXTENSIONS.has(extensionOf(path));
}

export function isPdfPath(path: string): boolean {
	return PDF_EXTENSIONS.has(extensionOf(path));
}

export function isVideoPath(path: string): boolean {
	return VIDEO_EXTENSIONS.has(extensionOf(path));
}

export function isAudioPath(path: string): boolean {
	return AUDIO_EXTENSIONS.has(extensionOf(path));
}

export function isImagePath(path: string): boolean {
	return IMAGE_EXTENSIONS.has(extensionOf(path));
}

/** Binary files that should not be loaded or saved as UTF-8 text. */
export function isBinaryPreviewPath(path: string): boolean {
	return isPdfPath(path) || isVideoPath(path) || isAudioPath(path) || isImagePath(path);
}

export function fileKindForPath(path: string): FileKind {
	if (isMarkdownPath(path)) return 'markdown';
	if (isCsvPath(path)) return 'csv';
	if (isPdfPath(path)) return 'pdf';
	if (isVideoPath(path)) return 'video';
	if (isAudioPath(path)) return 'audio';
	if (isImagePath(path)) return 'image';
	return 'code';
}

export function mimeTypeForPath(path: string): string {
	switch (extensionOf(path)) {
		case 'pdf':
			return 'application/pdf';
		case 'mp4':
		case 'm4v':
			return 'video/mp4';
		case 'webm':
			return 'video/webm';
		case 'ogv':
			return 'video/ogg';
		case 'mov':
			return 'video/quicktime';
		case 'mp3':
			return 'audio/mpeg';
		case 'wav':
			return 'audio/wav';
		case 'flac':
			return 'audio/flac';
		case 'aac':
			return 'audio/aac';
		case 'm4a':
			return 'audio/mp4';
		case 'oga':
		case 'ogg':
			return 'audio/ogg';
		case 'opus':
			return 'audio/opus';
		case 'weba':
			return 'audio/webm';
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'avif':
			return 'image/avif';
		case 'bmp':
			return 'image/bmp';
		case 'ico':
			return 'image/x-icon';
		case 'csv':
			return 'text/csv';
		case 'tsv':
		case 'tab':
			return 'text/tab-separated-values';
		default:
			return 'application/octet-stream';
	}
}

export function isLargeText(text: string): boolean {
	if (text.length > LARGE_FILE_BYTES) return true;
	let lines = 1;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 10) {
			lines++;
			if (lines > LARGE_FILE_LINES) return true;
		}
	}
	return false;
}

export function isLargeDoc(length: number, lines: number): boolean {
	return length > LARGE_FILE_BYTES || lines > LARGE_FILE_LINES;
}
