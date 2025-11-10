import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

const jsRecommended = { ...js.configs.recommended, files: ['**/*.{js,jsx}'] }
const reactHooksRecommended = {
  ...reactHooks.configs['recommended-latest'],
  files: ['**/*.{js,jsx}'],
}
const reactRefreshVite = {
  ...reactRefresh.configs.vite,
  files: ['**/*.{js,jsx}'],
}

export default [
  {
    ignores: ['dist'],
  },
  jsRecommended,
  reactHooksRecommended,
  reactRefreshVite,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
]
