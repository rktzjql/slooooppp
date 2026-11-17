import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.aimi.android',
  appName: 'AIMI',
  includePlugins: ['@capacitor/app', '@capacitor/share', '@capacitor/clipboard', '@capacitor/preferences'],
  webDir: 'apps/miniapp/dist',
  android: { adjustMarginsForEdgeToEdge: 'auto' },
};
export default config;
