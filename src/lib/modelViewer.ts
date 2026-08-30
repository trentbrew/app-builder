import { browser } from '$app/environment';

let loading: Promise<void> | null = null;

export function ensureModelViewer(): Promise<void> {
	if (!browser) return Promise.resolve();
	if (customElements.get('model-viewer')) return Promise.resolve();
	if (!loading) {
		loading = import('@google/model-viewer').then(() => undefined);
	}
	return loading;
}
