# Video Subtitle Generator Roadmap

Last updated: 2026-08-05
Planning horizon: 16 weeks (Aug-Nov 2026)

## Scope and Assumptions

- Team size: 1 full-stack developer (+ part-time designer or QA support as needed)
- Current baseline: upload, transcription, translation, subtitle editor, style controls, karaoke highlight preview, export (SRT/VTT/TXT)
- Timeline includes development, QA, polish, and release buffer
- Estimates assume dependencies and API providers remain stable

## Timeline Summary

- Phase 0: Stabilization and foundations - 2 weeks
- Phase 1: Editing productivity and quality - 3 weeks
- Phase 2: Import/export expansion - 2 weeks ✅
- Phase 3: Collaboration and project workflows - 3 weeks ✅
- Phase 4: Rendering and delivery features - 3 weeks
- Phase 5: Growth, analytics, and hardening - 3 weeks

Total: 16 weeks

Monetization (payment tiers) sits outside this sequence — it was built early on request and is now blocked on provider selection. See "Monetization: Payment Tiers" below.

## Phase 0 (Weeks 1-2): Stabilization and Foundations ✅ Done

Goals:
- Ensure the current subtitle workflow is production reliable
- Close technical debt from recent subtitle and karaoke changes

Deliverables:
- [x] Database migration validation checklist (local, staging, prod)
- [x] Build pipeline stability fixes (lint/build clean on CI)
- [x] Error telemetry for upload, transcription, and save flows
- [x] Better retry and recovery UX for failed jobs

Exit criteria:
- [x] No blocking lint/build issues
- [x] Core flow success rate >= 95% in staging test runs
- [x] Clear runbook for failed processing jobs

## Phase 1 (Weeks 3-5): Editing Productivity and Quality ✅ Deliverables done

Goals:
- Make subtitle editing significantly faster for creators

Deliverables:
- [x] Undo/redo history in subtitle editor
- [x] Bulk timestamp shift (+/- ms or sec)
- [x] Cue split/merge tools
- [x] Search and replace across cues
- [x] Readability validator (CPS/WPM warnings and duration checks)
- [x] Cue-level style overrides so every subtitle line can use different fonts, colors, sizes, and formatting
- [x] Word-level emphasis controls for bold, italic, underline, and custom text color
- [x] Style inheritance model: word override -> cue override -> project default

Exit criteria:
- [ ] 30% fewer manual editing actions on common test projects
- [ ] No regression in subtitle save performance
- [x] Per-cue and per-word formatting persists after saving, reloading, and regrouping cues

## Phase 2 (Weeks 6-7): Import and Export Expansion ✅ Done

Goals:
- Support existing subtitle assets and improve interoperability

Deliverables:
- [x] Import SRT and VTT into editor via one tolerant parser, with per-block error reporting for malformed cues (single subtitle track only, no bilingual import)
- [x] Karaoke fallback for imported files without word timing — already covered by `timedWordsForCue()`'s existing fallback; no new code needed, just a smoke-test after import ships
- [x] Export filename includes the subtitle mode/language so original/translated/bilingual downloads stop overwriting each other

Exit criteria:
- [x] Parser handles a real-world sample SRT and VTT (including a deliberately malformed block) without crashing, and reports which blocks it skipped
- [x] Manual import -> export round-trip preserves cue count and text — verified 2026-08-04 against `parseSubtitleFile`/`toSrt`/`toVtt` with a messy sample (BOM, CRLF, multi-line cues, `<i>`/`<v>` markup, cue identifiers, out-of-order blocks, malformed timestamp, reversed timestamps, empty text). Cue count, text, and timings survive SRT and VTT round-trips and a second lap, so the transform is stable rather than lossless once. No automated test suite exists; this was a one-off check, not a regression guard.

Known import limitations (by design, not defects — record them so they aren't refiled as bugs):
- A multi-line cue in a source file collapses to one line on import (`line one\nline two` becomes `line one line two`). Line breaks inside a cue are not preserved; everything after the first round-trip is stable because the text is already single-line.
- **A speaker label survives a VTT round-trip but not an SRT one.** VTT exports it as `<v Maria>`, which the parser reads back into `cue.speaker`. SRT and TXT write a textual `Maria:` prefix, and the parser deliberately does not guess at those — `Note: bring it tomorrow` is indistinguishable from a speaker prefix, so guessing would corrupt more files than it would label. Re-importing an SRT leaves the prefix as part of the cue text.
- **Bilingual exports cannot be re-imported losslessly.** A bilingual SRT/VTT puts original and translation on two lines of one cue, so re-importing merges them into a single `text` field (`"Hello there. Kumusta."`) with `translated_text` empty. Import is single-track by design; re-import bilingual files only if you intend that merge.

## Phase 3 (Weeks 8-10): Collaboration and Workflow ✅ Deliverables done

Goals:
- Enable team use and safer project iteration

Deliverables:
- [x] Project version history (manual snapshots) — `project_versions` stores the full cue array plus the project's style columns, so a snapshot is self-contained. Capped at the 20 most recent per project; taking one saves pending editor changes first so a snapshot can never capture stale state.
- [x] Restore previous subtitle versions — restoring auto-snapshots the current state as "Before restoring …" first, which is what makes a wrong restore recoverable in-app rather than a database problem.
- [x] Shareable read-only project links — `/share/<token>` renders the video, styled captions, and cue list with no session required and no editing affordances. Tokens are 256-bit and stored only as a SHA-256 hash, so the database never holds a replayable URL.
- [x] Optional role flags (owner/editor/viewer) — `project_members` table plus `resolveProjectAccess()`; every collaboration route already resolves a caller's role through it. No invite flow yet, by design: this is the plumbing a later phase builds on.

Exit criteria:
- [x] Users can recover from mistakes without database intervention — snapshot, restore, and delete are all in the editor's History panel, and restore is itself undoable
- [x] Shared view links work securely and expire when configured — 7-day/30-day/no-expiry choices, owner-only revocation, expiry and revocation both re-checked per request; `/share/` is disallowed in `robots.ts` and the page sends `noindex`

Verification status: lint and build pass, and the pure helpers (`shareLinkState`, `isRestorableCue`, `restorableColumns`, token hashing) were checked against 23 cases including revoked-beats-expired, zero-length cues, and column-allowlist escapes. The database-backed paths (snapshot, restore, share resolution) have **not** been run against a live Supabase — that needs migration `009` applied and a manual pass. See "Phase 3 manual check" in `RUNBOOK.md`.

## Phase 4 (Weeks 11-13): Rendering and Delivery

Goals:
- Expand from subtitle files to delivery-ready outputs

Deliverables:
- [ ] Burned-in subtitle MP4 export (server-side render pipeline)
- [ ] Preset style packs (cinematic, social short-form, accessibility)
- [ ] Position/alignment controls with safe-title guides
- [ ] Customizable text glow controls (enabled, color, blur radius, and intensity)
- [ ] Preview/render parity for project, cue, and word-level style overrides
- [x] Optional speaker labels and accessibility markers — rendering only; detecting *who* is speaking is its own workstream, see "Speaker Diarization" below. Migration `011` adds `subtitle_cues.speaker` plus five project render settings. Labels are off by default and typed by hand; markers (`[door slams]`, `(laughter)`, `♪ … ♪`) are **on** by default and need no data at all — they are recognized inside the cue's own text at render time, so an SRT imported from another tool gets marker styling immediately. Both render in the editor preview and the share view; SRT/TXT exports prefix the label in the chosen format and VTT emits a standard `<v Maria>` voice tag. Turning labels off leaves every export byte-identical to what it was before this landed. Known false positive: an ordinary parenthetical aside in dialogue ("I went to the store (I think)") is tinted as if it were a sound effect, because `(laughs)` and `(I think)` are not distinguishable by pattern. Brackets and `♪` have no such ambiguity. The per-project toggle is the escape hatch; narrowing the pattern to brackets only would lose real markers in files imported from tools that use parentheses.

Exit criteria:
- [ ] Burn-in export works for target max file size and duration
- [ ] Presets are reusable across projects
- [ ] Glow and formatting effects match between editor preview and rendered video output
- [x] Speaker labels and markers render identically in the editor preview and the read-only share view — both call the same `CaptionOverlay`. Burn-in parity is not claimed and cannot be until the render pipeline exists

Verification status (speaker labels / markers): lint and build pass, and the pure logic was checked against 43 cases — marker detection (brackets, parentheses, paired and lone `♪`, unclosed brackets, repeated tokens), per-word marker flags on both the stored-timing and fallback paths, label formatting, export shape for all three formats and all three modes, VTT voice-tag round-trip through the importer, speaker preservation through `resegmentCues`, settings normalization against missing and garbage columns, and the editor's marker-insert transform (which must keep `words` concatenating to `text` or karaoke silently loses its real timings). Nothing here has run against a live Supabase: that needs migration `011` applied and the "Phase 4 manual check" pass in `RUNBOOK.md`.

## Phase 5 (Weeks 14-16): Growth, Analytics, and Hardening

Goals:
- Prepare for scale and product iteration

Deliverables:
- [ ] Usage analytics dashboard (jobs, export formats, edit activity)
- [ ] Queue-based processing option for long-running jobs
- [ ] Cost and latency monitoring for Soniox/Azure/Supabase
- [ ] Security and compliance checklist (secrets, access policies, rate limits)

Exit criteria:
- [ ] End-to-end performance baseline documented
- [ ] Cost per processed minute tracked and visible
- [ ] Security review issues triaged or resolved

## Speaker Diarization (Unscheduled)

Goal: when two or more people speak, tell them apart — label each subtitle with who said it, and let the creator rename those speakers to real names.

This is listed separately rather than folded into a phase because it cuts across the whole pipeline: transcription, data model, editor, and export.

**Mostly done as of 2026-08-05.** Soniox turned out to support diarization behind a request flag at no extra cost (see "Settled questions" below), so this landed immediately after Phase 4's rendering half rather than remaining unscheduled. Storage, detection, cue splitting, display, editing, and export all work end to end. What remains is per-word attribution, project-wide speaker rename, and per-speaker style overrides.

**Not yet verified against real audio.** The token→cue logic is checked against 16 constructed cases, but no two-person video has been transcribed through the live Soniox API with the flag on. Until that happens, treat "diarization works" as *implemented*, not *proven* — see the Phase 4 manual check in `RUNBOOK.md`.

Deliverables:
- [x] Request speaker tags from Soniox and carry the per-token speaker through `tokensToSubtitleCues` / `tokensToBilingualCues` (`src/lib/soniox.ts`) — the request now sets `enable_speaker_diarization: true`, tokens carry a `speaker` field, and each cue is labelled from its own first token
- [x] Persist a speaker per cue — `subtitle_cues.speaker` (migration `011`). Per-word attribution is still open, but `subtitle_cues.words` is jsonb and already carries per-word style, so it needs no new column either
- [x] Break cues at speaker changes so one cue never mixes two people, and keep that boundary through split/merge and "Apply word limit" — `resegmentCues` breaks a group when the speaker changes; split copies the speaker to both halves and merge keeps the first cue's
- [ ] Editor: show the speaker on each cue row *(done — a Speaker field per cue, shown when labels are on)*, rename a speaker project-wide ("Speaker 1" → "Maria") *(not started; only worth building once a model is generating the names)*, and reassign a cue the model tagged wrong *(done — the field is free text)*
- [x] Optional speaker prefix in SRT/VTT/TXT exports (`Maria: …`), off by default so existing exports don't change shape — SRT/TXT take a text prefix in one of three formats; VTT emits `<v Maria>`, which is also the only form the importer reads back
- [ ] Per-speaker style overrides — reuses the existing cue-level style cascade rather than adding a fourth level

Exit criteria:
- [ ] A two-person conversation is split into per-speaker cues without manual work
- [ ] A mis-tagged cue can be reassigned in the editor without touching the database
- [ ] Renaming a speaker updates every cue attributed to them

Settled questions (checked 2026-08-05 against Soniox's live docs, not from memory):
- **Does the configured model return speaker tags, and does it cost extra?** ~~Open~~ — **yes, and no.** `enable_speaker_diarization: true` is a request flag on the same `stt-async-v5` the app already uses; tokens come back with a `speaker` field holding a bare number as a string (`"1"`). Soniox bundles diarization, language identification, and smart formatting into the $0.10/hour async rate rather than billing them as add-ons, so it is on unconditionally rather than gated behind a setting. Up to 15 speakers per session, and async is the mode Soniox documents as most accurate for it. This is what collapsed the estimate from 1–1.5 weeks to a few days.
- Diarization is unreliable on overlapping speech and similar voices. Manual reassignment in the editor is a deliverable above, not a nice-to-have, because the model will get some cues wrong.
- Translated projects take a different token path (`tokensToBilingualCues`), so speaker attribution has to be threaded through both or explicitly scoped to original-only at first. **Resolved by threading both, with a deliberate asymmetry:** the original track re-splits cues on a speaker change, the bilingual track only labels them. Splitting the bilingual path would drop original tokens that have no translation accumulated yet — losing subtitle text to gain a label is the wrong trade.

Behaviour worth knowing:
- **Every cue Soniox attributes arrives pre-filled**, single-speaker recordings included. The model's guess is always written to `subtitle_cues.speaker` so correcting it is a rename rather than typing a name from scratch on every cue. A cue is left null only when Soniox returned no speaker for it.
- **Storing a label and showing one are separate.** `speaker_labels_enabled` switches itself on only for a transcript with two or more distinct speakers, so a two-person video shows its labels without the user hunting for a setting, while a one-person video is not made to burn "Speaker 1:" over every caption. The labels are there to edit either way, and the toggle is an ordinary setting.
- Labels arrive as `Speaker 1` / `Speaker 2`. The editor's speaker field is free text, so renaming one on a cue is a normal edit — but there is still no project-wide rename, which is the one piece of this workstream that has not been built.

## Monetization: Payment Tiers (Out of Phase Order, Currently Blocked)

Subscription billing was built ahead of schedule, on request, rather than as part of a numbered phase. The tier design below is settled; the payment **provider** is not, because of a country constraint found after the code was written (see "Provider decision" below). No billing code is on `main` today — it is parked in a `git stash` entry.

### Tier structure

| Tier | Price | Transcriptions / month | Entitlements |
| --- | --- | --- | --- |
| Free | $0 | 3 | Videos up to 25 MB, full editor (timing, split/merge, search & replace), translation, karaoke highlighting, per-word styling, SRT/VTT/TXT export |
| Pro | $19/mo | 50 | Everything in Free, plus custom font uploads (50 active fonts) and email support |
| Enterprise | Custom (sales-led) | Unlimited | Everything in Pro, plus priority processing queue, dedicated support contact and onboarding, invoicing and custom terms |

- Launch promo: `LAUNCH1` — Pro at $1/month for the first 12 months.
- Free and Pro are self-serve checkout; Enterprise is "contact us", no self-serve path.
- Quota is a **monthly transcription count**, enforced at upload and again at process time, and consumed only on success so failed jobs don't burn credits.
- Prices are USD. A merchant of record collects VAT/GST on the buyer side; it does not change PH income-tax obligations (consult a local accountant — not covered by this roadmap).

### Build status

- [x] Tier definitions as a single source of truth shared by pricing page, account page, and server quota check (`src/lib/plans.ts`)
- [x] Subscription state + monthly usage tracking, migration `008_add_subscriptions.sql`
- [x] Quota gates in the uploads and jobs/process routes
- [x] Pricing page, plan/usage display on the account page, self-service plan management
- [ ] **Blocked:** provider selection and payout onboarding
- [ ] Re-point the provider-specific layer once a provider is chosen
- [ ] Verify the full checkout -> webhook -> entitlement loop against real provider test keys (never run)

All of the above is parked in `git stash` entry *"Stripe subscription billing (parked: no PH Stripe support)"*, taken on `main` at `0daa8b8`. Restore with `git stash pop`, then `pnpm add stripe` (the dependency was uninstalled). Roughly 70% of it is provider-agnostic and survives a provider swap: `plans.ts`, `subscription.ts`, quota enforcement, and the pricing/account UI. Only `src/lib/stripe.ts`, the four `/api/billing/*` routes, and the three `stripe_*` columns in migration 008 are provider-specific.

### Provider decision (the actual blocker)

Owner is based in the Philippines and is not a registered business (no DTI/SEC + BIR), and prefers to keep it that way. That rules out the obvious options:

- **Stripe** — does not onboard PH-based businesses. US incorporation via Stripe Atlas is the only workaround; rejected as not worth it.
- **PayMongo / Xendit** — real subscription APIs and GCash/Maya/GrabPay support, but both require DTI/SEC + BIR registration before releasing funds.
- **Polar.sh — leading candidate.** Its docs list the Philippines as a payout country via Stripe Connect Express, which operates in PH even though standalone Stripe does not. ~5% + 50¢. **Single gate to verify first:** whether Connect Express accepts "individual" as a PH business type.
- **Dodo Payments (~4% + 40¢) / Creem (~3.9% + 40¢)** — cheaper and claim PH support, but neither documents seller eligibility or payout method concretely.

Next action is verification, not code: confirm a real account can be opened and paid out to as a PH individual before writing a line of provider integration.

Exit criteria:
- [ ] A provider is confirmed to accept a PH-based individual seller and pay out — verified by signing up, not by reading docs
- [ ] Free -> Pro upgrade completes end to end and grants the 50/month quota
- [ ] Quota denial is enforced server-side, not just hidden in the UI
- [ ] Downgrade/cancel returns the account to Free limits at period end

## Cross-Cutting Workstreams (Run Every Phase)

- QA: regression checklist for upload -> process -> edit -> export
- Documentation: README and environment setup updates
- Observability: logs, alerts, and error budgets
- UX: mobile/responsive editor quality improvements

## Subtitle Styling Architecture

Implement advanced styling as a three-level cascade:

1. Project defaults stored on the video record
2. Cue overrides stored as `subtitle_cues.style_override` JSON
3. Word overrides stored inside each item in `subtitle_cues.words` JSON

Word overrides take precedence over cue overrides, and cue overrides take precedence over project defaults. Validate all JSON style properties on the server and preserve overrides when cues are split, merged, or regrouped.

## Timeline Risk Buffer

- Reserve 10-15% of each phase for unknowns
- Highest risk items:
  - Burned-in video rendering infrastructure
  - Subtitle import edge cases from third-party tools
  - Long-running transcription job reliability

## Suggested Release Cadence

- Internal demo: every 2 weeks
- Staging release: weekly
- Production release: every 2 weeks after Phase 0

## Milestone View

- M1 (end Week 2): stable foundation and observability
- M2 (end Week 5): fast editing toolkit
- M3 (end Week 7): import/export interoperability
- M4 (end Week 10): collaboration-ready workflows
- M5 (end Week 13): delivery-ready video output
- M6 (end Week 16): scale and optimization baseline

## Estimated Effort by Feature Group

- Editor productivity suite: 2.5 to 3.5 weeks
- Cue-level style overrides: 3 to 5 days
- Word-level emphasis controls: 3 to 5 days
- Customizable glow effects: 2 to 3 days for preview; add 2 to 4 days for rendered-video parity
- Import parser and validation: 1.5 to 2 weeks
- Versioning and sharing: 2 to 3 weeks
- Burn-in rendering pipeline: 2.5 to 4 weeks
- Analytics and hardening: 2 to 3 weeks
- Payment tiers and billing: built (~1 week of work, parked); budget 3 to 5 days to re-point it at a new provider, plus provider onboarding/verification lead time
- Speaker labels and accessibility markers (rendering only): built, ~1 day
- Speaker diarization: now 3 to 5 days if Soniox returns speaker tags from a request flag, down from 1 to 1.5 weeks — storage, rendering, editing, and export all landed with Phase 4's rendering half, leaving detection and project-wide rename. Significantly more if it needs a second provider or model — estimate is not firm until that is verified

## Optional Faster Plan (Lean 8 Weeks)

If you want a tighter launch plan:

- Weeks 1-2: stabilization + telemetry
- Weeks 3-4: editor productivity features
- Weeks 5-6: SRT/VTT import
- Weeks 7-8: version history + basic share links

This plan skips burned-in export until after launch.
