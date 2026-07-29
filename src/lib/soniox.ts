const DEFAULT_BASE_URL = "https://api.soniox.com/v1";

export type SonioxToken = {
  text: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
  language?: string | null;
  source_language?: string | null;
  translation_status?: "none" | "original" | "translation";
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

export async function createSonioxTranscription(fileId: string, clientReferenceId: string, targetLanguage?: string | null) {
  return sonioxFetch<SonioxTranscription>("/transcriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.SONIOX_TRANSCRIPTION_MODEL ?? "stt-async-v5",
      file_id: fileId,
      enable_language_identification: true,
      ...(targetLanguage ? { translation: { type: "one_way", target_language: targetLanguage } } : {}),
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
  const spoken = tokens.filter((token) => !token.is_audio_event && token.translation_status !== "translation"
    && token.text.trim() && typeof token.start_ms === "number" && typeof token.end_ms === "number" && token.end_ms > token.start_ms);
  const cues: Array<{ cue_index: number; start_ms: number; end_ms: number; text: string; words: Array<{ text: string; start_ms: number; end_ms: number }> }> = [];
  let group: SonioxToken[] = [];

  const flush = () => {
    if (!group.length) return;
    cues.push({
      cue_index: cues.length,
      start_ms: group[0].start_ms!,
      end_ms: Math.max(group[0].start_ms! + 1, group.at(-1)!.end_ms!),
      text: group.map((token) => token.text).join("").trim(),
      words: group.map((token) => ({ text: token.text, start_ms: token.start_ms!, end_ms: token.end_ms! })),
    });
    group = [];
  };

  for (const token of spoken) {
    group.push(token);
    const text = group.map((item) => item.text).join("").trim();
    const duration = token.end_ms! - group[0].start_ms!;
    const sentenceEnd = /[.!?][”"']?$/.test(text);
    if (duration >= 4_000 || text.length >= 72 || (duration >= 1_500 && sentenceEnd)) flush();
  }
  flush();
  return cues;
}

export function tokensToBilingualCues(tokens: SonioxToken[]) {
  const cues: Array<{ cue_index: number; start_ms: number; end_ms: number; text: string; translated_text: string; words: Array<{ text: string; start_ms: number; end_ms: number }> }> = [];
  let original: SonioxToken[] = [];
  let translation: SonioxToken[] = [];

  const flush = () => {
    if (!original.length) return;
    const translatedText = translation.map((token) => token.text).join("").trim();
    if (translatedText) cues.push({
      cue_index: cues.length,
      start_ms: original[0].start_ms!,
      end_ms: Math.max(original[0].start_ms! + 1, original.at(-1)!.end_ms!),
      text: original.map((token) => token.text).join("").trim(),
      translated_text: translatedText,
      words: original.map((token) => ({ text: token.text, start_ms: token.start_ms!, end_ms: token.end_ms! })),
    });
    original = [];
    translation = [];
  };

  for (const token of tokens) {
    if (token.translation_status === "translation") {
      translation.push(token);
      continue;
    }
    if (translation.length) flush();
    if (!token.is_audio_event && token.text.trim() && typeof token.start_ms === "number"
      && typeof token.end_ms === "number" && token.end_ms > token.start_ms) original.push(token);
  }
  flush();
  return cues;
}

export function detectTranscriptLanguage(tokens: SonioxToken[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.translation_status !== "translation" && token.language) counts.set(token.language, (counts.get(token.language) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}