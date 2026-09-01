import 'horizon-layout';

declare module 'horizon-layout' {
	interface TabGroupConfig {
		/** When true, external tab opens (explorer, drops) are routed elsewhere. */
		locked?: boolean;
	}
}
