# Magic Mountain — website

Static promotional site for the board game *Magic Mountain*, for players and publishers.
Built with [Astro](https://astro.build) and deployed to GitHub Pages.

## Run it locally

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # writes the static site to dist/
npm run preview    # serves dist/
```

## Publish on GitHub Pages

1. Create a repository (for example `magic-mountain`) and push this folder to its `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` builds and publishes the site via `.github/workflows/deploy.yml`.
   The site address and base path are filled in automatically, so it works at
   `https://<user>.github.io/<repo>/` or on a custom domain.

## Where things live

| Path | What it is |
| --- | --- |
| `src/pages/index.astro` | The page: every section, in order |
| `src/components/MountainBuilder.astro` | The "build the mountain" board you can fill from the four bags |
| `src/components/EnergyChart.astro` | Energy budget chart (rulebook §5) |
| `src/data/game.ts` | All game numbers: tiles, gear, mountains, Golden Tickets, components. Change rules here |
| `src/styles/global.css` | Design tokens: colours from the tiles, golden-ratio type and spacing |
| `src/assets/` | Cover art, playtest photos and cards. Astro resizes them to WebP at build time |
| `public/tiles/` | Terrain tiles (WebP, 240 px) used by the board |
| `public/magic-mountain-rulebook.pdf` | The rulebook visitors can download |

## Golden ratio

Everything is a power of φ = 1.618:

- **Type**: base 18 px, steps ×√φ (23, 29, 37, 47, 76 px); body line height φ; headings 2/φ.
- **Space**: 0.382, 0.618, 1, 1.618, 2.618, 4.236, 6.854 rem.
- **Columns**: two-column sections split 1 : 1.618.
- **Images**: hero and photos cropped to 1.618 : 1 (1 : 1.618 for the tall hero on phones).
- **Motion**: 238 / 382 / 618 ms.

Cards keep their printed proportions (63.5 × 88.9 mm) so the art is never cropped.

## Updating art

- **Tiles**: every printed design in `Final Design/Tiles` becomes `public/tiles/e<elevation>_<terrain>_<letter>[_vp].webp`
  (240 px, `cwebp -q 80 -resize 240 0`), and `src/data/tiles.json` lists each design with its copies. The bags on the
  board use that list, so a re-export with new artworks or counts only needs the files and the JSON regenerated.
  START tiles are `start_<n>_<colour>.webp`, Summit tiles `summit_<short|standard|expedition>[_large].webp`.
- **Icons**: `src/data/icons.ts` holds the gear symbols from `Final Design/Symbols` (SVG bodies, 8 × 8 pt live area).
- **Cards, photos, cover**: replace the file in `src/assets/` with the same name. Photos from an iPhone
  (HEIC) need converting first: `sips -s format jpeg -Z 2800 IMG.HEIC --out src/assets/photos/playtest-1.jpg`.
- **Rulebook**: replace `public/magic-mountain-rulebook.pdf`.

## Rulebook art

`scripts/rulebook-art.ts` renders print illustrations in the style of the hero map and the ink background:
golden-ratio PNGs at 300 dpi with a transparent background, from the full-resolution tiles in `Final Design/Tiles`.

```sh
node scripts/rulebook-art.ts             # writes Final Design/Rulebook Art/*.png
node scripts/rulebook-art.ts --preview   # quarter-size previews in art-preview/
node scripts/rulebook-art.ts Map_Vertical_A=1234   # try another mountain for one image
```
