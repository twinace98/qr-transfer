# LLM Bootstrap Playbook

**This file is read by the assistant when a user says "init project" / "start a new project with this template" / "bootstrap this skeleton."** It is a playbook, not documentation — follow it step-by-step, in order. Do not skip ahead.

The goal of bootstrap is to go from "user's one-paragraph project idea" to "Phase 1 plan pair approved and ready to execute" without burning the user's time on guesswork.

---

## Step 0 — Confirm you have the minimum viable info

Before writing **any** file, confirm the following are known. If any item is unknown or ambiguous, **stop and ask** (one batched question per gap — do not proceed with placeholders).

### Required (blockers — must be answered)

1. **Deliverable** — What single, concrete artifact does "done" look like? (A paper figure? A deployed service? A dataset? A trained model with a specific metric threshold?)
2. **Validation anchor** — What external reference decides whether the deliverable is correct? (Experiment to compare against? Benchmark dataset? Analytic limit? Prior paper?)
3. **Phase count + rough phase boundaries** — Can the work be split into 2–6 phases where each phase has a distinct output the next phase consumes? If the user has not thought in phases, propose a split and ask for approval before writing `Plan.md`.
4. **Hard constraints** — Compute/API budget? Deadline? Collaborators blocked on specific outputs? These shape phase ordering.

### Strongly recommended (ask if not volunteered)

5. **Known gotchas** — Is there a tool/library/method combo the user already knows is broken, or a prior-project lesson that should become a `CLAUDE.md` domain rule?
6. **Infrastructure specifics** — HPC allocation name, API credentials location, dataset paths. These become `{DOMAIN}.md` at repo root.
7. **Reference material** — Does the user have a handful of papers/docs that should go into `references/` on day one? Designing Phase 1 without them usually means redoing it.

### May be deferred

- Exact parameter values for later phases (fill in phase-kickoff for each phase, not now).
- `reports/{topic}/` names (decide at first decision gate).
- Meeting cadence.

**Rule of thumb**: if answering "what is the deliverable of Phase 1, in one sentence?" requires guessing, you do not have enough info yet. Ask.

---

## Step 1 — Write `README.md` and `STATUS.md`

These are the cheapest files to write and force you to articulate what you know.

1. **`README.md`**:
   - Fill frontmatter (title, people, date).
   - One-paragraph idea: restate the deliverable and validation anchor from Step 0 in user-facing language.
   - Phase list in prose: one sentence per phase (names only — detailed sub-steps go in `Plan.md`).
2. **`STATUS.md`**:
   - `Phase`: "not started — awaiting Phase 1 kickoff approval."
   - `Target` / `Methods` / `Infrastructure` / `People`: fill from Step 0.
   - `How to resume next session` block: **keep accurate even on day zero**. This is the contract for the next session.
   - `Pending`: copy the phase list from `README.md` as unchecked boxes.
   - Leave `Completed`, `Decisions locked in`, `Data Layout` empty with a stub line.

**Stop here if**: the `README.md` "Idea" paragraph reads as hand-wavy to you. Go back to Step 0.

---

## Step 2 — Write `Plan.md`

This is the highest-leverage file. A bad `Plan.md` wastes every phase downstream.

1. **Phase table**: one row per phase. The "Top-line goal" column must be specific enough that success is checkable without reading the phase's sub-steps.
2. **Per-phase sub-step table**: aim for 4–8 sub-steps per phase. Each row's "Sub-goal" is a success criterion, not a description.
3. **Decision gates** — the part people skip. For each gate:
   - When it fires (e.g., "After 2.2").
   - Pass criterion as a **number or boolean**, not prose ("gap within 0.15 eV of experimental 1.6 eV" — not "gap looks reasonable").
   - What to do on failure (e.g., "revisit pseudopotentials before scaling to Phases 3–4").
   - Minimum: 1 gate per phase that consumes expensive resources (GW, training, large-scale deployment).
4. **Verification strategy** — one bullet per phase. Same logic: numeric/boolean, not prose.
5. **Repository layout** section: list the `data/{nnn}-{case}/` directories you intend to create. Stable numbering is load-bearing — do not revise.

**Stop here if**: a decision gate's pass criterion cannot be expressed as a number, boolean, or explicit comparison. Ask the user for the threshold.

---

## Step 3 — Write `CLAUDE.md` domain rules

Open the template `CLAUDE.md`. The structural sections (Workflow, Plans, Working, Reports, …) are already filled. Only the **Domain-specific rules** section at the bottom needs your attention.

Move any Step 0 item #5 (known gotchas) into this section. Format:

```
## Domain-specific rules

- **{{rule name}}**: {{one-sentence statement of the rule}}.
  Reason: {{why — prior incident or strong preference}}.
  Enforcement: {{is it checked by a script? by review? by convention?}}
```

If you have no gotchas yet, **delete the Domain-specific rules section**. Empty sections rot.

---

## Step 4 — Phase 1 plan pair

Rename the template files:
```
plans/phase1_NAME.md       → plans/phase1_{slug}.md
plans/phase1_NAME_impl.md  → plans/phase1_{slug}_impl.md
```
where `{slug}` is the Phase 1 name (lowercase-hyphenated).

1. **`phase1_{slug}.md`** (phase plan — the thin one):
   - Goal: restate Phase 1 top-line goal from `Plan.md` with more context.
   - Scope: explicitly list what is **out** of scope for this phase (things that belong to later phases). This prevents scope creep.
   - Sub-step table: **must match `Plan.md` numbering exactly** (1.1, 1.2, …).
   - Approval points: name the 1–2 intra-phase gates (usually a critical sub-step like "parameter lock-in" or "structure choice").
   - Exit criterion: copy from `Plan.md` verification strategy, make checkable.
2. **`phase1_{slug}_impl.md`** (implementation spec — the detailed one):
   - One `##` section per sub-step.
   - For each: **Candidates / sweep** (parameter ranges or options), **Pass criterion** (how to pick the winner — numeric or boolean), **Data location** (`data/{nnn}-{case}/`), **Output log** (path to `working/` file), **Locked-in value** (leave blank — filled after execution).

**Stop here if**: any sub-step's pass criterion is vague ("looks reasonable", "works well"). Rewrite as a numeric/boolean check before continuing.

---

## Step 5 — Dry-run the plan

Before requesting phase kickoff approval, **walk the Phase 1 plan yourself** and answer each check:

- Can every sub-step produce its output log without external info you don't have?
- Does every sub-step's output directly feed the next sub-step's input?
- Does Phase 1's final output directly feed Phase 2's first sub-step? (If not, you have a missing or misordered sub-step.)
- Is there any sub-step that, if it fails, would invalidate a *later phase's* approved plan? (If yes, promote its failure check to a decision gate in `Plan.md`.)

Fix issues in place. Do not proceed with known gaps.

---

## Step 6 — Request Phase 1 kickoff approval

Present to the user, in one message:
- Links to `plans/phase1_{slug}.md` and `plans/phase1_{slug}_impl.md`.
- The Phase 1 sub-step list (condensed).
- Explicit question: "Approve Phase 1 kickoff? Anything to adjust before I begin sub-step 1.1?"

**Do not start sub-step 1.1 until the user explicitly approves.** Phase kickoff is one of the three hard approval points — not a soft default.

---

## Step 7 — After approval, hand off to the execution loop

Sub-step execution is governed by `CLAUDE.md` "Autonomous loop boundary" section (sub-step limit, stop triggers, decision gate protocol). Bootstrap is done.

Update `STATUS.md` `Phase` and `Next action` lines to point at sub-step 1.1. Commit. Begin.

---

## Anti-patterns — do not do these

- **Inventing parameter values** for `_impl.md` when the user has not specified them. Mark `{{to be determined in sub-step X}}` and come back.
- **Writing `working/` logs preemptively** at bootstrap time. They are *records*, not plans. They appear only after a sub-step runs.
- **Filling `Key Results` in `README.md`** before any results exist. Leave empty.
- **Skipping references/** to save bootstrap time. If the user mentioned a paper, stub the `references/{author}-{year}-{topic}.md` file now; reading and summarizing can come at the sub-step that needs it.
- **Merging all phases into one giant Phase 1** because phase boundaries are unclear. Better to ask the user for a clean split than to paper over it.
- **Treating bootstrap as done when template placeholders remain**. Grep for `{{` in all created files before declaring done — none should remain except intentionally deferred items clearly marked "(pending sub-step X)".
