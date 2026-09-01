/** Position a fixed suggestion menu above the caret rect (composer popups). */
export function positionSuggestionAbove(el: HTMLDivElement, rect: DOMRect, gap = 8) {
	el.style.position = 'fixed';
	el.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
	el.style.bottom = `${window.innerHeight - rect.top + gap}px`;
	el.style.top = '';

	requestAnimationFrame(() => {
		const height = el.offsetHeight || 280;
		const topEdge = rect.top - gap - height;
		if (topEdge < 8) {
			el.style.bottom = '';
			el.style.top = `${rect.bottom + gap}px`;
		}
	});
}
