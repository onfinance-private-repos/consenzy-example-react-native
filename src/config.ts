import { Platform } from 'react-native';

/**
 * Where the example session server runs. Set EXPO_PUBLIC_SESSION_SERVER_URL (e.g. in a git-ignored .env) or type it
 * on the sign-in screen. The defaults reach a server on your machine from the Android emulator (10.0.2.2) or the iOS
 * simulator (localhost). Plain http is accepted only for this local development setup.
 */
export const DEFAULT_SESSION_SERVER_URL: string =
  process.env.EXPO_PUBLIC_SESSION_SERVER_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787');

/** The minor in the shared demo data whose consent only a guardian session can give (DPDP s.9). */
export const DEMO_CHILD_REF = 'CUST-DEMO-CHILD-7';
