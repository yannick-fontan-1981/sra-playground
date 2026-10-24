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
      input: ['index.html', 'architecture.html', 'videos.html', ...contentPages]
        .map(path => fileURLToPath(new URL(`./${path}`, import.meta.url))),
    },
  },
});
