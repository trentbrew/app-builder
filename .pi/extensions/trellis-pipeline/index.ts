// @ts-nocheck
/**
 * trellis-pipeline (pi port)
 * -------------------------------------------------------------------------
 * Single-tab Trellis pipeline auto-advance for the pi harness — the pi
 * equivalent of the `.cursor` stop-hook pipeline.
 *
 * Reuses the engine-agnostic Node logic shipped with the Cursor install:
 *   - ~/.trellis/pipeline-core/pipeline-run.mjs   (runPipelineStop)
 *   - ~/.cursor/hooks/trellis-profile-lib.mjs     (session bindings)
 *   - ~/.cursor/hooks/trellis-agent-verify-lib.mjs(UI smoke gate)
 *
 * Mapping vs Cursor:
 *   Cursor `stop` hook            -> pi.on("agent_settled")
 *   returns { followup_message }  -> pi.sendUserMessage(msg)  (idle => triggers turn)
 *   UI-touch tracker hook         -> pi.on("tool_call")  (edit/write paths)
 *   /tp /tr-pipeline commands     -> pi.registerCommand(...)
 *   session binding JSON          -> same store, keyed by pi session id
 *
 * Toggle: /tp on|off  ·  /tr-pipeline on|off  ·  /trellis-pipeline on|off
 */

import { homedir } from "node:os";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HOME = homedir();
const CORE = join(HOME, ".trellis", "pipeline-core", "pipeline-run.mjs");
const PROFILE_LIB = join(HOME, ".cursor", "hooks", "trellis-profile-lib.mjs");
const VERIFY_LIB = join(HOME, ".cursor", "hooks", "trellis-agent-verify-lib.mjs");
const SKILLS_DIR = join(HOME, ".cursor", "skills");

// Loop guard: cap auto-advances per session so a mis-parse can't spin forever.
const MAX_HOPS = 24;
const hops = new Map<string, number>();

// Markers that identify an auto-injected followup (do NOT reset the hop counter
// and do NOT re-count these as fresh human turns).
const AUTO_MARKERS = [
	"## Trellis pipeline —",
	"## Agent UI smoke —",
	"## Verification gate",
	"## Design verification gate",
];

function isAutoInjected(text: string): boolean {
	const t = (text ?? "").trimStart();
	return AUTO_MARKERS.some((m) => t.startsWith(m));
}

async function loadDeps() {
	if (!existsSync(CORE) || !existsSync(PROFILE_LIB)) return null;
	const core = await import(CORE);
	const profile = await import(PROFILE_LIB);
	const verify = existsSync(VERIFY_LIB) ? await import(VERIFY_LIB) : null;
	return { core, profile, verify };
}

/** Pull the last assistant message's text out of the current branch. */
function lastAssistantText(ctx: any): string {
	let entries: any[] = [];
	try {
		entries = ctx.sessionManager.getBranch() ?? [];
	} catch {
		return "";
	}
	for (let i = entries.length - 1; i >= 0; i--) {
		const e = entries[i];
		const msg = e?.type === "message" ? e.message : undefined;
		if (!msg || msg.role !== "assistant") continue;
		const content = msg.content;
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			return content
				.filter((p: any) => p && p.type === "text" && typeof p.text === "string")
				.map((p: any) => p.text)
				.join("\n");
		}
		return "";
	}
	return "";
}

/** Append absolute skill paths so the pi agent can actually read them. */
function decorateWithSkillPaths(message: string): string {
	const extra: string[] = [];
	const skillMatch = message.match(/Load skill `([^`]+)`/);
	if (skillMatch) {
		const p = join(SKILLS_DIR, skillMatch[1], "SKILL.md");
		if (existsSync(p)) extra.push(`- Role skill: read \`${p}\``);
	}
	if (message.includes("trellis-handoffs")) {
		const p = join(SKILLS_DIR, "trellis-handoffs", "SKILL.md");
		if (existsSync(p)) extra.push(`- Handoff contract: read \`${p}\``);
	}
	if (!extra.length) return message;
	return `${message}\n\n**Skill files (pi):**\n${extra.join("\n")}`;
}

export default function (pi: ExtensionAPI) {
	// --------------------------------------------------------------------- //
	// Toggle commands
	// --------------------------------------------------------------------- //
	const toggle = async (args: string, ctx: any, defaultOn: boolean) => {
		const deps = await loadDeps();
		if (!deps) {
			ctx.ui.notify("trellis-pipeline: engine libs not found (~/.trellis, ~/.cursor)", "error");
			return;
		}
		const sid = ctx.sessionManager.getSessionId?.() ?? "";
		if (!sid) {
			ctx.ui.notify("trellis-pipeline: no session id", "error");
			return;
		}
		const word = args.trim().toLowerCase();
		const on = word === "on" || (word === "" && defaultOn);
		const off = word === "off";
		const prior = deps.profile.loadSessionBinding(sid) ?? {};
		const profile = prior.profile ?? "strategist";
		deps.profile.saveSessionBinding(sid, profile, {
			pipeline_auto: on && !off,
			pipeline_paused: false,
		});
		hops.set(sid, 0);
		ctx.ui.notify(
			`Trellis pipeline ${on && !off ? "ON" : "OFF"} — role: ${profile}. ` +
				`End each pass with turn banner + YAML footer; HANDOFF/REJECT auto-advance.`,
			"info",
		);
	};

	for (const name of ["tp", "tr-pipeline", "trellis-pipeline", "trellis-role"]) {
		pi.registerCommand(name, {
			description: "Toggle single-tab Trellis pipeline auto-advance (on|off)",
			handler: (args, ctx) => toggle(args, ctx, true),
		});
	}

	// --------------------------------------------------------------------- //
	// UI-touch tracking — set ui_touch when edit/write hits a UI glob
	// --------------------------------------------------------------------- //
	pi.on("tool_call", async (event: any, ctx: any) => {
		if (event.toolName !== "edit" && event.toolName !== "write") return;
		const path = event.input?.path;
		if (typeof path !== "string" || !path.trim()) return;

		const deps = await loadDeps();
		if (!deps?.verify) return;
		const sid = ctx.sessionManager.getSessionId?.() ?? "";
		if (!sid) return;

		const workspace = ctx.cwd;
		const manifest = deps.verify.loadVerifyManifest(workspace);
		if (!manifest) return;
		if (!deps.verify.isUiTouchPath(workspace, path, manifest)) return;

		const binding = deps.profile.loadSessionBinding(sid) ?? {};
		const av = binding.agent_verify ?? {};
		const touched = new Set<string>(av.touched ?? []);
		touched.add(path.startsWith(workspace) ? relative(workspace, path) : path);
		deps.profile.saveSessionBinding(sid, binding.profile ?? "strategist", {
			agent_verify: { ...av, ui_touch: true, touched: [...touched] },
		});
	});

	// --------------------------------------------------------------------- //
	// Auto-advance + UI smoke gate on settle
	// --------------------------------------------------------------------- //
	pi.on("agent_settled", async (_event: any, ctx: any) => {
		if (!ctx.isIdle?.()) return; // another run already queued

		const deps = await loadDeps();
		if (!deps) return;
		const sid = ctx.sessionManager.getSessionId?.() ?? "";
		if (!sid) return;

		const binding = deps.profile.loadSessionBinding(sid);
		if (!binding?.pipeline_auto) return; // pipeline mode off

		const workspace = ctx.cwd;

		// (a) UI smoke gate — block completion when UI files failed smoke.
		if (deps.verify) {
			const manifest = deps.verify.loadVerifyManifest(workspace);
			const av = binding.agent_verify ?? {};
			if (manifest && deps.verify.shouldRunSmokeOnStop(av, manifest)) {
				ctx.ui.notify("Trellis: UI files touched — running smoke…", "info");
				const result = deps.verify.runAgentSmoke(manifest, { touched: av.touched ?? [] });
				const exit = result.exit_code ?? 1;
				if (exit !== 0) {
					deps.profile.saveSessionBinding(sid, binding.profile ?? "strategist", {
						agent_verify: { ...av, ui_touch: true, last_smoke_exit: exit },
					});
					pi.sendUserMessage(deps.verify.buildSmokeFollowup(exit, result, manifest));
					return; // do not advance until smoke passes
				}
				deps.profile.saveSessionBinding(sid, binding.profile ?? "strategist", {
					agent_verify: { ...av, ui_touch: false, last_smoke_exit: 0 },
				});
			}
		}

		// (b) Pipeline advance.
		const assistantText = lastAssistantText(ctx);
		if (isAutoInjected(assistantText)) return; // guard: don't re-parse our own echoes

		const result = deps.core.runPipelineStop({
			session_id: sid,
			status: "completed",
			assistant_text: assistantText,
		});

		if (!result || result.type === "noop") return;

		if (result.type === "paused") {
			ctx.ui.notify(
				`Trellis pipeline paused — your turn${result.issue ? ` (${result.issue})` : ""}. See summary above.`,
				"warning",
			);
			return;
		}

		if (result.type === "followup") {
			const n = (hops.get(sid) ?? 0) + 1;
			hops.set(sid, n);
			if (n > MAX_HOPS) {
				ctx.ui.notify(
					`Trellis pipeline: hit ${MAX_HOPS}-hop guard — auto-advance paused. /tp on to resume.`,
					"warning",
				);
				return;
			}
			pi.sendUserMessage(decorateWithSkillPaths(result.message));
		}
	});

	// Reset the hop guard whenever a real human prompt starts a turn.
	pi.on("before_agent_start", async (event: any, ctx: any) => {
		const sid = ctx.sessionManager.getSessionId?.() ?? "";
		if (!sid) return;
		if (!isAutoInjected(event.prompt ?? "")) hops.set(sid, 0);
	});
}
