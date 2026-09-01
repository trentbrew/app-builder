import { getContext, setContext } from 'svelte';

export type ScrollPosition = 'start' | 'end' | 'last-anchor';
export type ScrollAlign = 'start' | 'center' | 'end' | 'nearest';

export type MessageScrollerOptions = {
	autoScroll?: boolean;
	defaultScrollPosition?: ScrollPosition;
	scrollEdgeThreshold?: number;
	scrollMargin?: number;
	scrollPreviousItemPeek?: number;
};

export type ScrollCommandOptions = {
	align?: ScrollAlign;
	behavior?: ScrollBehavior;
	scrollMargin?: number;
	/** When false, programmatic scroll does not release auto-scroll follow. */
	releaseFollow?: boolean;
};

type ItemRecord = {
	el: HTMLElement;
	scrollAnchor: boolean;
	order: number;
};

const SYMBOL_KEY = 'scn-message-scroller';

export class MessageScrollerState {
	autoScroll: boolean;
	defaultScrollPosition: ScrollPosition;
	scrollEdgeThreshold: number;
	scrollMargin: number;
	scrollPreviousItemPeek: number;

	root = $state<HTMLElement | null>(null);
	viewport = $state<HTMLElement | null>(null);
	content = $state<HTMLElement | null>(null);
	spacer = $state<HTMLElement | null>(null);

	scrollableStart = $state(false);
	scrollableEnd = $state(false);
	autoscrolling = $state(false);
	following = $state(false);

	currentAnchorId = $state<string | null>(null);
	visibleMessageIds = $state<string[]>([]);

	private items = new Map<string, ItemRecord>();
	private itemOrder = 0;
	private opened = false;
	private userReleased = false;
	private pendingScrollMessageId: string | null = null;
	private prependAnchor: { id: string; offset: number } | null = null;
	private visibilitySubscribers = 0;
	private resizeObserver: ResizeObserver | null = null;
	private intersectionObserver: IntersectionObserver | null = null;
	private scrollRaf: number | null = null;
	private autoscrollTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(options: MessageScrollerOptions = {}) {
		this.autoScroll = options.autoScroll ?? false;
		this.defaultScrollPosition = options.defaultScrollPosition ?? 'end';
		this.scrollEdgeThreshold = options.scrollEdgeThreshold ?? 8;
		this.scrollMargin = options.scrollMargin ?? 0;
		this.scrollPreviousItemPeek = options.scrollPreviousItemPeek ?? 64;
	}

	setRoot(el: HTMLElement | null) {
		this.root = el;
		this.syncDataAttributes();
	}

	setViewport(el: HTMLElement | null) {
		if (this.viewport === el) return;
		this.detachViewportListeners();
		this.viewport = el;
		if (el) this.attachViewportListeners();
		this.syncDataAttributes();
	}

	setContent(el: HTMLElement | null) {
		if (this.content === el) return;
		this.detachContentObserver();
		this.content = el;
		if (el) this.attachContentObserver();
	}

	setSpacer(el: HTMLElement | null) {
		this.spacer = el;
	}

	registerItem(messageId: string, el: HTMLElement, scrollAnchor: boolean) {
		const existing = this.items.get(messageId);
		if (existing) {
			existing.el = el;
			existing.scrollAnchor = scrollAnchor;
			return;
		}

		const record: ItemRecord = { el, scrollAnchor, order: this.itemOrder++ };
		this.items.set(messageId, record);

		if (this.prependAnchor?.id === messageId) {
			this.restorePrependPosition();
		}

		if (this.pendingScrollMessageId === messageId) {
			this.pendingScrollMessageId = null;
			this.scrollToMessage(messageId);
		}

		if (!this.opened && this.items.size > 0) {
			this.opened = true;
			queueMicrotask(() => this.applyInitialScrollPosition());
		}

		if (scrollAnchor) {
			queueMicrotask(() => this.maybeAnchorTurn(messageId, record));
		}

		this.scheduleScrollStateUpdate();
		this.updateVisibility();
	}

	unregisterItem(messageId: string) {
		this.items.delete(messageId);
		this.scheduleScrollStateUpdate();
		this.updateVisibility();
	}

	beginPrepend() {
		if (!this.viewport) return;
		const anchor = this.findFirstVisibleItem();
		if (!anchor) return;
		this.prependAnchor = {
			id: anchor.id,
			offset: anchor.el.offsetTop - this.viewport.scrollTop,
		};
	}

	endPrepend() {
		if (!this.prependAnchor) return;
		this.restorePrependPosition();
		this.prependAnchor = null;
	}

	scrollToMessage(messageId: string, options: ScrollCommandOptions = {}): boolean {
		const record = this.items.get(messageId);
		if (!record || !this.viewport) {
			this.pendingScrollMessageId = messageId;
			return false;
		}

		if (options.releaseFollow !== false) {
			this.userReleased = true;
			this.following = false;
		}
		this.scrollElementIntoView(record.el, options);
		return true;
	}

	scrollToEnd(options: ScrollCommandOptions = {}): boolean {
		if (!this.viewport) return false;

		this.autoscrolling = true;
		this.syncDataAttributes();

		const behavior = options.behavior ?? 'smooth';
		this.viewport.scrollTo({ top: this.viewport.scrollHeight, behavior });

		if (this.autoScroll) {
			if (options.releaseFollow !== false) {
				this.userReleased = false;
			}
			this.following = true;
		}

		window.setTimeout(() => {
			this.autoscrolling = false;
			this.syncDataAttributes();
			this.scheduleScrollStateUpdate();
		}, behavior === 'smooth' ? 240 : 0);

		return true;
	}

	scrollToStart(options: ScrollCommandOptions = {}): boolean {
		if (!this.viewport) return false;
		if (options.releaseFollow !== false) {
			this.userReleased = true;
			this.following = false;
		}
		this.viewport.scrollTo({
			top: 0,
			behavior: options.behavior ?? 'auto',
		});
		this.scheduleScrollStateUpdate();
		return true;
	}

	subscribeVisibility() {
		this.visibilitySubscribers += 1;
		if (this.visibilitySubscribers === 1) this.attachVisibilityObserver();
		this.updateVisibility();
		return () => {
			this.visibilitySubscribers = Math.max(0, this.visibilitySubscribers - 1);
			if (this.visibilitySubscribers === 0) this.detachVisibilityObserver();
		};
	}

	destroy() {
		this.detachViewportListeners();
		this.detachContentObserver();
		this.detachVisibilityObserver();
		if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
		if (this.autoscrollTimer) clearTimeout(this.autoscrollTimer);
	}

	private attachViewportListeners() {
		const viewport = this.viewport;
		if (!viewport) return;

		viewport.addEventListener('scroll', this.handleViewportScroll, { passive: true });
		viewport.addEventListener('wheel', this.releaseFollow, { passive: true });
		viewport.addEventListener('touchstart', this.releaseFollow, { passive: true });
		viewport.addEventListener('keydown', this.handleViewportKeydown);
	}

	private detachViewportListeners() {
		const viewport = this.viewport;
		if (!viewport) return;

		viewport.removeEventListener('scroll', this.handleViewportScroll);
		viewport.removeEventListener('wheel', this.releaseFollow);
		viewport.removeEventListener('touchstart', this.releaseFollow);
		viewport.removeEventListener('keydown', this.handleViewportKeydown);
	}

	/** Called when transcript layout changes outside ResizeObserver (e.g. streamed markdown). */
	notifyLayoutChange() {
		this.followLiveOutput();
	}

	/** Follow streamed assistant output unless the user has scrolled away. */
	followStreamingOutput() {
		if (!this.autoScroll || this.userReleased) return;
		this.scrollToEnd({ behavior: 'auto', releaseFollow: false });
	}

	private attachContentObserver() {
		if (!this.content || typeof ResizeObserver === 'undefined') return;

		this.resizeObserver = new ResizeObserver(() => {
			this.followLiveOutput();
			this.scheduleScrollStateUpdate();
		});
		this.resizeObserver.observe(this.content);
	}

	private followLiveOutput() {
		if (!this.autoScroll || this.userReleased) return;

		if (this.following) {
			this.scrollToEnd({ behavior: 'auto', releaseFollow: false });
			return;
		}

		this.followOutputIfNeeded();
	}

	private followOutputIfNeeded() {
		const viewport = this.viewport;
		if (!viewport) return;

		const overflow =
			viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);

		if (overflow <= this.scrollEdgeThreshold) return;

		viewport.scrollTo({
			top: viewport.scrollHeight - viewport.clientHeight,
			behavior: 'auto',
		});

		if (this.isAtEnd()) {
			this.following = true;
		}
	}

	private detachContentObserver() {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	private attachVisibilityObserver() {
		if (typeof IntersectionObserver === 'undefined') return;

		this.intersectionObserver = new IntersectionObserver(
			() => this.updateVisibility(),
			{ root: this.viewport, threshold: [0, 0.25, 0.5, 0.75, 1] },
		);

		for (const record of this.items.values()) {
			this.intersectionObserver.observe(record.el);
		}
	}

	private detachVisibilityObserver() {
		this.intersectionObserver?.disconnect();
		this.intersectionObserver = null;
	}

	private handleViewportScroll = () => {
		this.scheduleScrollStateUpdate();

		if (this.autoScroll && this.following && !this.isAtEnd()) {
			this.following = false;
			this.userReleased = true;
		}
	};

	private releaseFollow = () => {
		if (!this.autoScroll) return;
		this.following = false;
		this.userReleased = true;
	};

	private handleViewportKeydown = (event: KeyboardEvent) => {
		const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
		if (keys.includes(event.key)) this.releaseFollow();
	};

	private scheduleScrollStateUpdate() {
		if (this.scrollRaf !== null) return;
		this.scrollRaf = requestAnimationFrame(() => {
			this.scrollRaf = null;
			this.updateScrollableState();
		});
	}

	private updateScrollableState() {
		const viewport = this.viewport;
		if (!viewport) {
			this.scrollableStart = false;
			this.scrollableEnd = false;
			this.following = false;
			return;
		}

		const threshold = this.scrollEdgeThreshold;
		const atStart = viewport.scrollTop <= threshold;
		const atEnd =
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;

		this.scrollableStart = !atStart;
		this.scrollableEnd = !atEnd;

		if (this.autoScroll && !this.userReleased && atEnd) {
			this.following = true;
		}

		this.syncDataAttributes();
	}

	private syncDataAttributes() {
		const tokens: string[] = [];
		if (this.scrollableStart) tokens.push('start');
		if (this.scrollableEnd) tokens.push('end');
		const scrollable = tokens.length ? tokens.join(' ') : null;

		for (const el of [this.root, this.viewport]) {
			if (!el) continue;
			if (scrollable) el.setAttribute('data-scrollable', scrollable);
			else el.removeAttribute('data-scrollable');
			if (this.autoscrolling) el.setAttribute('data-autoscrolling', '');
			else el.removeAttribute('data-autoscrolling');
		}
	}

	private isAtEnd(): boolean {
		const viewport = this.viewport;
		if (!viewport) return true;
		return (
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <=
			this.scrollEdgeThreshold
		);
	}

	private applyInitialScrollPosition() {
		const options: ScrollCommandOptions = { behavior: 'auto', releaseFollow: false };

		switch (this.defaultScrollPosition) {
			case 'start':
				this.scrollToStart(options);
				break;
			case 'last-anchor':
				this.scrollToLastAnchor(options);
				break;
			default:
				this.scrollToEnd(options);
		}
	}

	private scrollToLastAnchor(options: ScrollCommandOptions) {
		const anchors = [...this.items.entries()]
			.filter(([, record]) => record.scrollAnchor)
			.sort((a, b) => a[1].order - b[1].order);

		const last = anchors.at(-1);
		if (!last) {
			this.scrollToEnd(options);
			return;
		}

		this.scrollToMessage(last[0], { ...options, releaseFollow: false });
	}

	private maybeAnchorTurn(messageId: string, record: ItemRecord) {
		if (!this.viewport || !this.content) return;

		const anchors = [...this.items.values()].filter((item) => item.scrollAnchor);
		if (anchors.length <= 1 && this.defaultScrollPosition !== 'start') return;

		const isLatestAnchor = [...this.items.entries()]
			.filter(([, item]) => item.scrollAnchor)
			.sort((a, b) => a[1].order - b[1].order)
			.at(-1)?.[0] === messageId;

		if (!isLatestAnchor) return;

		this.updateSpacerForAnchor(record.el);
		const targetTop = Math.max(
			0,
			record.el.offsetTop - this.scrollMargin - this.scrollPreviousItemPeek,
		);
		this.viewport.scrollTo({ top: targetTop, behavior: 'auto' });
		// Stay in anchored mode until streamed output reaches the live edge.
		this.following = false;
		this.scheduleScrollStateUpdate();
	}

	private updateSpacerForAnchor(_anchorEl: HTMLElement) {
		if (!this.spacer) return;
		this.spacer.style.height = '0.5rem';
	}

	private scrollElementIntoView(el: HTMLElement, options: ScrollCommandOptions) {
		const viewport = this.viewport;
		if (!viewport) return;

		const margin = options.scrollMargin ?? this.scrollMargin;
		const align = options.align ?? 'start';
		const behavior = options.behavior ?? 'auto';

		let top = el.offsetTop - margin;
		if (align === 'center') {
			top = el.offsetTop - viewport.clientHeight / 2 + el.clientHeight / 2;
		} else if (align === 'end') {
			top = el.offsetTop - viewport.clientHeight + el.clientHeight + margin;
		} else if (align === 'nearest') {
			const above = el.offsetTop - viewport.scrollTop;
			const below = above + el.clientHeight - viewport.clientHeight;
			if (above < 0) top = el.offsetTop - margin;
			else if (below > 0) top = el.offsetTop - viewport.clientHeight + el.clientHeight + margin;
			else return;
		}

		viewport.scrollTo({ top: Math.max(0, top), behavior });
		this.scheduleScrollStateUpdate();
	}

	private findFirstVisibleItem(): { id: string; el: HTMLElement } | null {
		const viewport = this.viewport;
		if (!viewport) return null;

		const viewportTop = viewport.scrollTop;
		const viewportBottom = viewportTop + viewport.clientHeight;

		for (const [id, record] of [...this.items.entries()].sort(
			(a, b) => a[1].order - b[1].order,
		)) {
			const top = record.el.offsetTop;
			const bottom = top + record.el.clientHeight;
			if (bottom > viewportTop && top < viewportBottom) {
				return { id, el: record.el };
			}
		}

		return null;
	}

	private restorePrependPosition() {
		const viewport = this.viewport;
		const anchor = this.prependAnchor;
		if (!viewport || !anchor) return;

		const record = this.items.get(anchor.id);
		if (!record) return;

		viewport.scrollTop = record.el.offsetTop - anchor.offset;
		this.scheduleScrollStateUpdate();
	}

	private updateVisibility() {
		if (this.visibilitySubscribers <= 0) return;

		const viewport = this.viewport;
		if (!viewport) return;

		const viewportTop = viewport.scrollTop;
		const viewportBottom = viewportTop + viewport.clientHeight;
		const visible: string[] = [];
		let anchor: string | null = null;

		for (const [id, record] of [...this.items.entries()].sort(
			(a, b) => a[1].order - b[1].order,
		)) {
			const top = record.el.offsetTop;
			const bottom = top + record.el.clientHeight;
			if (bottom > viewportTop && top < viewportBottom) visible.push(id);
			if (record.scrollAnchor && top <= viewportTop + this.scrollMargin + 4) {
				anchor = id;
			}
		}

		this.visibleMessageIds = visible;
		this.currentAnchorId = anchor;
	}
}

export function setMessageScroller(options: MessageScrollerOptions = {}): MessageScrollerState {
	return setContext(Symbol.for(SYMBOL_KEY), new MessageScrollerState(options));
}

export function useMessageScroller(): MessageScrollerState {
	return getContext<MessageScrollerState>(Symbol.for(SYMBOL_KEY));
}
