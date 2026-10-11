// Site-wide links. BASE_URL is "/" locally and "/<repo>/" on GitHub Pages.
import { contact } from './game';

export const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const asset = (path: string) => base + path;

export const links = {
  rulebook: asset('magic-mountain-rulebook.pdf'),
  email: `mailto:${contact.email}`,
  emailDesigner: `mailto:${contact.email}?subject=${encodeURIComponent('Magic Mountain')}`,
  playtest: `mailto:${contact.email}?subject=${encodeURIComponent('Playtesting Magic Mountain')}`,
};
