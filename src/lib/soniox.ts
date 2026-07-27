const DEFAULT_BASE_URL = "https://api.soniox.com/v1";

export type SonioxToken = {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  language?: string | null;
  is_audio_event?: boolean | null;
};

type SonioxFile = { id: string };
type SonioxTranscription = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  audio_duration_ms?: number | null;
  error_message?: string | null;
};
type SonioxTranscript = { text: string; tokens: SonioxToken[] };
type SonioxError = { message?: string; error_message?: string };

function config() {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) throw new Error("SONIOX_API_KEY is not configured.");
  return {
    apiKey,
    baseUrl: (process.env.SONIOX_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

async function sonioxFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...init?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as SonioxError;
    throw new Error(error.message ?? error.error_message ?? `Soniox request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function uploadSonioxFile(buffer: Buffer, filename: string) {
  const form = new FormData();
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  form.append("file", new Blob([bytes.buffer], { type: "video/mp4" }), filename);
  return sonioxFetch<SonioxFile>("/files", { method: "POST", body: form });
}

export async function createSonioxTranscription(fileId: string, clientReferenceId: string) {
  return sonioxFetch<SonioxTranscription>("/transcriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.SONIOX_TRANSCRIPTION_MODEL ?? "stt-async-v4",
      file_id: fileId,
      enable_language_identification: true,
      client_reference_id: clientReferenceId,
    }),
  });
}

export async function waitForSonioxTranscription(id: string, timeoutMs = 280_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const transcription = await sonioxFetch<SonioxTranscription>(`/transcriptions/${id}`);
    if (transcription.status === "completed") return transcription;
    if (transcription.status === "error") throw new Error(transcription.error_message ?? "Soniox transcription failed.");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Soniox transcription timed out. Try again later.");
}

export function getSonioxTranscript(id: string) {
  return sonioxFetch<SonioxTranscript>(`/transcriptions/${id}/transcript`);
}

export async function deleteSonioxTranscription(id: string) {
  await sonioxFetch<void>(`/transcriptions/${id}`, { method: "DELETE" });
}

export async function deleteSonioxFile(id: string) {
  await sonioxFetch<void>(`/files/${id}`, { method: "DELETE" });
}

export function tokensToSubtitleCues(tokens: SonioxToken[]) {
  const spoken = tokens.filter((token) => !token.is_audio_event && token.text.trim() && token.end_ms > token.start_ms);
  const cues: Array<{ cue_index: number; start_ms: number; end_ms: number; text: string }> = [];
  let group: SonioxToken[] = [];

  const flush = () => {
    if (!group.length) return;
    cues.push({
      cue_index: cues.length,
      start_ms: group[0].start_ms,
      end_ms: Math.max(group[0].start_ms + 1, group.at(-1)!.end_ms),
      text: group.map((token) => token.text).join("").trim(),
    });
    group = [];
  };

  for (const token of spoken) {
    group.push(token);
    const text = group.map((item) => item.text).join("").trim();
    const duration = token.end_ms - group[0].start_ms;
    const sentenceEnd = /[.!?][”"']?$/.test(text);
    if (duration >= 4_000 || text.length >= 72 || (duration >= 1_500 && sentenceEnd)) flush();
  }
  flush();
  return cues;
}

export function detectTranscriptLanguage(tokens: SonioxToken[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.language) counts.set(token.language, (counts.get(token.language) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}