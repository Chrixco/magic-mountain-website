// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages: set SITE to https://<user>.github.io and BASE to /<repo-name>.
// The deploy workflow fills both in automatically; for a custom domain use BASE=/.
export default defineConfig({
  site: process.env.SITE ?? 'https://example.github.io',
  base: process.env.BASE ?? '/',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
