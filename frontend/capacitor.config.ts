import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oconnect.assistant',
  appName: 'AI Executive Assistant',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorUpdater: {
      appId: 'com.oconnect.assistant',
      autoUpdate: 'atBackground',
      version: '1.0.0'
    }
  }
};

export default config;
