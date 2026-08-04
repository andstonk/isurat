/**
 * Per-user upload ceilings.
 *
 * The default stays at 25 MB. A small allowlist of email addresses may upload larger files, set
 * via `LARGE_UPLOAD_EMAILS` (comma-separated) so granting access is an env change rather than a
 * migration or a deploy of new code.
 *
 * The hard cap is deliberately 100 MB, not something larger: `POST /api/jobs/process` downloads
 * the whole video into memory, writes it to Vercel's 512 MB `/tmp`, transcodes it, reads the
 * result back into memory, and copies it again for the Soniox upload — roughly 4-5 copies at
 * peak — all inside a 5-minute `maxDuration` that also has to cover transcription. Raising this
 * ceiling without first moving processing off the request (streaming transcode, queue worker,
 * Soniox webhook) buys uploads that succeed and then fail in processing. See ROADMAP.md Phase 5.
 */

export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Also the `videos.file_size` check constraint ceiling — keep the two in step. */
export const MAX_ALLOWED_UPLOAD_BYTES = 100 * 1024 * 1024;

function allowlistedEmails() {
  return new Set((process.env.LARGE_UPLOAD_EMAILS ?? "")
    .split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean));
}

/** Optional override, clamped to the database ceiling so a typo can't produce failing inserts. */
function largeUploadBytes() {
  const configured = Number(process.env.LARGE_UPLOAD_LIMIT_MB);
  if (!Number.isFinite(configured) || configured <= 0) return MAX_ALLOWED_UPLOAD_BYTES;
  return Math.min(Math.round(configured * 1024 * 1024), MAX_ALLOWED_UPLOAD_BYTES);
}

export function maxUploadBytesForEmail(email?: string | null) {
  if (!email) return DEFAULT_MAX_UPLOAD_BYTES;
  return allowlistedEmails().has(email.trim().toLowerCase()) ? largeUploadBytes() : DEFAULT_MAX_UPLOAD_BYTES;
}

export function formatUploadLimit(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
