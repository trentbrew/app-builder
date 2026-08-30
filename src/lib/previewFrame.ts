const IFRAME_CLASS = 'border-0';
const HORIZON_TAB_DRAG_SELECTOR =
	'.horizon-layout-tabgroup__tab[draggable="true"], .horizon-layout-tabgroup__tab-bar-drag';

let iframe: HTMLIFrameElement | null = null;
let park: HTMLDivElement | null = null;
let anchor: HTMLElement | null = null;
let chromeAnchor: HTMLElement | null = null;
let chromeLayer: HTMLDivElement | null = null;
let anchorObserver: ResizeObserver | null = null;
let chromeObserver: ResizeObserver | null = null;
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
	iframe.title = 'Agent guest preview';
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

function ensureChromeLayer() {
	if (chromeLayer?.isConnected) return chromeLayer;

	chromeLayer = document.createElement('div');
	chromeLayer.dataset.previewChrome = '';
	chromeLayer.setAttribute('aria-hidden', 'true');
	Object.assign(chromeLayer.style, {
		position: 'fixed',
		pointerEvents: 'none',
		zIndex: '6',
		visibility: 'hidden'
	});
	document.body.appendChild(chromeLayer);
	return chromeLayer;
}

function parkChrome() {
	if (!chromeLayer) return;
	Object.assign(chromeLayer.style, {
		left: '-120vw',
		top: '0',
		width: '0',
		height: '0',
		visibility: 'hidden'
	});
}

function syncChromePosition() {
	if (!chromeAnchor?.isConnected) {
		parkChrome();
		return;
	}

	const rect = chromeAnchor.getBoundingClientRect();
	if (rect.width < 2 || rect.height < 2) {
		parkChrome();
		return;
	}

	const layer = ensureChromeLayer();
	if (layer.parentElement !== document.body) {
		document.body.appendChild(layer);
	}

	Object.assign(layer.style, {
		left: `${rect.left}px`,
		top: `${rect.top}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		visibility: 'visible'
	});
}

function schedulePositionSync() {
	if (positionRaf !== null) return;
	positionRaf = requestAnimationFrame(() => {
		positionRaf = null;
		syncIframePosition();
		syncChromePosition();
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

	const cardStyle = document.documentElement.dataset.editorPaneStyle === 'cards';
	const paneRadius =
		getComputedStyle(document.documentElement).getPropertyValue('--editor-pane-radius').trim() ||
		'0';
	const isMobileScreen = anchor.dataset.previewScreen === 'mobile';
	const iframeRadius = isMobileScreen ? 'calc(2.25rem - 3px)' : cardStyle ? paneRadius : '0';

	Object.assign(iframe.style, {
		left: `${rect.left}px`,
		top: `${rect.top}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		visibility: 'visible',
		zIndex: '5',
		borderRadius: iframeRadius,
		borderBottomLeftRadius: cardStyle && !isMobileScreen ? paneRadius : iframeRadius,
		borderBottomRightRadius: cardStyle && !isMobileScreen ? paneRadius : iframeRadius,
		overflow: 'hidden',
		...iframeInteractionStyle()
	});
}

if (typeof window !== 'undefined') {
	installTabDragListeners();
}

let glowTimer: ReturnType<typeof setTimeout> | null = null;

const AGENT_GLOW =
	'2px solid color-mix(in oklch, var(--color-primary) 45%, transparent)';

/** Brief border tint on preview iframe after agent write (respects reduced motion). */
export function triggerAgentGlow() {
	if (!iframe) return;
	const reduced =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	iframe.style.boxShadow = AGENT_GLOW;
	if (glowTimer) clearTimeout(glowTimer);
	const duration = reduced ? 0 : 2000;
	if (duration === 0) {
		iframe.style.boxShadow = '';
		return;
	}
	glowTimer = setTimeout(() => {
		if (iframe) iframe.style.boxShadow = '';
		glowTimer = null;
	}, duration);
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

export function clearPreviewFrame() {
	lastUrl = '';
	if (iframe) {
		iframe.src = 'about:blank';
		parkIframe();
	}
}

export function refreshPreviewPosition() {
	schedulePositionSync();
}

export function requestPreviewThumbnail(timeoutMs = 15000): Promise<string | null> {
	if (!iframe?.contentWindow) return Promise.resolve(null);

	const requestId = crypto.randomUUID();

	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			window.removeEventListener('message', onMessage);
			resolve(null);
		}, timeoutMs);

		function onMessage(event: MessageEvent) {
			const data = event.data as {
				v?: number;
				type?: string;
				requestId?: string;
				ok?: boolean;
				dataUrl?: string;
			};
			if (
				data?.v !== 1 ||
				data.type !== 'app-builder-thumbnail-result' ||
				data.requestId !== requestId
			) {
				return;
			}

			clearTimeout(timer);
			window.removeEventListener('message', onMessage);
			resolve(data.ok && data.dataUrl ? data.dataUrl : null);
		}

		window.addEventListener('message', onMessage);
		iframe!.contentWindow!.postMessage(
			{ v: 1, type: 'app-builder-capture-thumbnail', requestId },
			'*'
		);
	});
}

export function registerPreviewChrome(node: HTMLElement) {
	installTabDragListeners();
	chromeAnchor = node;
	schedulePositionSync();

	chromeObserver?.disconnect();
	chromeObserver = new ResizeObserver(() => schedulePositionSync());
	chromeObserver.observe(node);

	return () => {
		chromeObserver?.disconnect();
		chromeObserver = null;

		if (chromeAnchor !== node) return;
		chromeAnchor = null;
		parkChrome();
	};
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
