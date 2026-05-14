/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When true, show PayJSR / card checkout even if the secret exists only on the API server (PAYJSR_SECRET_KEY). */
  readonly VITE_PAYJSR_ENABLED?: string;
}

// Extend Window interface to include our env object
interface Window {
  env?: {
    [key: string]: string;
  };
}
