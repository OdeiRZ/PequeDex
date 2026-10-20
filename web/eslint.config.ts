import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from 'eslint-config-prettier/flat'

// typescript-eslint se usa directamente (en vez de @vue/eslint-config-typescript,
// que solo añadía este mismo cableado): ese paquete arrastra fast-glob ->
// micromatch -> braces, con un aviso de seguridad sin versión corregida (ver
// "npm audit limpio" en el README).
export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  // `sw/` es la plantilla del service worker, con marcadores que el build sustituye
  // (no es JavaScript válido hasta entonces); la comprueban sus pruebas.
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'sw/**']),

  ...pluginVue.configs['flat/essential'],
  tseslint.configs.recommended,

  {
    // Los .vue los analiza vue-eslint-parser y su <script lang="ts"> lo delega
    // en el parser de TypeScript. Se repite aquí porque la config de
    // typescript-eslint, que va antes, pone su parser a todos los ficheros.
    name: 'app/vue-typescript',
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  skipFormatting,
)
