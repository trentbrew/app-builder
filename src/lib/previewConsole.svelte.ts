export type PreviewConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export interface PreviewConsoleEntry {
	id: string;
	level: PreviewConsoleLevel;
	text: string;
	time: number;
}

const MAX_ENTRIES = 500;

class PreviewConsoleState {
	entries = $state<PreviewConsoleEntry[]>([]);

	append(level: PreviewConsoleLevel, args: unknown[]) {
		const text = args.map(formatPreviewConsoleArg).join(' ');
		this.entries = [
			...this.entries,
			{
				id: crypto.randomUUID(),
				level,
				text,
				time: Date.now()
			}
		].slice(-MAX_ENTRIES);
	}

	clear() {
		this.entries = [];
	}
}

export const previewConsole = new PreviewConsoleState();

export function formatPreviewConsoleArg(arg: unknown): string {
	if (typeof arg === 'string') return arg;
	if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
		return String(arg);
	}
	if (arg === undefined) return 'undefined';
	if (arg === null) return 'null';
	if (arg instanceof Error) return arg.stack ?? arg.message;

	try {
		return JSON.stringify(arg, replacer, 2);
	} catch {
		return String(arg);
	}
}

function replacer(_key: string, value: unknown) {
	if (typeof value === 'bigint') return `${value}n`;
	return value;
}
