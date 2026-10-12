// Exports the logo mark as PNG (32, 512, 2048 px; tagged 300 ppi) and the construction sheet.
// Run after scripts/logo.py:  node scripts/logo-png.mjs
import sharp from 'sharp';
const dir = new URL('../../Final Design/Logo/', import.meta.url).pathname.replace(/%20/g, ' ');
for (const size of [32, 512, 2048]) {
  await sharp(dir + 'MagicMountain_Logo_Mark.svg', { density: (72 * size) / 100 })
    .resize(size, size).png().withMetadata({ density: 300 })
    .toFile(dir + `MagicMountain_Logo_Mark_${size}.png`);
}
await sharp(dir + 'MagicMountain_Logo_Construction.svg', { density: 96 }).png().toFile(dir + 'MagicMountain_Logo_Construction.png');
console.log('exported to', dir);
