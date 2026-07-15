import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { PassThrough } from "stream";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/** Extracts a [startSec, endSec) clip from an audio buffer, re-encoded as a 16kHz mono WAV file. */
export function extractClip(input: Buffer, startSec: number, endSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inputStream = new PassThrough();
    inputStream.end(input);

    ffmpeg(inputStream)
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .setStartTime(startSec)
      .duration(Math.max(endSec - startSec, 0.1))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .pipe()
      .on("data", (chunk: Buffer) => chunks.push(chunk));
  });
}
