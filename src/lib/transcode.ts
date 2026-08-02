import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

/**
 * Normalizes any ffmpeg-readable input (HEVC/.mov from phones, already-H.264
 * .mp4, etc.) into H.264/AAC MP4 so the browser <video> preview in the editor
 * can play it everywhere, not just on HEVC-capable browsers like Safari.
 */
export async function transcodeToH264Mp4(input: Buffer, originalFileName: string): Promise<Buffer> {
  const workDir = await mkdtemp(path.join(tmpdir(), "isurat-transcode-"));
  const inputExtension = path.extname(originalFileName).toLowerCase() || ".mov";
  const inputPath = path.join(workDir, `input${inputExtension}`);
  const outputPath = path.join(workDir, "output.mp4");
  try {
    await writeFile(inputPath, input);
    await execFileAsync(ffmpeg.path, [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", inputPath,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 16 * 1024 * 1024 });
    return await readFile(outputPath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not convert this video for playback (${detail.slice(0, 300)}).`);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
