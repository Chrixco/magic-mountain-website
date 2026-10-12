// Exports the alternative logo marks as 1024 px PNGs plus one comparison sheet with the current mark.
// Run after scripts/logo_alternatives.py:  node scripts/logo-alt-png.mjs
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const logo = new URL('../../Final Design/Logo/', import.meta.url).pathname.replace(/%20/g, ' ');
const alt = logo + 'Alternatives/';
const files = readdirSync(alt).filter((f) => f.endsWith('.svg') && !f.startsWith('._')).sort();
for (const f of files) {
  await sharp(alt + f, { density: 737 }).resize(1024, 1024).png().withMetadata({ density: 300 }).toFile(alt + f.replace('.svg', '_1024.png'));
}
const all = [logo + 'MagicMountain_Logo_Mark.svg', ...files.map((f) => alt + f)];
const tiles = await Promise.all(all.map((f) => sharp(f, { density: 288 }).resize(360, 360).png().toBuffer()));
await sharp({ create: { width: 40 + all.length * 400, height: 440, channels: 4, background: '#ffffff' } })
  .composite(tiles.map((input, i) => ({ input, left: 40 + i * 400, top: 40 })))
  .png().toFile(alt + 'MagicMountain_Logo_Alternatives_Sheet.png');
console.log(files.length, 'alternatives exported');
