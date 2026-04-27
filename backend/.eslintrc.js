/**
 * Configuración de ESLint para el backend de Voz Ciudadana.
 * Usa @typescript-eslint con reglas estrictas adaptadas al proyecto.
 *
 * Supuesto: Se usa ESLint v8 con la API legacy de configuración (.eslintrc.js).
 * Para migrar a eslint.config.js (flat config) cuando se actualice a ESLint v9.
 */
'use strict';

module.exports = {
  root: true,

  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.test.json', './prisma/seed/tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 2021,
  },

  plugins: ['@typescript-eslint'],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],

  env: {
    node: true,
    es2021: true,
  },

  rules: {
    // ── TypeScript ────────────────────────────────────────────────────────────

    // Exigir tipos explícitos en funciones públicas de módulo
    '@typescript-eslint/explicit-module-boundary-types': 'warn',

    // No permitir `any` explícito (usar `unknown` cuando el tipo es realmente desconocido)
    '@typescript-eslint/no-explicit-any': 'warn',

    // Forzar uso de `void` en promesas flotantes — evita olvidar await
    '@typescript-eslint/no-floating-promises': 'error',

    // Evitar variables no usadas (con excepción de parámetros con prefijo _)
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Desactivar la versión base de ESLint (la de TS ya la cubre)
    'no-unused-vars': 'off',

    // Forzar await al llamar funciones async
    '@typescript-eslint/await-thenable': 'error',

    // Evitar require() — usar import/export ES modules
    '@typescript-eslint/no-require-imports': 'error',

    // ── Estilo ────────────────────────────────────────────────────────────────

    // Consistencia en uso de comillas (Prettier toma el control real, esto es safety net)
    quotes: ['warn', 'single', { avoidEscape: true }],

    // Siempre usar punto y coma
    semi: ['warn', 'always'],

    // Nunca console.log en producción (excepto console.warn / console.error)
    // Nota: en dev queremos logs — desactivar si resulta muy ruidoso
    'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'log'] }],

    // ── Seguridad ─────────────────────────────────────────────────────────────

    // Evitar eval() — vector de inyección
    'no-eval': 'error',
  },

  ignorePatterns: ['dist/', 'node_modules/', '*.js', '!.eslintrc.js', 'prisma/'],

  overrides: [
    {
      // Archivos de test — reglas más permisivas para mocks y utilidades de testing
      files: ['src/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        // @ts-ignore es aceptable en mocks de test
        '@typescript-eslint/ban-ts-comment': 'off',
        // require() es aceptable en tests para require dinámico
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        // Funciones async sin await son comunes en jest.fn() mocks
        '@typescript-eslint/require-await': 'off',
        // unsafe-any es aceptable en mocks de test
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        // Variables no usadas en tests (imports para typing, vars de debugging)
        '@typescript-eslint/no-unused-vars': 'off',
        'no-unused-vars': 'off',
      },
    },
  ],
};
