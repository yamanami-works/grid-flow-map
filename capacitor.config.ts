import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.example.tohokugridmap',
  appName: '送電線マップ',
  webDir: 'dist',
  backgroundColor: '#f6f8f7',
  ios: { contentInset: 'never' },
};
export default config;
