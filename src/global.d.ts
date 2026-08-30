// global.d.ts
// Declare modules for xterm and its CSS to satisfy TypeScript

/** Short git SHA of the tree that built this bundle; `unknown` outside a repo. */
declare const __APP_BUILDER_BUILD_ID__: string;

declare module '@xterm/xterm';
declare module '@xterm/xterm/css/xterm.css';

declare module '*?raw' {
	const content: string;
	export default content;
}

declare module 'qrcode' {
	export function toCanvas(
		canvas: HTMLCanvasElement,
		text: string,
		options?: {
			width?: number;
			margin?: number;
			color?: { dark?: string; light?: string };
		}
	): Promise<void>;
}

declare namespace svelteHTML {
	interface IntrinsicElements {
		'model-viewer': import('svelte/elements').HTMLAttributes<HTMLElement> & {
			src?: string;
			'camera-controls'?: boolean | '';
			'auto-rotate'?: boolean | '';
			'shadow-intensity'?: string | number;
			exposure?: string | number;
			'interaction-prompt'?: string;
			autoplay?: boolean | '';
		};
	}
}
