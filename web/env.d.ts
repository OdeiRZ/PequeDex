/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del API (ver `src/lib/api.ts`). */
  readonly VITE_API_URL?: string
  /** DSN del proyecto de Sentry del frontend; sin él no se reporta nada. */
  readonly VITE_SENTRY_DSN?: string
  /** Versión de la app (el commit del despliegue) para agrupar errores por release. */
  readonly VITE_APP_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
