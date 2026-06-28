import sharp from "sharp";
import toIco from "to-ico";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "..", "public", "logo-icon.svg");
const outPath = join(__dirname, "..", "app", "favicon.ico");

const svg = readFileSync(svgPath);
const sizes = [16, 32, 48];

const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer())
);

const ico = await toIco(pngBuffers);
writeFileSync(outPath, ico);
console.log(`Wrote ${outPath}`);
