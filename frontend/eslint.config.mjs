import nextConfig from 'eslint-config-next';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  // Next.js flat config (includes react, react-hooks, jsx-a11y, etc.)
  ...nextConfig,

  // TypeScript overrides
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      'react/self-closing-comp': 'warn',
    },
  },

  // Prettier last — disables conflicting rules
  prettierConfig,

  // Overrides: silence rules that don't apply in this project context
  {
    rules: {
      // react-compiler plugin is not installed; disable its rules to avoid "not found" errors
      'react-compiler/react-compiler': 'off',
      // These patterns are intentional (shadcn/ui components, mock data components)
      'react/no-unstable-nested-components': 'off',
      // setState inside effects is a valid pattern for syncing derived state
      'react-hooks/set-state-in-effect': 'off',
      // Nested component definitions are acceptable for small UI helpers
      'react-hooks/static-components': 'off',
      // Math.random() in useMemo is intentional for skeleton width variation
      'react-hooks/purity': 'off',
    },
  },

  // Ignores
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'out/**',
      'public/**',
      'next.config.mjs',
      'postcss.config.mjs',
    ],
  },
];

export default config;
