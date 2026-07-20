// ─── Recordings Store ──────────────────────────────────────
import { put, get, getAll, remove } from "../db";
import type { DBSchema } from "../db";

type RecordingValue = DBSchema["recordings"]["value"];

export async function saveRecording(recording: RecordingValue): Promise<void> {
  await put("recordings", recording);
}

export async function getRecording(id: string): Promise<RecordingValue | undefined> {
  return get("recordings", id);
}

export async function getAllRecordings(): Promise<RecordingValue[]> {
  return getAll("recordings");
}

export async function deleteRecording(id: string): Promise<void> {
  await remove("recordings", id);
}

// AudioBuffer → ArrayBuffer conversion helpers
export function audioBufferToArrayBuffer(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const totalSamples = length * numChannels;
  const floatArray = new Float32Array(totalSamples);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    floatArray.set(channelData, ch * length);
  }

  // Store metadata + PCM data
  const metadata = JSON.stringify({ numChannels, length, sampleRate });
  const metaBytes = new TextEncoder().encode(metadata);
  const metaLen = new Uint8Array(new Uint32Array([metaBytes.length]).buffer);
  const pcmBytes = new Uint8Array(floatArray.buffer);
  const result = new Uint8Array(4 + metaBytes.length + pcmBytes.length);
  result.set(metaLen, 0);
  result.set(metaBytes, 4);
  result.set(pcmBytes, 4 + metaBytes.length);
  return result.buffer;
}

export function arrayBufferToAudioBuffer(
  buffer: ArrayBuffer,
  audioCtx: AudioContext
): AudioBuffer {
  const data = new Uint8Array(buffer);
  const metaLen = new Uint32Array(data.buffer.slice(0, 4))[0];
  const metaStr = new TextDecoder().decode(data.slice(4, 4 + metaLen));
  const { numChannels, length, sampleRate } = JSON.parse(metaStr);
  const pcmStart = 4 + metaLen;
  const pcmBytes = data.slice(pcmStart);
  const floatData = new Float32Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.length / 4);
  const audioBuffer = audioCtx.createBuffer(numChannels, length, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    channelData.set(floatData.subarray(ch * length, (ch + 1) * length));
  }
  return audioBuffer;
}
