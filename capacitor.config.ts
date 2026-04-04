import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.weslley.myfinances',
  appName: 'MyFinances',
  webDir: 'dist',
  android: {
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  server: {
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
