export type HarnessEnvelope =
	| { v: 1; dir: 'guest→host'; type: 'emit'; payload: { name: string; data?: unknown } }
	| {
			v: 1;
			dir: 'guest→host';
			type: 'call';
			id: string;
			method: 'read' | 'write';
			args: { path: string; content?: string };
	  }
	| {
			v: 1;
			dir: 'host→guest';
			type: 'call-result';
			id: string;
			ok: boolean;
			result?: unknown;
			error?: string;
	  }
	| { v: 1; dir: 'host→guest'; type: 'context'; payload: Record<string, unknown> };

export type ToolLogKind = 'emit' | 'deny' | 'rollback' | 'hmr' | 'read' | 'info';

export interface ToolLogEntry {
	id: string;
	ts: number;
	kind: ToolLogKind;
	summary: string;
	path?: string;
	payload?: unknown;
}

export interface SnapshotRecord {
	id: string;
	ts: number;
	files: Record<string, string>;
}

export interface EditComponentResult {
	ok: boolean;
	snapshotId?: string;
	denied?: boolean;
	error?: string;
}
