// Site-wide links. BASE_URL is "/" locally and "/<repo>/" on GitHub Pages.
import { contact } from './game';

export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const asset = (path: string) => base + path;

/** The how-to-play video, rendered in Magic Mountain/Video (Remotion) and re-encoded for the web (H.264, faststart). */
export const video = {
  src: asset('video/how-to-play.mp4'),
  poster: asset('video/how-to-play-poster.webp'),
  length: '3 min',
};

export const links = {
  rulebook: asset('magic-mountain-rulebook.pdf'),
  email: `mailto:${contact.email}`,
  emailDesigner: `mailto:${contact.email}?subject=${encodeURIComponent('Magic Mountain')}`,
  playtest: `mailto:${contact.email}?subject=${encodeURIComponent('Playtesting Magic Mountain')}`,
};
