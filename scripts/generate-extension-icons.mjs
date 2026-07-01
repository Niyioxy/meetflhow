// Run once to generate placeholder PNG icons for the Chrome extension.
// Usage: node scripts/generate-extension-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("extension/icons", { recursive: true });

const sizes = [16, 48, 128];
// MeetFlhow blue #2563EB
const bg = { r: 37, g: 99, b: 235, alpha: 1 };

for (const size of sizes) {
  const r = Math.round(size / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#2563EB"/>
    <text x="${size / 2}" y="${size / 2 + size * 0.15}" font-family="sans-serif"
          font-size="${size * 0.55}" font-weight="bold" fill="white"
          text-anchor="middle" dominant-baseline="middle">M</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(`extension/icons/icon${size}.png`);
  console.log(`Generated icon${size}.png`);
}
