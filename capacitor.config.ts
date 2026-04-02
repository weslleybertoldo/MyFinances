import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.weslley.myfinances',
  appName: 'MyFinances',
  webDir: 'dist',
  android: {
    webContentsDebuggingEnabled: true,
    allowMixedContent: true,
  },
  server: {
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
