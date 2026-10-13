import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

// vite.config.ts exporta una función (necesita el modo para leer VITE_API_URL
// en el plugin del CSP), así que se resuelve con el mismo entorno antes de
// fusionarla con la configuración de pruebas.
export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**'],
        root: fileURLToPath(new URL('./', import.meta.url)),
        setupFiles: ['./src/test-setup.ts'],
      },
    }),
  ),
)
