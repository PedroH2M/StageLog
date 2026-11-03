import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  type Analytics,
} from 'firebase/analytics';
import {
  deleteApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import type { FirebaseWebConfig } from '../types/models';

const RUNTIME_FB_CONFIG_KEY = 'stagelog_firebase_config_v1';

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedAnalytics: Analytics | null = null;

function getEnvFirebaseConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();

  if (!apiKey || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
      `${projectId}.firebasestorage.app`,
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
    appId,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim(),
  };
}

export function getRuntimeFirebaseConfig(): FirebaseWebConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_FB_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseWebConfig;
    if (parsed.apiKey && parsed.projectId && parsed.appId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseFirebaseSnippet(input: string): FirebaseWebConfig | null {
  const extract = (field: string): string => {
    const regex = new RegExp(`${field}\\s*:\\s*["']([^"']+)["']`);
    const match = input.match(regex);
    return match ? match[1].trim() : '';
  };

  try {
    const parsed = JSON.parse(input) as Partial<FirebaseWebConfig>;
    if (parsed.apiKey && parsed.projectId && parsed.appId) {
      return {
        apiKey: parsed.apiKey,
        authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
        projectId: parsed.projectId,
        storageBucket: parsed.storageBucket,
        messagingSenderId: parsed.messagingSenderId,
        appId: parsed.appId,
        measurementId: parsed.measurementId,
      };
    }
  } catch {
    // Segue para extração via Regex do snippet JS do Firebase Console
  }

  const apiKey = extract('apiKey');
  const projectId = extract('projectId');
  const appId = extract('appId');
  if (!apiKey || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain: extract('authDomain') || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: extract('storageBucket') || `${projectId}.firebasestorage.app`,
    messagingSenderId: extract('messagingSenderId'),
    appId,
    measurementId: extract('measurementId') || undefined,
  };
}

export async function saveRuntimeFirebaseConfig(
  config: FirebaseWebConfig
): Promise<void> {
  localStorage.setItem(RUNTIME_FB_CONFIG_KEY, JSON.stringify(config));
  if (cachedApp) {
    try {
      await deleteApp(cachedApp);
    } catch {
      // Ignora caso já tenha sido encerrado
    }
  }
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
  cachedAnalytics = null;
}

export async function clearRuntimeFirebaseConfig(): Promise<void> {
  localStorage.removeItem(RUNTIME_FB_CONFIG_KEY);
  if (cachedApp) {
    try {
      await deleteApp(cachedApp);
    } catch {
      // Ignora
    }
  }
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
  cachedAnalytics = null;
}

export function getActiveFirebaseConfig(): {
  config: FirebaseWebConfig | null;
  source: 'env' | 'runtime' | 'none';
} {
  const envCfg = getEnvFirebaseConfig();
  if (envCfg) return { config: envCfg, source: 'env' };

  const runtimeCfg = getRuntimeFirebaseConfig();
  if (runtimeCfg) return { config: runtimeCfg, source: 'runtime' };

  return { config: null, source: 'none' };
}

export function getFirebaseServices(): {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  analytics: Analytics | null;
  isConfigured: boolean;
  projectId?: string;
} {
  const { config } = getActiveFirebaseConfig();
  if (!config) {
    return {
      app: null,
      auth: null,
      db: null,
      analytics: null,
      isConfigured: false,
    };
  }

  try {
    if (!cachedApp) {
      const existing = getApps();
      cachedApp = existing.length > 0 ? existing[0] : initializeApp(config);
      cachedAuth = getAuth(cachedApp);
      cachedDb = getFirestore(cachedApp);

      if (config.measurementId && typeof window !== 'undefined') {
        void isAnalyticsSupported().then((supported) => {
          if (supported && cachedApp) {
            cachedAnalytics = getAnalytics(cachedApp);
          }
        });
      }
    }

    return {
      app: cachedApp,
      auth: cachedAuth,
      db: cachedDb,
      analytics: cachedAnalytics,
      isConfigured: true,
      projectId: config.projectId,
    };
  } catch (err) {
    console.error('[StageLog] Erro ao inicializar Firebase:', err);
    return {
      app: null,
      auth: null,
      db: null,
      analytics: null,
      isConfigured: false,
    };
  }
}
