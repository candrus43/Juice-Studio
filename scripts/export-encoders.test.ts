// lamejs 1.2.1's legacy CJS bundle expects a few module globals under Bun.
const [lameModule, modeModule, bitStreamModule] = await Promise.all([
  import("lamejs/src/js/Lame.js"),
  import("lamejs/src/js/MPEGMode.js"),
  import("lamejs/src/js/BitStream.js"),
]);
const runtime = globalThis as typeof globalThis & Record<string, unknown>;
 runtime.Lame = lameModule.default ?? lameModule;
 runtime.MPEGMode = modeModule.default ?? modeModule;
 runtime.BitStream = bitStreamModule.default ?? bitStreamModule;
const { audioBufferToMp3, audioBufferToWav } = await import("../src/audio/export.ts");

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(`FAIL: ${message}`);
};
const ascii = (bytes: Uint8Array, offset: number, text: string) =>
  text === String.fromCharCode(...bytes.slice(offset, offset + text.length));

function fixture(sampleRate = 44_100, length = 2_304) {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const value = 0.35 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    left[i] = value;
    right[i] = value * 0.8;
  }
  return { sampleRate, length, numberOfChannels: 2, getChannelData: (channel: number) => channel ? right : left } as unknown as AudioBuffer;
}

const wav = audioBufferToWav(fixture(), { bitDepth: 16 });
const wb = new Uint8Array(await wav.arrayBuffer());
const wv = new DataView(wb.buffer);
assert(wav.type === "audio/wav", `WAV MIME is ${wav.type}`);
assert(wav.size > 44 && ascii(wb, 0, "RIFF") && ascii(wb, 8, "WAVE"), "WAV RIFF/WAVE header");
assert(ascii(wb, 12, "fmt ") && wv.getUint32(16, true) === 16, "WAV fmt chunk");
assert(wv.getUint16(20, true) === 1 && wv.getUint16(22, true) === 2, "WAV PCM stereo format");
assert(wv.getUint32(24, true) === 44_100 && wv.getUint16(34, true) === 16, "WAV sample rate/bit depth");
assert(ascii(wb, 36, "data") && wv.getUint32(40, true) === wb.length - 44, `WAV data chunk (${String.fromCharCode(...wb.slice(36,40))} ${wv.getUint32(40, true)} ${wb.length})`);
assert(wb.slice(44).some((byte) => byte !== 0), "WAV audio is non-silent");

const bitrates = [128, 192, 256, 320];
const indexes = new Map([[32, 1], [40, 2], [48, 3], [56, 4], [64, 5], [80, 6], [96, 7], [112, 8], [128, 9], [160, 10], [192, 11], [224, 12], [256, 13], [320, 14]]);
for (const bitrate of bitrates) {
  const mp3 = await audioBufferToMp3(fixture(), bitrate);
  const mb = new Uint8Array(await mp3.arrayBuffer());
  assert(mp3.type === "audio/mpeg" && mp3.size > 100, `MP3 MIME/non-empty at ${bitrate}`);
  assert(!ascii(mb, 0, "RIFF") && !ascii(mb, 0, "WEBM"), `MP3 is not masquerading at ${bitrate}`);
  let matched = false;
  for (let i = 0; i + 4 < mb.length; i++) {
    const h = (mb[i] << 24) | (mb[i + 1] << 16) | (mb[i + 2] << 8) | mb[i + 3];
    if ((h >>> 21) === 0x7ff && ((h >>> 19) & 3) === 3 && ((h >>> 17) & 3) === 1) {
      const index = (h >>> 12) & 0xf;
      assert(indexes.get(bitrate) === index, `MP3 bitrate header ${index} != ${bitrate}`);
      matched = true; break;
    }
  }
  assert(matched, `valid MPEG-1 Layer III frame at ${bitrate}`);
}
console.log("export encoder validation: PASS (WAV RIFF/fmt/data + MP3 128/192/256/320 MPEG frames)");
