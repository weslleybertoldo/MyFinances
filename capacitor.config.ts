import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.weslley.myfinances',
  appName: 'MyFinances',
  webDir: 'dist',
  server: {
    url: 'https://myfinances-app.vercel.app',
    cleartext: true,
  },
};

export default config;
