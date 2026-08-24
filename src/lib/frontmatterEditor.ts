function yamlVal(v: unknown): string {
	if (typeof v === 'boolean' || typeof v === 'number') return String(v);
	if (typeof v === 'string') {
		const needs = v === '' || v.trim() !== v || /[:#\[\]{},|>&*!'"\\%@`]/.test(v);
		return needs ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v;
	}
	return String(v);
}

export function serializeFrontmatter(meta: Record<string, unknown>): string {
	const lines: string[] = ['---'];
	for (const [k, v] of Object.entries(meta)) {
		if (v === null || v === undefined) continue;
		if (Array.isArray(v)) {
			lines.push(`${k}:`);
			for (const item of v) lines.push(`  - ${yamlVal(item)}`);
		} else if (typeof v === 'object') {
			lines.push(`${k}:`);
			for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
				lines.push(`  ${yamlVal(k2)}: ${yamlVal(v2)}`);
			}
		} else {
			lines.push(`${k}: ${yamlVal(v)}`);
		}
	}
	lines.push('---', '');
	return lines.join('\n');
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	...children: (Node | string | HTMLElement)[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) element.setAttribute(k, v);
	for (const child of children) {
		if (typeof child === 'string') element.appendChild(document.createTextNode(child));
		else element.appendChild(child as HTMLElement);
	}
	return element;
}

function renderToggle(value: boolean, onChange: (v: boolean) => void): HTMLElement {
	const wrap = el('label', { class: 'fm-toggle', title: value ? 'true' : 'false' });
	const input = el('input', { type: 'checkbox', class: 'fm-toggle-input' }) as HTMLInputElement;
	input.checked = value;
	input.addEventListener('change', () => onChange(input.checked));
	const track = el('span', { class: 'fm-toggle-track' });
	track.appendChild(el('span', { class: 'fm-toggle-thumb' }));
	wrap.appendChild(input);
	wrap.appendChild(track);
	return wrap;
}

function renderText(value: string, onChange: (v: string) => void, className = 'fm-text-input'): HTMLElement {
	const input = el('input', {
		type: 'text',
		class: className,
		value,
		spellcheck: 'false'
	}) as HTMLInputElement;
	input.addEventListener('change', () => onChange(input.value));
	return input;
}

function renderNumber(value: number, onChange: (v: number) => void): HTMLElement {
	const input = el('input', {
		type: 'number',
		class: 'fm-number-input',
		value: String(value)
	}) as HTMLInputElement;
	input.addEventListener('change', () => {
		const n = parseFloat(input.value);
		if (!Number.isNaN(n)) onChange(n);
	});
	return input;
}

function renderField(key: string, control: HTMLElement): HTMLElement {
	const field = el('div', { class: 'fm-field' });
	field.appendChild(el('span', { class: 'fm-field-key' }, key));
	const val = el('div', { class: 'fm-field-val' });
	val.appendChild(control);
	field.appendChild(val);
	return field;
}

export function buildFrontmatterControls(
	meta: Record<string, unknown>,
	onChange: (newMeta: Record<string, unknown>) => void
): HTMLElement {
	const current = { ...meta };

	function emit() {
		onChange({ ...current });
	}

	const body = el('div', { 'data-slot': 'fm-body' });

	const title = typeof current.title === 'string' ? current.title : undefined;
	const desc = typeof current.description === 'string' ? current.description : undefined;

	if (title !== undefined || desc !== undefined) {
		const header = el('div', { 'data-slot': 'fm-header' });
		if (title !== undefined) {
			const h = el('div', { 'data-slot': 'fm-title' });
			h.appendChild(
				renderText(title, (val) => {
					current.title = val;
					emit();
				}, 'fm-title-input')
			);
			header.appendChild(h);
		}
		if (desc !== undefined) {
			const d = el('div', { 'data-slot': 'fm-desc' });
			d.appendChild(
				renderText(desc, (val) => {
					current.description = val;
					emit();
				}, 'fm-desc-input')
			);
			header.appendChild(d);
		}
		body.appendChild(header);
	}

	const grid = el('div', { 'data-slot': 'fm-grid' });
	const reserved = new Set(['title', 'description']);

	for (const [k, v] of Object.entries(current)) {
		if (reserved.has(k)) continue;
		if (typeof v === 'string') {
			grid.appendChild(renderField(k, renderText(v, (val) => {
				current[k] = val;
				emit();
			})));
		} else if (typeof v === 'number') {
			grid.appendChild(renderField(k, renderNumber(v, (val) => {
				current[k] = val;
				emit();
			})));
		} else if (typeof v === 'boolean') {
			grid.appendChild(renderField(k, renderToggle(v, (val) => {
				current[k] = val;
				emit();
			})));
		}
	}

	const addWrap = el('div', { class: 'fm-add-field' });
	const keyInput = el('input', {
		type: 'text',
		class: 'fm-text-input',
		placeholder: 'property',
		spellcheck: 'false'
	}) as HTMLInputElement;
	const valueInput = el('input', {
		type: 'text',
		class: 'fm-text-input',
		placeholder: 'value',
		spellcheck: 'false'
	}) as HTMLInputElement;
	const addBtn = el('button', { type: 'button', class: 'fm-add-btn' }, 'Add');
	addBtn.addEventListener('click', () => {
		const key = keyInput.value.trim();
		const value = valueInput.value.trim();
		if (!key) return;
		current[key] = value;
		keyInput.value = '';
		valueInput.value = '';
		emit();
	});
	addWrap.appendChild(keyInput);
	addWrap.appendChild(valueInput);
	addWrap.appendChild(addBtn);
	grid.appendChild(addWrap);

	body.appendChild(grid);
	return body;
}

export function createEmptyFrontmatter(title = ''): Record<string, unknown> {
	return title ? { title } : { title: '' };
}
