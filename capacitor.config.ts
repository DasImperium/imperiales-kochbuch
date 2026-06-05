import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.imperium.kochbuch',
  appName: 'Imperiales Kochbuch',
  webDir: 'dist',
  server: {
    url: 'https://imperiales-kochbuch.lovable.app',
    cleartext: true
  }
};

export default config;