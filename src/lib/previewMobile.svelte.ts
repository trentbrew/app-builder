import { refreshPreviewPosition } from '$lib/previewFrame';

class PreviewMobileState {
	enabled = $state(false);

	setEnabled(value: boolean) {
		if (this.enabled === value) return;
		this.enabled = value;
		refreshPreviewPosition();
	}

	toggle() {
		this.enabled = !this.enabled;
		refreshPreviewPosition();
	}

	reset() {
		this.enabled = false;
		refreshPreviewPosition();
	}
}

export const previewMobile = new PreviewMobileState();
