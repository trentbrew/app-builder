export type PromptTextOptions = {
	title: string
	description?: string
	defaultValue?: string
	confirmLabel?: string
	inputLabel?: string
	placeholder?: string
}

class PromptDialogController {
	open = $state(false)
	title = $state('Save as')
	description = $state('')
	confirmLabel = $state('Save')
	inputLabel = $state('Name')
	placeholder = $state('')
	value = $state('')

	#resolve: ((value: string | null) => void) | null = null

	ask(options: PromptTextOptions): Promise<string | null> {
		this.#resolve?.(null)
		this.title = options.title
		this.description = options.description ?? ''
		this.confirmLabel = options.confirmLabel ?? 'Save'
		this.inputLabel = options.inputLabel ?? 'Name'
		this.placeholder = options.placeholder ?? ''
		this.value = options.defaultValue ?? ''
		this.open = true
		return new Promise((resolve) => {
			this.#resolve = resolve
		})
	}

	submit() {
		if (!this.open) return
		const next = this.value.trim()
		this.open = false
		const resolve = this.#resolve
		this.#resolve = null
		resolve?.(next.length ? next : null)
	}

	cancel() {
		if (!this.open && !this.#resolve) return
		this.open = false
		const resolve = this.#resolve
		this.#resolve = null
		resolve?.(null)
	}
}

export const promptDialog = new PromptDialogController()

export function promptText(options: PromptTextOptions): Promise<string | null> {
	return promptDialog.ask(options)
}
