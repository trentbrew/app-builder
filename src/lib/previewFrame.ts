const IFRAME_CLASS = 'border-0';
const HORIZON_TAB_DRAG_SELECTOR =
	'.horizon-layout-tabgroup__tab[draggable="true"], .horizon-layout-tabgroup__tab-bar-drag';

let iframe: HTMLIFrameElement | null = null;
let park: HTMLDivElement | null = null;
let anchor: HTMLElement | null = null;
let anchorObserver: ResizeObserver | null = null;
let positionRaf: number | null = null;
let lastUrl = '';
let tabDragActive = false;
let tabDragListenersInstalled = false;

function isHorizonTabDrag(event: DragEvent) {
	const target = event.target;
	return (
		target instanceof HTMLElement && Boolean(target.closest(HORIZON_TAB_DRAG_SELECTOR))
	);
}

function installTabDragListeners() {
	if (tabDragListenersInstalled || typeof window === 'undefined') return;
	tabDragListenersInstalled = true;

	const endTabDrag = () => {
		if (!tabDragActive) return;
		tabDragActive = false;
		schedulePositionSync();
	};

	window.addEventListener(
		'dragstart',
		(event) => {
			if (!isHorizonTabDrag(event)) return;
			tabDragActive = true;
			if (iframe) syncIframePosition();
			else schedulePositionSync();
		},
		true
	);
	window.addEventListener('dragend', endTabDrag, true);
	window.addEventListener('drop', endTabDrag, true);
}

function iframeInteractionStyle() {
	if (tabDragActive) {
		return {
			pointerEvents: 'none',
			opacity: '0'
		} as const;
	}

	return {
		pointerEvents: 'auto',
		opacity: '1'
	} as const;
}

function ensurePark() {
	if (park?.isConnected) return park;

	park = document.createElement('div');
	park.dataset.previewPark = '';
	park.setAttribute('aria-hidden', 'true');
	Object.assign(park.style, {
		position: 'fixed',
		left: '-120vw',
		top: '0',
		width: '800px',
		height: '600px',
		overflow: 'hidden',
		opacity: '0',
		pointerEvents: 'none',
		zIndex: '-1'
	});
	document.body.appendChild(park);
	return park;
}

function ensureIframe() {
	if (iframe) return iframe;

	installTabDragListeners();

	iframe = document.createElement('iframe');
	iframe.title = 'Svelte REPL Preview';
	iframe.allow = 'cross-origin-isolated';
	iframe.className = IFRAME_CLASS;
	iframe.style.position = 'fixed';
	iframe.style.border = '0';
	iframe.style.margin = '0';
	iframe.style.padding = '0';
	iframe.style.background = 'transparent';
	return iframe;
}

function parkIframe() {
	if (!iframe) return;
	const target = ensurePark();
	if (iframe.parentElement !== target) {
		target.appendChild(iframe);
	}
	Object.assign(iframe.style, {
		left: '-120vw',
		top: '0',
		width: `${target.clientWidth || 800}px`,
		height: `${target.clientHeight || 600}px`,
		visibility: 'hidden',
		opacity: '1',
		pointerEvents: 'none',
		zIndex: '-1'
	});
}

function schedulePositionSync() {
	if (positionRaf !== null) return;
	positionRaf = requestAnimationFrame(() => {
		positionRaf = null;
		syncIframePosition();
	});
}

function syncIframePosition() {
	if (!iframe) return;

	if (!anchor?.isConnected) {
		parkIframe();
		return;
	}

	const rect = anchor.getBoundingClientRect();
	if (rect.width < 2 || rect.height < 2) {
		parkIframe();
		return;
	}

	if (iframe.parentElement !== document.body) {
		document.body.appendChild(iframe);
	}

	Object.assign(iframe.style, {
		left: `${rect.left}px`,
		top: `${rect.top}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		visibility: 'visible',
		zIndex: '5',
		...iframeInteractionStyle()
	});
}

if (typeof window !== 'undefined') {
	installTabDragListeners();
}

export function setPreviewUrl(url: string) {
	if (!url) return;

	const frame = ensureIframe();
	if (lastUrl !== url) {
		frame.src = url;
		lastUrl = url;
	}
	schedulePositionSync();
}

export function refreshPreviewPosition() {
	schedulePositionSync();
}

export function registerPreviewAnchor(node: HTMLElement) {
	installTabDragListeners();
	anchor = node;
	schedulePositionSync();

	anchorObserver?.disconnect();
	anchorObserver = new ResizeObserver(() => schedulePositionSync());
	anchorObserver.observe(node);

	const onLayoutChange = () => schedulePositionSync();
	window.addEventListener('scroll', onLayoutChange, true);
	window.addEventListener('resize', onLayoutChange);

	return () => {
		anchorObserver?.disconnect();
		anchorObserver = null;
		window.removeEventListener('scroll', onLayoutChange, true);
		window.removeEventListener('resize', onLayoutChange);

		if (anchor !== node) return;
		anchor = null;
		parkIframe();
	};
}
