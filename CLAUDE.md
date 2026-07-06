# Rules

## Key files
- `README.md` — project summary for humans. Keep it concise.
- `Plan.md` — master plan (phase-level). Revised only on major scope changes.
- `STATUS.md` — current project status for you. **Keep this up to date** whenever work progresses.
- `CLAUDE.md` — this file. Rules for you.
- `BOOTSTRAP.md` — LLM init playbook. Follow it when starting a new project from this template; otherwise ignore.
- `{{DOMAIN}}.md` — infrastructure / tooling reference (e.g., `HPC.md`, `API.md`). Consult before preparing any job/request.

## Workflow

Phase-based, with approval only at review milestones (not every sub-step).

**Document pipeline per phase**:

1. **`plans/phase{N}_{name}.md`** — phase plan (thin): goal, scope, expected sub-steps, links.
2. **`plans/phase{N}_{name}_impl.md`** — implementation spec (detailed): concrete parameters, commands, file paths under `data/`.
3. **`data/{nnn}-{case-name}/`** — actual work (inputs + outputs + job/run scripts).
4. **`working/phase{N}_step{M}_{name}.md`** — per-sub-step completion log (what ran, what converged, test results). Autonomous — no approval needed.
5. **`reports/{topic}/`** — *periodic* result summaries, accumulated over weeks. Updated at decision-gate points and phase completion.
6. **`plans/archives/`** — move phase plan pair here after phase completion.

### Approval points (sparse)

Sub-steps run autonomously. Request approval only at:
- **Phase kickoff** — after writing `plans/phase{N}_*.md` pair, before launching work.
- **Decision gates in `Plan.md`** — each gate is numbered and has a pass criterion.
- **Phase completion** — after writing the phase summary into `reports/{topic}/`, before archiving the plan pair.

### Autonomous loop boundary

"Sub-steps run autonomously" is **bounded**, not unlimited. Obey the following.

**Continuous run limit.**
- Run **at most 3 consecutive sub-steps** without a user check-in, even if all three pass.
- After 3, post a brief progress summary (what ran, results, next sub-step) and wait for a "continue" signal (explicit approval, or a clear instruction to keep going).
- The limit is 1 (not 3) for the *first* sub-step of any phase — pause after sub-step N.1 to confirm the per-phase parameter set is behaving before committing more compute.

**Mandatory stop triggers.** Stop and surface to the user immediately if any of these fire, even mid-sub-step:

1. **Convergence / validation failure** — a sub-step's pass criterion is not met, and no clearly-scoped retry is available. Do not silently lower the criterion.
2. **Decision gate reached** — a sub-step completes that a `Plan.md` decision gate is attached to. Never self-approve a gate. Use the request format below.
3. **Unexpected repository state** — unfamiliar files, branches, or uncommitted changes that were not there at the last checkpoint. Investigate; do not `rm` / `git reset` as a shortcut.
4. **Ambiguous input** — the next sub-step requires a parameter, path, or decision that was not specified in `_impl.md` and cannot be derived from prior outputs. Do not guess defaults.
5. **Cost/blast-radius jump** — about to submit a job, spend, or issue external actions (push, PR, shared-infra change) substantially larger than prior sub-steps in this phase. Confirm first.
6. **Reference gap** — about to design parameters for a sub-step whose relevant `references/` note is empty or missing. Ask whether to read the source PDF now.
7. **Plan drift** — you find yourself wanting to add a sub-step, reorder sub-steps, or change a decision gate criterion. Those are `Plan.md` edits and need user sign-off.

**Decision gate judgment request — required format.**

When a decision gate fires, post a single message with these fields, and **wait**:

```
## Decision gate {N} — {which gate from Plan.md}

**Pass criterion** (from `Plan.md`): {quote verbatim}

**Observed**: {number / boolean / explicit comparison — not prose}

**Judgment**: PASS | FAIL | AMBIGUOUS

**If PASS**: next action = {specific sub-step}. Request approval to proceed.
**If FAIL**: candidate responses = {option A with cost}, {option B with cost}. Ask which.
**If AMBIGUOUS**: {what additional check would disambiguate; estimated cost}. Ask whether to run it.
```

**Scope of a "continue" signal.** When the user says "continue" / "go ahead" (or the equivalent in any language), that approval covers **up to the next stop trigger**, not the entire phase. Re-ask at the next trigger.

**Ambiguity protocol** (expand on #4 above). When information is missing:
- **Ask** if the choice affects a decision gate, costs >~30 min compute, or is irreversible.
- **Assume with flag** if the choice is low-cost, reversible, and not gate-relevant: proceed with a documented assumption in the sub-step's `working/` log under a `## Assumptions` heading, and call it out in the next user-facing update.
- **Never silently assume** — at minimum write the assumption into the log.

## Data (`data/`)
- One directory per case: `{nnn}-{case-name}/` (e.g., `001-{{case}}/`).
- Scripts and input files go in the case directory.

## Plans (`plans/`)
- `plans/phase{N}_{name}.md` — phase plan: goal, sub-steps (numbered to match `Plan.md`), success criteria, link to impl.
- `plans/phase{N}_{name}_impl.md` — implementation spec: concrete parameter values, `data/` subdirectory plan, per-sub-step execution recipe. **Update in place** as convergence/results come in.
- `plans/archives/` — plans from completed phases.

## Working (`working/`)
- `working/phase{N}_step{M}_{name}.md` — per-sub-step completion log.
- Contents: what was run, which `data/` dir, results, issues, outputs produced.
- Technical — not for meeting/review. Written autonomously as sub-steps finish.

## Reports (`reports/`)
- One directory per topic: `reports/{report-name}/`.
- **Periodic result summaries**, not final deliverables — accumulate over weeks as a phase progresses.
- Main document: `reports/{report-name}/{report-name}.md`.
- Plot scripts, figures, supporting files go in the same directory. Image paths relative: `![caption](figure.png)`.
- Report sections: Key Finding, Method, Results, Discussion.
- Updated at each decision gate and at phase completion.

## References (`references/`)
- Literature notes as markdown summaries (`{first-author}-{year}-{topic}.md`) alongside the corresponding source PDFs.
- **Before launching or designing any non-trivial step** (parameter selection, method choice, interpretation), consult the relevant markdown summaries in `references/` first.
- Read the PDF only if the markdown summary is insufficient — markdown is the primary entry point.

## Meetings (`meetings/`)
- One file per meeting: `meetings/{YYYY-MM-DD}.md`.
- Contains both:
  - **Progress report** (written before meeting)
  - **After-meeting notes** (discussion, decisions, action items)

## Conventions
- Filenames: lowercase, hyphenated.
- Dates: YYYY-MM-DD.
- Sub-step numbering matches `Plan.md` exactly (1.1, 1.2, …) across `plans/`, `working/`, and referenced scripts.

## Domain-specific rules

- **Phase-1 faithfulness**: Phase 1 reproduces the original app *exactly* — same protocol,
  chunking, QR params, UI states. No performance changes belong here.
  Reason: the replica is the measurement baseline; drift makes Phase-3 gains meaningless.
  Enforcement: review against the transcribed grammar in `plans/phase1_replica_impl.md`.
- **SHA-256 exactness is a hard gate**: any transfer variant (baseline or improved) must
  reassemble to a file whose SHA-256 equals the source. A faster-but-corrupting variant is
  a failure, not a trade-off.
  Enforcement: the Phase-2 harness and Phase-1 §1.5 both assert hash equality.
- **Improvements are opt-in modes, never silent**: Phase-3 levers (binary payload,
  windowed/rateless transport, capacity tuning) live behind flags so the faithful replica
  path remains runnable and comparable.
  Enforcement: default config = replica behavior; benchmark reports name the active mode.
- **Vendored deps, no CDN**: `jsQR`/`QRious` are served from `app/vendor/`; do not
  reintroduce CDN `<script>` tags. Reason: offline/reproducible benchmarking.
- **Apples-to-apples benchmarking**: every throughput number comes from the *same*
  Phase-2 harness with a stated channel model and seed; never compare across harness
  versions without re-running the baseline.
