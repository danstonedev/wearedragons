import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/world/**/*.tsx', 'src/vr/VRFlight.tsx', 'src/DragonSelect.tsx'],
    rules: {
      // R3F intentionally mutates owned Three.js / Rapier objects in its frame loop.
      // React Compiler's immutability analysis cannot distinguish these from React data.
      // Keep the ordinary hooks, dependencies, purity and state rules enabled.
      'react-hooks/immutability': 'off',
    },
  },
])
