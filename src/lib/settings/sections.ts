export type SettingSectionId = 'theme' | 'editor' | 'typography'

export type SettingFieldId =
	| 'color-scheme'
	| 'theme-preset'
	| 'import-tweakcn'
	| 'chrome-height'
	| 'active-tab-highlight'
	| 'pane-style'
	| 'layout-preset'
	| 'pane-gap'
	| 'active-tab-accent'
	| 'stretch-single-tabs'
	| 'keep-empty-panes'
	| 'markdown-properties'
	| 'auto-save-sandbox'
	| 'editor-font-size'
	| 'terminal-font-size'
	| 'explorer-font-size'

export type SettingSection = {
	id: SettingSectionId
	label: string
	description: string
}

export type SettingFieldMeta = {
	id: SettingFieldId
	sectionId: SettingSectionId
	label: string
	description?: string
	keywords?: string[]
}

export const SETTINGS_SECTIONS: SettingSection[] = [
	{
		id: 'theme',
		label: 'Theme',
		description: 'Color scheme, presets, and tweakcn imports.',
	},
	{
		id: 'editor',
		label: 'Editor chrome',
		description: 'Tab bars, pane layout, and active-tab styling.',
	},
	{
		id: 'typography',
		label: 'Typography',
		description: 'Font sizes for editor, terminal, and explorer.',
	},
]

export const SETTINGS_FIELDS: SettingFieldMeta[] = [
	{
		id: 'color-scheme',
		sectionId: 'theme',
		label: 'Color scheme',
		description: 'Dark is the default look; system follows your OS.',
		keywords: ['dark', 'light', 'system'],
	},
	{
		id: 'theme-preset',
		sectionId: 'theme',
		label: 'Theme preset',
		description: 'Built-in palettes compatible with tweakcn exports.',
		keywords: ['darkmatter', 'supabase', 'catppuccin', 'graphite', 'studio', 'palette'],
	},
	{
		id: 'import-tweakcn',
		sectionId: 'theme',
		label: 'Import tweakcn theme',
		description: 'Paste a registry JSON export from the clipboard.',
		keywords: ['tweakcn', 'import', 'clipboard', 'json'],
	},
	{
		id: 'chrome-height',
		sectionId: 'editor',
		label: 'Chrome row height',
		description: 'Shared height for tab bars and pane detail rows.',
		keywords: ['toolbar', 'tab bar', 'height'],
	},
	{
		id: 'active-tab-highlight',
		sectionId: 'editor',
		label: 'Active tab highlight',
		description: 'How the selected tab is emphasized in each pane.',
		keywords: ['accent', 'tint', 'underline', 'tab'],
	},
	{
		id: 'pane-style',
		sectionId: 'editor',
		label: 'Rounded pane cards',
		description: 'Separate panes with small gaps and rounded corners instead of edge-to-edge splits.',
		keywords: ['cards', 'flush', 'rounded', 'layout'],
	},
	{
		id: 'layout-preset',
		sectionId: 'editor',
		label: 'Layout preset',
		description: 'Default dock arrangement for new projects. Apply to rearrange the current workspace.',
		keywords: ['layout', 'preset', 'agent', 'classic', 'dock', 'panes'],
	},
	{
		id: 'pane-gap',
		sectionId: 'editor',
		label: 'Pane gap',
		description: 'Space between card panes, icon rail, header, and status bar.',
		keywords: ['margin', 'gutter', 'spacing'],
	},
	{
		id: 'active-tab-accent',
		sectionId: 'editor',
		label: 'Active tab accent color',
		description: 'Color used for the top accent and background tint.',
		keywords: ['primary', 'color', 'tab'],
	},
	{
		id: 'stretch-single-tabs',
		sectionId: 'editor',
		label: 'Stretch single tabs',
		description: 'When a pane has only one tab, expand it to fill the tab bar width.',
		keywords: ['tab', 'width'],
	},
	{
		id: 'keep-empty-panes',
		sectionId: 'editor',
		label: 'Keep empty panes',
		description: 'When the last tab in a pane is closed, keep the pane with a blank state instead of removing it.',
		keywords: ['blank', 'empty', 'pane'],
	},
	{
		id: 'markdown-properties',
		sectionId: 'editor',
		label: 'Markdown properties',
		description: 'Where YAML frontmatter fields appear when editing markdown in rich mode.',
		keywords: ['frontmatter', 'yaml', 'sidebar', 'markdown'],
	},
	{
		id: 'auto-save-sandbox',
		sectionId: 'editor',
		label: 'Auto-save to sandbox',
		description: 'Push code edits to the WebContainer filesystem as you type. Cmd+S always saves manually.',
		keywords: ['autosave', 'sandbox', 'sync', 'persist', 'save'],
	},
	{
		id: 'editor-font-size',
		sectionId: 'typography',
		label: 'Editor font size',
		description: 'Code editor and settings JSON view.',
		keywords: ['code', 'monaco', 'codemirror'],
	},
	{
		id: 'terminal-font-size',
		sectionId: 'typography',
		label: 'Terminal font size',
		description: 'Integrated terminal, server logs, and preview JS console.',
		keywords: ['xterm', 'console', 'logs'],
	},
	{
		id: 'explorer-font-size',
		sectionId: 'typography',
		label: 'Explorer font size',
		description: 'File tree rows and section labels in the sidebar explorer.',
		keywords: ['files', 'tree', 'sidebar'],
	},
]

const fieldById = new Map(SETTINGS_FIELDS.map((field) => [field.id, field]))

function fieldHaystack(field: SettingFieldMeta): string {
	return [field.label, field.description ?? '', ...(field.keywords ?? [])].join(' ').toLowerCase()
}

export function fieldMatchesSearch(fieldId: SettingFieldId, query: string): boolean {
	const field = fieldById.get(fieldId)
	if (!field) return false
	const q = query.trim().toLowerCase()
	if (!q) return true
	return fieldHaystack(field).includes(q)
}

export function sectionHasVisibleFields(sectionId: SettingSectionId, query: string): boolean {
	return SETTINGS_FIELDS.some(
		(field) => field.sectionId === sectionId && fieldMatchesSearch(field.id, query),
	)
}

export function fieldIsVisible(
	fieldId: SettingFieldId,
	activeSection: SettingSectionId | null,
	query: string,
): boolean {
	if (query.trim()) return fieldMatchesSearch(fieldId, query)
	if (activeSection) return fieldById.get(fieldId)?.sectionId === activeSection
	return true
}

export function visibleSections(query: string): SettingSection[] {
	const q = query.trim()
	if (!q) return SETTINGS_SECTIONS
	return SETTINGS_SECTIONS.filter((section) => sectionHasVisibleFields(section.id, q))
}
