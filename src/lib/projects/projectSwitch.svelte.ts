export type SwitchPhase = 'hidden' | 'saving' | 'restoring' | 'installing';

const SWITCH_PHASE_PROGRESS: Record<Exclude<SwitchPhase, 'hidden'>, number> = {
	saving: 12,
	restoring: 28,
	installing: 8
};

const BOOT_PHASE_PROGRESS: Record<string, number> = {
	starting: 5,
	'Booting WebContainer…': 15,
	'Restoring cached project…': 38,
	'Mounting project files…': 42,
	'Installing dependencies…': 58,
	'Saving project snapshot…': 86,
	'Starting dev server…': 94,
	Ready: 100
};

export const projectSwitch = $state({
	phase: 'hidden' as SwitchPhase,
	message: '',
	detailPhase: '',
	progress: 0
});

function bumpProgress(next: number) {
	projectSwitch.progress = Math.max(projectSwitch.progress, Math.min(next, 100));
}

export function showProjectSwitch(phase: Exclude<SwitchPhase, 'hidden'>, message: string) {
	projectSwitch.phase = phase;
	projectSwitch.message = message;
	projectSwitch.detailPhase = '';
	bumpProgress(SWITCH_PHASE_PROGRESS[phase]);
}

export function setProjectSwitchDetail(detailPhase: string) {
	projectSwitch.detailPhase = detailPhase;
	const mapped = BOOT_PHASE_PROGRESS[detailPhase];
	if (mapped !== undefined) bumpProgress(mapped);
}

export function hideProjectSwitch() {
	projectSwitch.phase = 'hidden';
	projectSwitch.message = '';
	projectSwitch.detailPhase = '';
	projectSwitch.progress = 0;
}
