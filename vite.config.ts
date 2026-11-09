import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const contentPages = ['architecture', 'videos'].flatMap(directory =>
  readdirSync(new URL(`./${directory}/`, import.meta.url))
    .filter(filename => filename.endsWith('.html'))
    .map(filename => `${directory}/${filename}`),
);

export default defineConfig({
  // The managed Sites preview uses this explicit development hostname.
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
  build: {
    rolldownOptions: {
      input: ['index.html', 'motivation.html', 'gallery.html', 'arc-agi-3.html', 'symbolic-reasoning.html', 'architecture.html', 'videos.html', 'contact.html', 'reasoning-lab.html', ...contentPages]
        .map(path => fileURLToPath(new URL(`./${path}`, import.meta.url))),
    },
  },
});
