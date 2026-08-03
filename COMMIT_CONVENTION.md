# Commit Message Convention

This project follows [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Claude must format every commit message this way when committing to this repository.

## Format

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

## Rules

1. Every commit starts with a `type`, optionally followed by `(scope)`, optionally followed by `!`, then a required `: ` (colon and space).
2. `type` is a lowercase noun (see Types below).
3. `scope` is an optional noun in parentheses naming the affected area, e.g. `fix(subtitles):`.
4. `description` immediately follows the `: ` — a short, imperative summary (e.g. "add karaoke color picker", not "added" or "adds").
5. An optional `body` may follow, separated from the description by one blank line. It's free-form and may have multiple paragraphs, explaining *why* the change was made, not just what changed.
6. Optional `footer`s follow the body, separated by one blank line. Each footer is `Token: value` or `Token #value`, with `-` in place of spaces in the token (e.g. `Refs: #123`, `Reviewed-by: Name`) — except `BREAKING CHANGE`, which stays as two words.
7. A breaking change is marked either by `!` right before the colon (`feat(api)!: ...`) or by a `BREAKING CHANGE: <description>` footer (or both). Use `BREAKING CHANGE` in footers, never `breaking change`.
8. Everything is case-insensitive except the literal footer token `BREAKING CHANGE`, which must stay uppercase.

## Types

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation only
- `style` — formatting, no code meaning change
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — performance improvement
- `test` — adding or correcting tests
- `build` — build system or dependency changes (e.g. `package.json`, `pnpm-lock.yaml`)
- `ci` — CI configuration changes (`.github/workflows/`)
- `chore` — everything else (tooling, misc maintenance)

## Scopes used in this repo

Match the area being touched, e.g.: `subtitles`, `uploads`, `auth`, `fonts`, `editor`, `api`, `export`, `styles`, `dashboard`. Omit the scope if a change doesn't cleanly belong to one area.

## Examples

```
feat(subtitles): add search and replace across cues
```

```
fix(api): reject uploads over 25MB with a clear error message
```

```
feat(export)!: drop legacy SRT timestamp format

BREAKING CHANGE: exported SRT files now use comma-separated milliseconds
per the standard spec; downstream tooling parsing the old format must update.
```

```
fix: prevent duplicate transcription jobs on retry

Introduce a per-video processing lock so a Retry click can't queue a
second Soniox job while the first is still in flight.

Refs: #41
```

## Notes for Claude

- Keep the description under ~72 characters where practical.
- Don't invent a scope that doesn't match the touched code.
- Only add a body when the *why* isn't obvious from the diff — see the root `CLAUDE.md`/session guidance on comments; the same "don't explain the what" rule applies to commit bodies.
- Never add a `BREAKING CHANGE` footer unless the change actually breaks a public contract (API response shape, exported file format, env var, migration that isn't backward compatible, etc.).
