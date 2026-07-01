import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@fullcalendar')) return 'calendar-vendor';
          if (id.includes('node_modules/@capacitor') || id.includes('node_modules/@capgo') || id.includes('node_modules/capacitor-secure-storage-plugin')) return 'native-vendor';
          if (id.includes('node_modules/dompurify')) return 'security-vendor';
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
