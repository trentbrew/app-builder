import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'node_modules/horizon-layout/dist');

function patchFile(relativePath, marker, transform) {
	const target = join(dist, relativePath);
	if (!existsSync(target)) {
		console.warn(`[patch-horizon-layout] ${relativePath} not found, skipping`);
		return false;
	}

	let source = readFileSync(target, 'utf8');
	if (source.includes(marker)) return false;

	const next = transform(source);
	if (next === source) {
		console.warn(`[patch-horizon-layout] Unexpected ${relativePath} shape, skipping`);
		return false;
	}

	writeFileSync(target, next);
	return true;
}

const tabViewIdPatched = patchFile(
	'TabGroup.svelte',
	'data-view-id={tabId}',
	(source) => {
		const needle = `\t\t\t\t\t\ttabindex={-1}
\t\t\t\t\t\tdraggable={!disableDrag}`;

		const insert = `\t\t\t\t\t\tdata-view-id={tabId}
\t\t\t\t\t\ttabindex={-1}
\t\t\t\t\t\tdraggable={!disableDrag}`;

		if (!source.includes(needle)) return source;
		return source.replace(needle, insert);
	}
);

const tabBarPatched = patchFile(
	'TabGroup.svelte',
	'{baseClass}__tab-bar-drag',
	(source) => {
		const needle = `\t\t\t\t{/if}
\t\t\t</div>

\t\t\t<div class="{baseClass}__controls">`;

		const insert = `\t\t\t\t{/if}
\t\t\t\t{#if !disableDrag}
\t\t\t\t\t<div
\t\t\t\t\t\tclass="{baseClass}__tab-bar-drag"
\t\t\t\t\t\tdraggable="true"
\t\t\t\t\t\taria-hidden="true"
\t\t\t\t\t\tondragstart={(event) =>
\t\t\t\t\t\t\tstartTabDrag(event, config.tabs[config.activeTabIndex]!)}
\t\t\t\t\t></div>
\t\t\t\t{/if}
\t\t\t</div>

\t\t\t<div class="{baseClass}__controls">`;

		if (!source.includes(needle)) return source;
		return source.replace(needle, insert);
	}
);

const splitPatched = patchFile(
	'Split.svelte',
	'function equalizeAdjacentPanes',
	(source) => {
		const fnNeedle = `\tfunction handleKeyDown(event: KeyboardEvent, index: number) {`;
		const fnInsert = `\tfunction equalizeAdjacentPanes(index: number) {
\t\tif (disableResizeSplits) return;
\t\tconst { min, max } = posConstraints[index]!;
\t\tconst midpoint =
\t\t\t((config.splitPoints[index - 1] ?? 0) + (config.splitPoints[index + 1] ?? 1)) / 2;
\t\tconst clamped = Number(Math.min(Math.max(midpoint, min), max).toFixed(4));
\t\tif (clamped !== config.splitPoints[index]) config.splitPoints[index] = clamped;
\t}

\tfunction handleKeyDown(event: KeyboardEvent, index: number) {`;

		if (!source.includes(fnNeedle)) return source;
		source = source.replace(fnNeedle, fnInsert);

		const handleNeedle = `\t\t\t\t\tonpointerdown={(event) => startResize(event, i)}
\t\t\t\t\tonfocus={() => {`;
		const handleInsert = `\t\t\t\t\tonpointerdown={(event) => startResize(event, i)}
\t\t\t\t\tondblclick={() => equalizeAdjacentPanes(i)}
\t\t\t\t\tonfocus={() => {`;

		if (!source.includes(handleNeedle)) return source;
		return source.replace(handleNeedle, handleInsert);
	}
);

const paneEdgePatched = patchFile(
	'Split.svelte',
	'data-hl-pane-first',
	(source) => {
		const needle = `    <div
      class="{baseClass}-split__pane {baseClass}-split__pane--{config.direction}"
      style={\`flex: \${(splitPoint ?? 1) - (config.splitPoints[i - 1] ?? 0)} 1 0 !important;\`}
    >`;

		const insert = `    <div
      class="{baseClass}-split__pane {baseClass}-split__pane--{config.direction}"
      style={\`flex: \${(splitPoint ?? 1) - (config.splitPoints[i - 1] ?? 0)} 1 0 !important;\`}
      data-hl-pane-first={i === 0 ? '' : undefined}
      data-hl-pane-last={i === config.views.length - 1 ? '' : undefined}
    >`;

		if (!source.includes(needle)) return source;
		return source.replace(needle, insert);
	}
);

const tabGroupIdsPatched = patchFile(
	'TabGroup.svelte',
	'startTabGroupDrag',
	(source) => {
		source = source.replace(
			'onStartTabDrag: (event: DragEvent, tabGroup: TabGroupConfig, tabId: Id) => void;',
			'onStartTabDrag: (event: DragEvent, tabGroup: TabGroupConfig, tabIds: Id[]) => void;'
		);

		const fnNeedle = `function startTabDrag(event: DragEvent, tabId: Id) {
		if (!event.dataTransfer) return;
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'move';
		const currentTarget = event.currentTarget as HTMLElement;
		event.dataTransfer.setDragImage(
			currentTarget,
			currentTarget.offsetWidth / 2,
			currentTarget.offsetHeight / 2
		);
		onStartTabDrag(event, config, tabId);
	}`;

		const fnInsert = `function startTabDrag(event: DragEvent, tabIds: Id[]) {
		if (!event.dataTransfer) return;
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'move';
		const currentTarget = event.currentTarget as HTMLElement;
		event.dataTransfer.setDragImage(
			currentTarget,
			currentTarget.offsetWidth / 2,
			currentTarget.offsetHeight / 2
		);
		onStartTabDrag(event, config, tabIds);
	}`;

		if (!source.includes(fnNeedle)) return source;
		source = source.replace(fnNeedle, fnInsert);

		source = source.replace(
			'ondragstart={(event) => startTabDrag(event, tabId)}',
			'ondragstart={(event) => startTabDrag(event, [tabId])}'
		);

		const rowNeedle =
			'startTabDrag(event, config.tabs[config.activeTabIndex]!)';
		const rowInsert = 'startTabDrag(event, [...config.tabs])';

		if (!source.includes(rowNeedle)) return source;
		return source.replace(rowNeedle, rowInsert);
	}
);

const horizonTabIdsPatched = patchFile(
	'HorizonLayout.svelte',
	'tabIds: Id[]',
	(source) => {
		source = source.replace(
			`type DragData = {
		configBeforeDrag: LayoutConfig;
		tabId: Id;
		// The tab group and drop target currently being hovered over, or null.
		hover: { tabGroup: TabGroupConfig; target: DropTarget } | null;
	};`,
			`type DragData = {
		configBeforeDrag: LayoutConfig;
		tabIds: Id[];
		activeTabId: Id;
		// The tab group and drop target currently being hovered over, or null.
		hover: { tabGroup: TabGroupConfig; target: DropTarget } | null;
	};`
		);

		const startNeedle = `function onStartTabDrag(event: DragEvent, tabGroup: TabGroupConfig, tabId: Id) {
		if (dragData) return;

		const tabIndex = tabGroup.tabs.indexOf(tabId);
		if (tabIndex === -1) return;
		const activeTabIndex = tabGroup.activeTabIndex;

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			if (event.currentTarget instanceof HTMLElement) {
				event.dataTransfer.setDragImage(
					event.currentTarget,
					event.currentTarget.offsetWidth / 2,
					event.currentTarget.offsetHeight / 2
				);
			}
		}

		event.target!.addEventListener('dragend', onDrop, { once: true });
		window.addEventListener('dragend', onDrop, { once: true });
		window.addEventListener('drop', onDrop, { once: true });

		requestAnimationFrame(() => {
			dragData = {
				configBeforeDrag: cloneConfig(internalConfig!),
				tabId,
				hover: null
			};
			tabGroup.tabs.splice(tabIndex, 1);
			if (tabGroup.tabs.length > 0) {
				if (activeTabIndex === tabIndex) {
					tabGroup.activeTabIndex = Math.min(tabIndex, tabGroup.tabs.length - 1);
				} else if (activeTabIndex > tabIndex) {
					tabGroup.activeTabIndex = activeTabIndex - 1;
				} else {
					tabGroup.activeTabIndex = activeTabIndex;
				}
			}
			simplifyTabGroup(tabGroup, nodeParentMap, internalConfig!);
			if (dragData) dragData.hover = null;
		});
	}`;

		const startInsert = `function onStartTabDrag(event: DragEvent, tabGroup: TabGroupConfig, tabIds: Id[]) {
		if (dragData) return;
		if (tabIds.length === 0) return;

		const activeTabId = tabGroup.tabs[tabGroup.activeTabIndex];
		const removeIndices = tabIds
			.map((id) => tabGroup.tabs.indexOf(id))
			.filter((index) => index !== -1)
			.sort((a, b) => b - a);

		if (removeIndices.length === 0) return;

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			if (event.currentTarget instanceof HTMLElement) {
				event.dataTransfer.setDragImage(
					event.currentTarget,
					event.currentTarget.offsetWidth / 2,
					event.currentTarget.offsetHeight / 2
				);
			}
		}

		event.target!.addEventListener('dragend', onDrop, { once: true });
		window.addEventListener('dragend', onDrop, { once: true });
		window.addEventListener('drop', onDrop, { once: true });

		requestAnimationFrame(() => {
			dragData = {
				configBeforeDrag: cloneConfig(internalConfig!),
				tabIds: [...tabIds],
				activeTabId,
				hover: null
			};
			for (const index of removeIndices) {
				tabGroup.tabs.splice(index, 1);
			}
			simplifyTabGroup(tabGroup, nodeParentMap, internalConfig!);
			if (dragData) dragData.hover = null;
		});
	}`;

		if (!source.includes(startNeedle)) return source;
		source = source.replace(startNeedle, startInsert);

		const dropNeedle = `function onDrop() {
		if (!dragData) return;

		const { tabId, configBeforeDrag, hover } = dragData;
		dragData = null;

		if (hover) {
			const { tabGroup, target } = hover;

			if (target.tabIndex !== undefined) {
				let insertIndex = Math.min(Math.max(target.tabIndex, 0), tabGroup.tabs.length);
				tabGroup.tabs.splice(insertIndex, 0, tabId);
				tabGroup.activeTabIndex = insertIndex;
			} else {
				const { side } = target;
				const splitDirection = side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
				const isAfter = side === 'right' || side === 'bottom';

				const parent = nodeParentMap.get(tabGroup);
				if (parent) {
					if (parent.parent.direction === splitDirection) {
						const insertIndex = parent.index + (isAfter ? 1 : 0);
						parent.parent.views.splice(insertIndex, 0, {
							tabs: [tabId],
							activeTabIndex: 0
						});
						// Split the target pane in half
						parent.parent.splitPoints.splice(parent.index, 0, paneMidpoint(parent));
					} else {
						const newSplit: SplitConfig = {
							direction: splitDirection,
							views: isAfter
								? [tabGroup, { tabs: [tabId], activeTabIndex: 0 }]
								: [{ tabs: [tabId], activeTabIndex: 0 }, tabGroup],
							splitPoints: [0.5]
						};
						parent.parent.views[parent.index] = newSplit;
					}
				} else {
					internalConfig!.root = {
						direction: splitDirection,
						views: isAfter
							? [tabGroup, { tabs: [tabId], activeTabIndex: 0 }]
							: [{ tabs: [tabId], activeTabIndex: 0 }, tabGroup],
						splitPoints: [0.5]
					};
				}
			}
		} else {
			internalConfig = configBeforeDrag;
		}
	}`;

		const dropInsert = `function onDrop() {
		if (!dragData) return;

		const { tabIds, activeTabId, configBeforeDrag, hover } = dragData;
		dragData = null;

		if (hover) {
			const { tabGroup, target } = hover;
			const activeTabIndex = Math.max(0, tabIds.indexOf(activeTabId));

			if (target.tabIndex !== undefined) {
				let insertIndex = Math.min(Math.max(target.tabIndex, 0), tabGroup.tabs.length);
				tabGroup.tabs.splice(insertIndex, 0, ...tabIds);
				tabGroup.activeTabIndex = insertIndex + activeTabIndex;
			} else {
				const { side } = target;
				const splitDirection = side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
				const isAfter = side === 'right' || side === 'bottom';
				const movedTabGroup: TabGroupConfig = {
					tabs: tabIds as [Id, ...Id[]],
					activeTabIndex
				};

				const parent = nodeParentMap.get(tabGroup);
				if (parent) {
					if (parent.parent.direction === splitDirection) {
						const insertIndex = parent.index + (isAfter ? 1 : 0);
						parent.parent.views.splice(insertIndex, 0, movedTabGroup);
						// Split the target pane in half
						parent.parent.splitPoints.splice(parent.index, 0, paneMidpoint(parent));
					} else {
						const newSplit: SplitConfig = {
							direction: splitDirection,
							views: isAfter
								? [tabGroup, movedTabGroup]
								: [movedTabGroup, tabGroup],
							splitPoints: [0.5]
						};
						parent.parent.views[parent.index] = newSplit;
					}
				} else {
					internalConfig!.root = {
						direction: splitDirection,
						views: isAfter ? [tabGroup, movedTabGroup] : [movedTabGroup, tabGroup],
						splitPoints: [0.5]
					};
				}
			}
		} else {
			internalConfig = configBeforeDrag;
		}
	}`;

		if (!source.includes(dropNeedle)) return source;
		return source.replace(dropNeedle, dropInsert);
	}
);

const lockedDropGuardPatched = patchFile(
	'HorizonLayout.svelte',
	'tabGroup.locked',
	(source) => {
		const needle = `\t\tif (hover) {
\t\t\tconst { tabGroup, target } = hover;
\t\t\tconst activeTabIndex = Math.max(0, tabIds.indexOf(activeTabId));`;

		const insert = `\t\tif (hover) {
\t\t\tconst { tabGroup, target } = hover;
\t\t\tif (tabGroup.locked) {
\t\t\t\tinternalConfig = configBeforeDrag;
\t\t\t\treturn;
\t\t\t}
\t\t\tconst activeTabIndex = Math.max(0, tabIds.indexOf(activeTabId));`;

		if (!source.includes(needle)) return source;
		return source.replace(needle, insert);
	}
);

const tabLockedFieldPatched = patchFile(
	'utils.js',
	'tabGroup.locked',
	(source) => {
		const cloneNeedle = `    const cloneTabGroupConfig = (tabGroup) => {
        return {
            tabs: [...tabGroup.tabs],
            activeTabIndex: tabGroup.activeTabIndex
        };
    };`;

		const cloneInsert = `    const cloneTabGroupConfig = (tabGroup) => {
        return {
            tabs: [...tabGroup.tabs],
            activeTabIndex: tabGroup.activeTabIndex,
            ...(typeof tabGroup.locked === 'boolean' ? { locked: tabGroup.locked } : {})
        };
    };`;

		if (!source.includes(cloneNeedle)) return source;
		source = source.replace(cloneNeedle, cloneInsert);

		const parseNeedle = `    const { tabs, activeTabIndex } = object;
    if (!Array.isArray(tabs) || tabs.length < 1)
        throw new Error(\`\${path}.tabs: expected a non-empty array\`);
    if (typeof activeTabIndex !== 'number')
        throw new Error(\`\${path}.activeTabIndex: expected a number\`);
    return {
        tabs: tabs.map((t, i) => parseId(t, \`\${path}.tabs[\${i}]\`)),
        activeTabIndex
    };`;

		const parseInsert = `    const { tabs, activeTabIndex, locked } = object;
    if (!Array.isArray(tabs) || tabs.length < 1)
        throw new Error(\`\${path}.tabs: expected a non-empty array\`);
    if (typeof activeTabIndex !== 'number')
        throw new Error(\`\${path}.activeTabIndex: expected a number\`);
    return {
        tabs: tabs.map((t, i) => parseId(t, \`\${path}.tabs[\${i}]\`)),
        activeTabIndex,
        ...(typeof locked === 'boolean' ? { locked } : {})
    };`;

		if (!source.includes(parseNeedle)) return source;
		return source.replace(parseNeedle, parseInsert);
	}
);

const tabLockedBoolPatched = patchFile(
	'utils.js',
	'typeof locked === \'boolean\'',
	(source) => {
		const next = source
			.replace(
				'...(locked === true ? { locked: true } : {})',
				'...(typeof locked === \'boolean\' ? { locked } : {})'
			)
			.replace(
				'...(tabGroup.locked ? { locked: true } : {})',
				'...(typeof tabGroup.locked === \'boolean\' ? { locked: tabGroup.locked } : {})'
			);
		return next;
	}
);

const tabControlsGuardPatched = patchFile(
	'TabGroup.svelte',
	'activeTabId = config.tabs[config.activeTabIndex]',
	(source) => {
		const needle = `\t\t\t<div class="{baseClass}__controls">
\t\t\t\t{#each controls as control (control)}
\t\t\t\t\t<div class="{baseClass}__control">
\t\t\t\t\t\t{@render control(config.tabs[config.activeTabIndex]!)}
\t\t\t\t\t</div>
\t\t\t\t{/each}
\t\t\t</div>`;

		const insert = `\t\t\t<div class="{baseClass}__controls">
\t\t\t\t{#each controls as control (control)}
\t\t\t\t\t<div class="{baseClass}__control">
\t\t\t\t\t\t{#if config.tabs[config.activeTabIndex]}
\t\t\t\t\t\t\t{@render control(config.tabs[config.activeTabIndex]!)}
\t\t\t\t\t\t{/if}
\t\t\t\t\t</div>
\t\t\t\t{/each}
\t\t\t</div>`;

		if (!source.includes(needle)) return source;
		return source.replace(needle, insert);
	}
);

if (tabLockedBoolPatched) console.log('[patch-horizon-layout] Applied tab group locked boolean patch');
if (lockedDropGuardPatched) console.log('[patch-horizon-layout] Applied locked group drop guard');
if (tabLockedFieldPatched) console.log('[patch-horizon-layout] Applied tab group locked field patch');
if (tabControlsGuardPatched) console.log('[patch-horizon-layout] Applied tab controls active-tab guard');
if (tabGroupIdsPatched) console.log('[patch-horizon-layout] Applied tab-group drag ids patch');
if (horizonTabIdsPatched) console.log('[patch-horizon-layout] Applied horizon tabIds drag patch');
if (tabBarPatched) console.log('[patch-horizon-layout] Applied tab-bar drag patch');
if (splitPatched) console.log('[patch-horizon-layout] Applied resizer double-click patch');
if (paneEdgePatched) console.log('[patch-horizon-layout] Applied pane edge markers');
