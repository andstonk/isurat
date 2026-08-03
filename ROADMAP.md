# Video Subtitle Generator Roadmap

Last updated: 2026-07-29
Planning horizon: 16 weeks (Aug-Nov 2026)

## Scope and Assumptions

- Team size: 1 full-stack developer (+ part-time designer or QA support as needed)
- Current baseline: upload, transcription, translation, subtitle editor, style controls, karaoke highlight preview, export (SRT/VTT/TXT)
- Timeline includes development, QA, polish, and release buffer
- Estimates assume dependencies and API providers remain stable

## Timeline Summary

- Phase 0: Stabilization and foundations - 2 weeks
- Phase 1: Editing productivity and quality - 3 weeks
- Phase 2: Import/export expansion - 2 weeks
- Phase 3: Collaboration and project workflows - 3 weeks
- Phase 4: Rendering and delivery features - 3 weeks
- Phase 5: Growth, analytics, and hardening - 3 weeks

Total: 16 weeks

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

## Phase 2 (Weeks 6-7): Import and Export Expansion

Goals:
- Support existing subtitle assets and improve interoperability

Deliverables:
- [x] Import SRT and VTT into editor via one tolerant parser, with per-block error reporting for malformed cues (single subtitle track only, no bilingual import)
- [x] Karaoke fallback for imported files without word timing — already covered by `timedWordsForCue()`'s existing fallback; no new code needed, just a smoke-test after import ships
- [x] Export filename includes the subtitle mode/language so original/translated/bilingual downloads stop overwriting each other

Exit criteria:
- [x] Parser handles a real-world sample SRT and VTT (including a deliberately malformed block) without crashing, and reports which blocks it skipped
- [ ] Manual import -> export round-trip preserves cue count and text (no automated test suite exists, so this is a manual check, not a corpus metric)

## Phase 3 (Weeks 8-10): Collaboration and Workflow

Goals:
- Enable team use and safer project iteration

Deliverables:
- [ ] Project version history (manual snapshots)
- [ ] Restore previous subtitle versions
- [ ] Shareable read-only project links
- [ ] Optional role flags (owner/editor/viewer) for future extension

Exit criteria:
- [ ] Users can recover from mistakes without database intervention
- [ ] Shared view links work securely and expire when configured

## Phase 4 (Weeks 11-13): Rendering and Delivery

Goals:
- Expand from subtitle files to delivery-ready outputs

Deliverables:
- [ ] Burned-in subtitle MP4 export (server-side render pipeline)
- [ ] Preset style packs (cinematic, social short-form, accessibility)
- [ ] Position/alignment controls with safe-title guides
- [ ] Customizable text glow controls (enabled, color, blur radius, and intensity)
- [ ] Preview/render parity for project, cue, and word-level style overrides
- [ ] Optional speaker labels and accessibility markers

Exit criteria:
- [ ] Burn-in export works for target max file size and duration
- [ ] Presets are reusable across projects
- [ ] Glow and formatting effects match between editor preview and rendered video output

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

## Optional Faster Plan (Lean 8 Weeks)

If you want a tighter launch plan:

- Weeks 1-2: stabilization + telemetry
- Weeks 3-4: editor productivity features
- Weeks 5-6: SRT/VTT import
- Weeks 7-8: version history + basic share links

This plan skips burned-in export until after launch.
