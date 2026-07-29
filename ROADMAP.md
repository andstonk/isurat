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

## Phase 0 (Weeks 1-2): Stabilization and Foundations

Goals:
- Ensure the current subtitle workflow is production reliable
- Close technical debt from recent subtitle and karaoke changes

Deliverables:
- Database migration validation checklist (local, staging, prod)
- Build pipeline stability fixes (lint/build clean on CI)
- Error telemetry for upload, transcription, and save flows
- Better retry and recovery UX for failed jobs

Exit criteria:
- No blocking lint/build issues
- Core flow success rate >= 95% in staging test runs
- Clear runbook for failed processing jobs

## Phase 1 (Weeks 3-5): Editing Productivity and Quality

Goals:
- Make subtitle editing significantly faster for creators

Deliverables:
- Undo/redo history in subtitle editor
- Bulk timestamp shift (+/- ms or sec)
- Cue split/merge tools
- Search and replace across cues
- Readability validator (CPS/WPM warnings and duration checks)

Exit criteria:
- 30% fewer manual editing actions on common test projects
- No regression in subtitle save performance

## Phase 2 (Weeks 6-7): Import and Export Expansion

Goals:
- Support existing subtitle assets and improve interoperability

Deliverables:
- Import SRT and VTT into editor
- Robust parser with validation and error reporting
- Maintain karaoke fallback behavior for imported files without word timing
- Export naming and metadata consistency improvements

Exit criteria:
- Import success >= 98% on validation corpus
- Round-trip test passes (import -> edit -> export)

## Phase 3 (Weeks 8-10): Collaboration and Workflow

Goals:
- Enable team use and safer project iteration

Deliverables:
- Project version history (manual snapshots)
- Restore previous subtitle versions
- Shareable read-only project links
- Optional role flags (owner/editor/viewer) for future extension

Exit criteria:
- Users can recover from mistakes without database intervention
- Shared view links work securely and expire when configured

## Phase 4 (Weeks 11-13): Rendering and Delivery

Goals:
- Expand from subtitle files to delivery-ready outputs

Deliverables:
- Burned-in subtitle MP4 export (server-side render pipeline)
- Preset style packs (cinematic, social short-form, accessibility)
- Position/alignment controls with safe-title guides
- Optional speaker labels and accessibility markers

Exit criteria:
- Burn-in export works for target max file size and duration
- Presets are reusable across projects

## Phase 5 (Weeks 14-16): Growth, Analytics, and Hardening

Goals:
- Prepare for scale and product iteration

Deliverables:
- Usage analytics dashboard (jobs, export formats, edit activity)
- Queue-based processing option for long-running jobs
- Cost and latency monitoring for Soniox/Azure/Supabase
- Security and compliance checklist (secrets, access policies, rate limits)

Exit criteria:
- End-to-end performance baseline documented
- Cost per processed minute tracked and visible
- Security review issues triaged or resolved

## Cross-Cutting Workstreams (Run Every Phase)

- QA: regression checklist for upload -> process -> edit -> export
- Documentation: README and environment setup updates
- Observability: logs, alerts, and error budgets
- UX: mobile/responsive editor quality improvements

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
