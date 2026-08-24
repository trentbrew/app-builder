export function delimiterForPath(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return ext === 'tsv' || ext === 'tab' ? '\t' : ',';
}

export function parseDelimited(text: string, delimiter = ','): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i]!;

		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			quoted = true;
			continue;
		}
		if (char === delimiter) {
			row.push(field);
			field = '';
			continue;
		}
		if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}
		if (char === '\r') continue;
		field += char;
	}

	if (quoted || field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	if (rows.length === 0) return [['']];

	const width = rows.reduce((max, current) => Math.max(max, current.length), 1);
	return rows.map((current) => {
		const next = current.slice();
		while (next.length < width) next.push('');
		return next;
	});
}

export function serializeDelimited(rows: string[][], delimiter = ','): string {
	return rows
		.map((row) => row.map((cell) => escapeField(cell ?? '', delimiter)).join(delimiter))
		.join('\n');
}

function escapeField(value: string, delimiter: string): string {
	if (value.includes('"') || value.includes('\n') || value.includes('\r') || value.includes(delimiter)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}
