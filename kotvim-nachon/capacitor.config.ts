import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kotvimnachon.app',
  appName: 'כותבים נכון',
  webDir: 'dist',
  android: { backgroundColor: '#fff7e6' },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
