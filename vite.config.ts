import { defineConfig } from 'vite';

export default defineConfig({
  // The managed Sites preview uses this explicit development hostname.
  server: { allowedHosts: ['terminal.local'] },
  preview: { allowedHosts: ['terminal.local'] },
});
