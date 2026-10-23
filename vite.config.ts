import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // The managed Sites preview uses this explicit development hostname.
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
  build: {
    rolldownOptions: {
      input: {
        playground: fileURLToPath(new URL('./index.html', import.meta.url)),
        architecture: fileURLToPath(new URL('./architecture.html', import.meta.url)),
      },
    },
  },
});
