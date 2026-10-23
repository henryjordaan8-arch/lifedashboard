/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC?: string;
  readonly VITE_APP?: string;
}

/** The VERSION file, baked in at build time (shown in the Android app). */
declare const __APP_VERSION__: string;
