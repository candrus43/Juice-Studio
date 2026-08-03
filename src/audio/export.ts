/**
 * Juice Studio Audio Export
 * Real, dependency-free audio file encoding.
 *
 * - audioBufferToWav: PCM WAV encoder (16-bit int, 24-bit int, 32-bit float)
 *   with optional RIFF LIST/INFO metadata chunk (title, artist, album, year, genre).
 * - audioBufferToMp3: standards-valid MPEG-1 Layer III encoding via lamejs.
 * - resampleBuffer / normalizePeaks: honest signal processing before encoding.
 * - triggerDownload / formatBytes / sanitizeFileName: browser download helpers.
 *
 * All functions are browser-only at call time; the module itself is SSR-safe.
 */

export interface WavMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
}

export type WavBitDepth = 16 | 24 | 32;

// ─── Helpers ──────────────────────────────────────────────────

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function fourCC(view: DataView, offset: number, id: string): void {
  writeAscii(view, offset, id);
}

function clampSample(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/** Size of the LIST/INFO chunk payload (excluding the "LIST"+size header), 0 if nothing to write. */
function listInfoPayloadSize(metadata?: WavMetadata): number {
  if (!metadata) return 0;
  const entries: [string, string | undefined][] = [
    ["INAM", metadata.title],
    ["IART", metadata.artist],
    ["IPRD", metadata.album],
    ["ICRD", metadata.year],
    ["IGNR", metadata.genre],
  ];
  let size = 4; // "INFO"
  for (const [, value] of entries) {
    if (!value) continue;
    const len = new TextEncoder().encode(value).length;
    size += 8 + len + (len % 2); // id + size + payload + even padding
  }
  return size > 4 ? size : 0;
}

// ─── WAV encoding ─────────────────────────────────────────────

/**
 * Encode an AudioBuffer as a PCM WAV Blob.
 * 44-byte base header (RIFF/fmt/data) plus an optional LIST/INFO chunk
 * carrying ID3-style metadata, plus interleaved PCM samples.
 */
export function audioBufferToWav(
  buffer: AudioBuffer,
  opts: { bitDepth?: WavBitDepth; metadata?: WavMetadata } = {}
): Blob {
  const bitDepth = opts.bitDepth ?? 16;
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = bitDepth === 16 ? 2 : bitDepth === 24 ? 3 : 4;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const audioFormat = bitDepth === 32 ? 3 : 1; // 3 = IEEE float, 1 = PCM int

  const listPayload = listInfoPayloadSize(opts.metadata);
  const riffSize = 4 + (8 + 16) + (listPayload ? 8 + listPayload : 0) + (8 + dataSize);
  // RIFF chunk size excludes the 8-byte RIFF header ("RIFF" + size).
  const totalBytes = 8 + riffSize;

  const ab = new ArrayBuffer(totalBytes);
  const view = new DataView(ab);
  let o = 0;

  // RIFF header
  fourCC(view, o, "RIFF"); o += 4;
  view.setUint32(o, riffSize, true); o += 4;
  fourCC(view, o, "WAVE"); o += 4;

  // fmt chunk
  fourCC(view, o, "fmt "); o += 4;
  view.setUint32(o, 16, true); o += 4;
  view.setUint16(o, audioFormat, true); o += 2;
  view.setUint16(o, numChannels, true); o += 2;
  view.setUint32(o, sampleRate, true); o += 4;
  view.setUint32(o, byteRate, true); o += 4;
  view.setUint16(o, blockAlign, true); o += 2;
  view.setUint16(o, bitDepth, true); o += 2;

  // LIST/INFO metadata chunk (standard WAV metadata, read by most players/taggers)
  if (listPayload) {
    fourCC(view, o, "LIST"); o += 4;
    view.setUint32(o, listPayload, true); o += 4;
    fourCC(view, o, "INFO"); o += 4;
    const entries: [string, string | undefined][] = [
      ["INAM", opts.metadata?.title],
      ["IART", opts.metadata?.artist],
      ["IPRD", opts.metadata?.album],
      ["ICRD", opts.metadata?.year],
      ["IGNR", opts.metadata?.genre],
    ];
    for (const [id, value] of entries) {
      if (!value) continue;
      const bytes = new TextEncoder().encode(value);
      fourCC(view, o, id); o += 4;
      view.setUint32(o, bytes.length, true); o += 4;
      for (let i = 0; i < bytes.length; i++) view.setUint8(o + i, bytes[i]);
      o += bytes.length;
      if (bytes.length % 2 === 1) {
        view.setUint8(o, 0); // pad to even boundary
        o += 1;
      }
    }
  }

  // data chunk
  fourCC(view, o, "data"); o += 4;
  view.setUint32(o, dataSize, true); o += 4;

  // Interleaved PCM samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = clampSample(channels[c][i]);
      if (bitDepth === 16) {
        view.setInt16(o, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        o += 2;
      } else if (bitDepth === 24) {
        const v = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7fffff);
        view.setUint8(o, v & 0xff);
        view.setUint8(o + 1, (v >> 8) & 0xff);
        view.setUint8(o + 2, (v >> 16) & 0xff);
        o += 3;
      } else {
        view.setFloat32(o, sample, true);
        o += 4;
      }
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

// ─── Resampling & normalization (real signal processing) ─────

/**
 * Linear-interpolation resample to a target sample rate.
 * Returns the original buffer when rates match.
 */
export function resampleBuffer(buffer: AudioBuffer, targetRate: number): AudioBuffer {
  if (targetRate <= 0 || targetRate === buffer.sampleRate) return buffer;
  const numChannels = buffer.numberOfChannels;
  const targetLength = Math.max(1, Math.floor((buffer.length * targetRate) / buffer.sampleRate));
  // Use an OfflineAudioContext purely as a buffer factory (no rendering happens).
  const factory = new OfflineAudioContext(2, 1, targetRate);
  const out = factory.createBuffer(numChannels, targetLength, targetRate);
  const ratio = buffer.sampleRate / targetRate;
  for (let c = 0; c < numChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < targetLength; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, src.length - 1);
      const frac = pos - i0;
      dst[i] = src[i0] * (1 - frac) + src[i1] * frac;
    }
  }
  return out;
}

/** Peak-normalize the buffer in place so the loudest sample hits `targetPeak`. */
export function normalizePeaks(buffer: AudioBuffer, targetPeak = 0.98): void {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak < 1e-9) return; // silence — nothing to normalize
  const gain = targetPeak / peak;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= gain;
  }
}

// ─── Standards-valid MP3 encoding ─────────────────────────────
/** Encode PCM as MPEG-1 Layer III using the browser-bundled lamejs encoder. */
export async function audioBufferToMp3(buffer: AudioBuffer, bitrate: number): Promise<Blob> {
  const lame = await import("lamejs");
  // lamejs 1.2.1's CJS modules reference MPEGMode as a global from Lame.js.
  // Provide the enum-shaped fallback needed by both Bun and browser bundlers.
  const runtime = globalThis as typeof globalThis & { MPEGMode?: Record<string, object> };
  runtime.MPEGMode ??= {
    NOT_SET: {}, MONO: {}, JOINT_STEREO: {}, STEREO: {}, DUAL_CHANNEL: {},
  };
  // The package also has a legacy free-variable reference to Lame in BitStream.
  // Expose its constructor only when that compatibility path is needed.
  if (typeof (runtime as Record<string, unknown>).Lame === "undefined") {
    const lameModule = await import("lamejs/src/js/Lame.js");
    (runtime as Record<string, unknown>).Lame = lameModule.default ?? lameModule;
  }
  const encoder = new lame.Mp3Encoder(2, buffer.sampleRate, bitrate);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const chunks: Int8Array[] = [];
  for (let i = 0; i < left.length; i += 1152) {
    const n = Math.min(1152, left.length - i);
    const l = new Int16Array(n); const r = new Int16Array(n);
    for (let j = 0; j < n; j++) {
      l[j] = Math.max(-32768, Math.min(32767, Math.round(left[i + j] * 32767)));
      r[j] = Math.max(-32768, Math.min(32767, Math.round(right[i + j] * 32767)));
    }
    const encoded = encoder.encodeBuffer(l, r);
    if (encoded.length) chunks.push(encoded);
    if ((i / 1152) % 32 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(tail);
  return new Blob(chunks, { type: "audio/mpeg" });
}

/** Legacy recording helper; never use it as an MP3 encoder. */
export async function bufferToMediaRecorderBlob(buffer: AudioBuffer, mimeType: string): Promise<Blob> {
  const Ctor =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctor() as AudioContext;
  try {
    if (ctx.state !== "running") await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);

    const recorder = new MediaRecorder(dest.stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(200);
    source.start(0);
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
    recorder.stop();
    await stopped;
    return new Blob(chunks, { type: recorder.mimeType || mimeType });
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Pick the best supported MediaRecorder MIME, or "" if none. */
export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

// ─── Download helpers ─────────────────────────────────────────

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Keep the URL alive long enough for the download to start, then release.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || "export";
}
