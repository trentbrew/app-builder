import { browser } from '$app/environment';
import { sandboxStore } from '$lib/sandboxStore';
import { loadTerminalFont, TERMINAL_FONT_FAMILY } from '$lib/settings/fonts';
import { settings } from '$lib/settings/store.svelte';
import { xtermThemeFromDocument } from '$lib/terminalTheme';
import { THEME_CHANGE_EVENT } from '$lib/theme/apply';

type XtermTerminal = {
	cols: number;
	rows: number;
	element?: HTMLElement;
	options: { theme?: Record<string, string>; fontFamily?: string; fontSize?: number; scrollback?: number };
	buffer: { active: { viewportY: number; length: number } };
	open: (container: HTMLElement) => void;
	resize: (cols: number, rows: number) => void;
	onData: (handler: (data: string) => void) => void;
	onScroll: (handler: () => void) => void;
	onLineFeed: (handler: () => void) => void;
	write: (data: string) => void;
	writeln: (data: string) => void;
	scrollToBottom: () => void;
	dispose: () => void;
	_core?: {
		_renderService?: {
			dimensions?: { css?: { cell?: { width?: number; height?: number } } };
			clear?: () => void;
		};
	};
};

type ShellProcess = {
	kill: () => void;
	exit: Promise<number>;
	resize?: (dimensions: { cols: number; rows: number }) => void;
	input: { getWriter: () => { write: (data: string) => void; releaseLock: () => void } };
	output: ReadableStream<string>;
};

type PreviewMessageHandler = (msg: { message?: string; args?: unknown[] }) => void;

class TerminalSession {
	readonly sessionId: string;
	private attachPreviewMessages = false;
	private containerEl: HTMLElement | null = null;
	private xterm: XtermTerminal | null = null;
	private process: ShellProcess | undefined;
	private unsubscribe: (() => void) | undefined;
	private writer: { write: (data: string) => void; releaseLock: () => void } | undefined;
	private resizeObserver: ResizeObserver | null = null;
	private fitRafId: number | null = null;
	private fitFollowupTimers: ReturnType<typeof setTimeout>[] = [];
	private userScrolledUp = false;
	private spawning = false;
	private attachedContainer: unknown = null;
	private bunSocket: WebSocket | null = null;
	private bunConnecting = false;
	private bunInputQueue: string[] = [];
	private bunConnectAttempts = 0;
	private previewMessageHandler: PreviewMessageHandler | null = null;
	private initPromise: Promise<void> | null = null;
	private disposed = false;
	private themeListener: (() => void) | null = null;

	constructor(sessionId: string) {
		this.sessionId = sessionId;
	}

	setAttachPreviewMessages(value: boolean) {
		if (this.attachPreviewMessages === value) return;
		this.attachPreviewMessages = value;
		this.syncPreviewMessageListener();
	}

	attach(container: HTMLElement) {
		if (this.disposed) return;
		void this.ensureInitialized().then(() => {
			if (this.disposed || this.containerEl === container) return;
			this.mountElement(container);
		});
	}

	detach(container: HTMLElement) {
		if (this.containerEl !== container) return;
		this.teardownResizeObserver();
		const element = this.xterm?.element;
		if (element?.parentElement === container) {
			element.remove();
		}
		this.containerEl = null;
	}

	scheduleFit() {
		if (this.fitRafId !== null) cancelAnimationFrame(this.fitRafId);
		this.fitRafId = requestAnimationFrame(() => this.safeFit());
	}

	/** RAF fit plus delayed passes — layout/maximize often settles after the first frame. */
	scheduleFitWithFollowups() {
		this.scheduleFit();
		this.clearFitFollowups();
		for (const delay of [50, 150, 400]) {
			this.fitFollowupTimers.push(
				setTimeout(() => {
					if (!this.disposed) this.safeFit();
				}, delay)
			);
		}
	}

	private clearFitFollowups() {
		for (const timer of this.fitFollowupTimers) clearTimeout(timer);
		this.fitFollowupTimers = [];
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;

		if (this.fitRafId !== null) cancelAnimationFrame(this.fitRafId);
		this.clearFitFollowups();
		this.teardownResizeObserver();
		this.teardownPreviewMessageListener();
		if (this.themeListener) {
			document.removeEventListener(THEME_CHANGE_EVENT, this.themeListener);
			this.themeListener = null;
		}
		if (this.unsubscribe) this.unsubscribe();

		if (this.bunSocket) {
			this.bunSocket.onclose = null;
			try {
				this.bunSocket.close();
			} catch {
				// ignore
			}
			this.bunSocket = null;
		}

		if (this.writer) {
			try {
				this.writer.releaseLock();
			} catch {
				// ignore
			}
			this.writer = undefined;
		}

		if (this.process) {
			try {
				this.process.kill();
			} catch {
				// ignore
			}
			this.process = undefined;
		}

		if (this.xterm) {
			this.xterm.dispose();
			this.xterm = null;
		}

		this.containerEl = null;
		this.attachedContainer = null;
	}

	private async ensureInitialized() {
		if (!browser || this.disposed) return;
		if (this.xterm) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = this.initialize();
		try {
			await this.initPromise;
		} finally {
			this.initPromise = null;
		}
	}

	private async initialize() {
		const { Terminal } = await import('@xterm/xterm');
		await import('@xterm/xterm/css/xterm.css');

		if (typeof Terminal !== 'function' || this.disposed) return;

		await loadTerminalFont(settings.typography.terminalFontSize);

		const xterm = new Terminal({
			convertEol: true,
			cursorBlink: true,
			scrollback: 10000,
			fontFamily: TERMINAL_FONT_FAMILY,
			fontSize: settings.typography.terminalFontSize,
			theme: xtermThemeFromDocument()
		}) as unknown as XtermTerminal;

		this.xterm = xterm;

		xterm.onData((data: string) => {
			if (this.bunSocket || this.bunInputQueue.length > 0) this.sendBunInput(data);
			else if (this.writer) this.writer.write(data);
		});

		xterm.onScroll(() => {
			this.syncUserScrollState();
		});

		xterm.onLineFeed(() => {
			this.scrollToBottom();
		});

		this.unsubscribe = sandboxStore.subscribe(async (state) => {
			if (this.disposed) return;

			if (state.backend === 'bun') {
				if (!this.process) {
					this.process = {
						kill() {},
						exit: Promise.resolve(0),
						input: { getWriter: () => ({ write() {}, releaseLock() {} }) },
						output: new ReadableStream<string>()
					};
				}
				return;
			}

			if (!state.container || state.booting || !state.previewUrl) {
				if (this.process) {
					try {
						this.process.kill();
					} catch {
						// ignore
					}
					this.process = undefined;
					this.writer = undefined;
					this.attachedContainer = null;
					this.spawning = false;
					this.teardownPreviewMessageListener();
				}
				return;
			}

			if (this.process || this.spawning || !this.xterm || state.container === this.attachedContainer) {
				return;
			}

			this.spawning = true;
			const container = state.container;
			try {
				const spawned = (await container.spawn('jsh', [], {
					terminal: {
						cols: this.xterm.cols,
						rows: this.xterm.rows
					}
				})) as ShellProcess;

				if (state.container !== container || !this.xterm || this.disposed) {
					try {
						spawned.kill();
					} catch {
						// ignore
					}
					return;
				}

				this.process = spawned;
				this.attachedContainer = container;
				void spawned.exit.catch(() => {});
				this.syncPreviewMessageListener();
				this.writer = spawned.input.getWriter();

				void spawned.output
					.pipeTo(
						new WritableStream({
							write: (data) => {
								this.xterm?.write(data);
								this.scrollToBottom();
							}
						})
					)
					.catch((pipeError: unknown) => {
						if (!this.isAbortedError(pipeError)) {
							console.warn(`Terminal output stream closed (${this.sessionId}):`, pipeError);
						}
					});
			} catch (spawnError) {
				if (!this.isAbortedError(spawnError)) {
					console.error(`Failed to spawn jsh process (${this.sessionId}):`, spawnError);
					this.xterm?.write('\r\nFailed to start shell.\r\n');
				}
			} finally {
				this.spawning = false;
			}
		});

		if (sandboxStore.getBackend() === 'bun') this.connectBunTerminal();

		this.themeListener = () => {
			if (this.xterm) requestAnimationFrame(() => this.applyTerminalTheme());
		};
		document.addEventListener(THEME_CHANGE_EVENT, this.themeListener);

		if (this.containerEl) {
			this.mountElement(this.containerEl);
		}
	}

	private mountElement(container: HTMLElement) {
		if (!this.xterm || this.disposed) return;

		const element = this.xterm.element;
		if (!element) {
			this.xterm.open(container);
		} else if (element.parentElement !== container) {
			container.appendChild(element);
		}

		this.containerEl = container;
		this.setupResizeObserver(container);
		this.applyTerminalTheme();
		this.scheduleFitWithFollowups();
	}

	private setupResizeObserver(container: HTMLElement) {
		this.teardownResizeObserver();
		this.resizeObserver = new ResizeObserver(() => {
			this.scheduleFit();
		});
		this.resizeObserver.observe(container);

		let parent: HTMLElement | null = container.parentElement;
		while (parent) {
			this.resizeObserver.observe(parent);
			if (parent.classList.contains('editor-dock') || parent.classList.contains('nested-dock')) {
				break;
			}
			parent = parent.parentElement;
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', this.onWindowResize);
		}
	}

	private onWindowResize = () => {
		this.scheduleFit();
	};

	private teardownResizeObserver() {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', this.onWindowResize);
		}
		if (!this.resizeObserver) return;
		try {
			this.resizeObserver.disconnect();
		} catch {
			// ignore
		}
		this.resizeObserver = null;
	}

	private syncPreviewMessageListener() {
		if (!this.attachPreviewMessages || !this.attachedContainer || !this.xterm) {
			this.teardownPreviewMessageListener();
			return;
		}

		if (this.previewMessageHandler) return;

		const container = this.attachedContainer as {
			on: (event: string, handler: PreviewMessageHandler) => void;
			off?: (event: string, handler: PreviewMessageHandler) => void;
		};

		this.previewMessageHandler = (msg) => {
			const text = msg.message || (msg.args ? msg.args.join(' ') : JSON.stringify(msg));
			this.xterm?.writeln(`\x1b[90m[preview]\x1b[0m ${text}`);
		};

		container.on('preview-message', this.previewMessageHandler);
	}

	private teardownPreviewMessageListener() {
		if (!this.previewMessageHandler || !this.attachedContainer) {
			this.previewMessageHandler = null;
			return;
		}

		const container = this.attachedContainer as {
			off?: (event: string, handler: PreviewMessageHandler) => void;
		};
		container.off?.('preview-message', this.previewMessageHandler);
		this.previewMessageHandler = null;
	}

	private applyTerminalTheme() {
		if (!this.xterm) return;
		this.xterm.options.theme = { ...this.xterm.options.theme, ...xtermThemeFromDocument() };
		this.xterm.options.fontFamily = TERMINAL_FONT_FAMILY;
		this.xterm.options.fontSize = settings.typography.terminalFontSize;
	}

	private isAbortedError(error: unknown) {
		return error instanceof Error && /aborted|Process aborted/i.test(error.message);
	}

	private isTerminalReadyForFit(): boolean {
		if (!this.xterm || !this.containerEl) return false;
		if (
			!this.containerEl.isConnected ||
			this.containerEl.clientWidth <= 0 ||
			this.containerEl.clientHeight <= 0
		) {
			return false;
		}
		if (!this.xterm.element?.isConnected || !this.xterm.element.parentElement) return false;

		const dims = this.xterm._core?._renderService?.dimensions;
		if (!dims?.css?.cell?.width || !dims?.css?.cell?.height) return false;

		return true;
	}

	/**
	 * xterm 5.6 dropped `core.viewport`; addon-fit 0.10 still reads `scrollBarWidth` there
	 * and throws, leaving the default 80×24 grid (short height, horizontal overflow).
	 */
	private proposeDimensions(): { cols: number; rows: number } | null {
		if (!this.xterm || !this.containerEl) return null;
		const cell = this.xterm._core?._renderService?.dimensions?.css?.cell;
		if (!cell?.width || !cell?.height) return null;

		const style = getComputedStyle(this.containerEl);
		const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
		const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
		const availableWidth = this.containerEl.clientWidth - padX;
		const availableHeight = this.containerEl.clientHeight - padY;
		if (availableWidth < cell.width || availableHeight < cell.height) return null;

		const scrollable = this.xterm.element?.querySelector('.xterm-scrollable-element') as
			| HTMLElement
			| null;
		let scrollbar = 0;
		if (scrollable) {
			scrollbar = Math.max(0, scrollable.offsetWidth - scrollable.clientWidth);
		}
		if ((this.xterm.options.scrollback ?? 0) > 0) {
			scrollbar = Math.max(scrollbar, 10);
		}

		return {
			cols: Math.max(2, Math.floor((availableWidth - scrollbar) / cell.width)),
			rows: Math.max(1, Math.floor(availableHeight / cell.height))
		};
	}

	private isTerminalAtBottom() {
		if (!this.xterm) return true;
		const buffer = this.xterm.buffer.active;
		return buffer.viewportY + this.xterm.rows >= buffer.length;
	}

	private syncUserScrollState() {
		this.userScrolledUp = !this.isTerminalAtBottom();
	}

	private scrollToBottom(force = false) {
		if (!this.xterm) return;
		if (!force && this.userScrolledUp) return;
		this.xterm.scrollToBottom();
		this.userScrolledUp = false;
	}

	private safeFit(retries = 8) {
		if (!this.isTerminalReadyForFit()) {
			if (retries > 0) {
				this.fitRafId = requestAnimationFrame(() => this.safeFit(retries - 1));
			}
			return;
		}

		try {
			const next = this.proposeDimensions();
			if (!next || !this.xterm) {
				if (retries > 0) {
					this.fitRafId = requestAnimationFrame(() => this.safeFit(retries - 1));
				}
				return;
			}

			if (this.xterm.cols !== next.cols || this.xterm.rows !== next.rows) {
				this.xterm._core?._renderService?.clear?.();
				this.xterm.resize(next.cols, next.rows);
			}
			this.scrollToBottom(true);
			this.sendBunResize();
			this.resizeShell();
		} catch (error) {
			if (retries > 0) {
				this.fitRafId = requestAnimationFrame(() => this.safeFit(retries - 1));
			} else {
				console.warn('Terminal fit failed:', error);
			}
		}
	}

	private resizeShell() {
		if (!this.xterm || !this.process) return;
		try {
			this.process.resize?.({ cols: this.xterm.cols, rows: this.xterm.rows });
		} catch {
			// ignore resize failures on backends without PTY resize support
		}
	}

	private sendBunInput(data: string) {
		if (this.bunSocket && this.bunSocket.readyState === WebSocket.OPEN) {
			this.bunSocket.send(JSON.stringify({ type: 'input', data }));
		} else if (this.bunInputQueue.length < 1000) {
			this.bunInputQueue.push(data);
		}
	}

	private sendBunResize() {
		if (this.bunSocket && this.bunSocket.readyState === WebSocket.OPEN && this.xterm) {
			this.bunSocket.send(JSON.stringify({ type: 'resize', cols: this.xterm.cols, rows: this.xterm.rows }));
		}
	}

	private connectBunTerminal() {
		if (this.bunSocket || this.bunConnecting || !this.xterm) return;
		const serverSessionId = sandboxStore.getTerminalSessionId();
		if (!serverSessionId) {
			if (this.bunConnectAttempts < 30) {
				this.bunConnectAttempts++;
				setTimeout(() => {
					if (!this.bunSocket && !this.bunConnecting && !this.disposed) this.connectBunTerminal();
				}, 1000);
			}
			return;
		}
		this.bunConnectAttempts = 0;

		this.bunConnecting = true;
		const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const socket = new WebSocket(`${proto}//${location.host}/api/sandbox/${serverSessionId}/terminal`);
		socket.binaryType = 'arraybuffer';
		const decoder = new TextDecoder();

		socket.onopen = () => {
			this.bunSocket = socket;
			this.bunConnecting = false;
			this.sendBunResize();
			for (const chunk of this.bunInputQueue) this.sendBunInput(chunk);
			this.bunInputQueue = [];
		};

		socket.onmessage = (event) => {
			if (!this.xterm) return;
			if (typeof event.data === 'string') {
				try {
					const msg = JSON.parse(event.data) as { type?: string; message?: string };
					if (msg.type === 'exit') {
						this.xterm.writeln('\r\n\x1b[90mShell exited.\x1b[0m');
					} else if (msg.type === 'error') {
						this.xterm.writeln(`\r\n\x1b[31m${msg.message ?? 'Terminal error'}\x1b[0m`);
					}
				} catch {
					// ignore malformed control frames
				}
				return;
			}
			const bytes = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : event.data;
			this.xterm.write(decoder.decode(bytes, { stream: true }));
			this.scrollToBottom();
		};

		socket.onclose = () => {
			this.bunSocket = null;
			this.bunConnecting = false;
			this.process = undefined;
			this.xterm?.writeln('\r\n\x1b[90mServer terminal closed.\x1b[0m');
		};

		socket.onerror = () => {
			this.bunConnecting = false;
		};
	}
}

const sessions = new Map<string, TerminalSession>();

export function getTerminalSession(sessionId: string): TerminalSession {
	let session = sessions.get(sessionId);
	if (!session) {
		session = new TerminalSession(sessionId);
		sessions.set(sessionId, session);
	}
	return session;
}

export function disposeTerminalSession(sessionId: string) {
	sessions.get(sessionId)?.dispose();
	sessions.delete(sessionId);
}

export function refitAllTerminalSessions() {
	for (const session of sessions.values()) {
		session.scheduleFitWithFollowups();
	}
}
