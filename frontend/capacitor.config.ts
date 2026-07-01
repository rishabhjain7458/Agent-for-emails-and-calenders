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
      autoUpdate: 'always',
      version: '1.0.6'
    }
  }
};

export default config;
