import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked, // Enables type-aware rules
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ============================================
      // AWS Lambda Best Practices
      // ============================================

      // CRITICAL: Catch unhandled promises - silent failures in Lambda
      '@typescript-eslint/no-floating-promises': 'error',

      // Don't await non-promises (usually a bug)
      '@typescript-eslint/await-thenable': 'error',

      // Don't pass async functions where sync callbacks expected
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],

      // Async function should await something (otherwise why async?)
      '@typescript-eslint/require-await': 'warn',

      // Use `return await` in try-catch for proper stack traces
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // Throw proper Error objects, not strings
      '@typescript-eslint/only-throw-error': 'error',

      // ============================================
      // General TypeScript Best Practices
      // ============================================

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Prefer nullish coalescing (??) over || for defaults
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',

      // Prefer optional chaining (?.) over && chains
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // ============================================
      // JavaScript Best Practices
      // ============================================

      // Strict equality (=== instead of ==)
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // No var, use const/let
      'no-var': 'error',

      // Prefer const over let when not reassigned
      'prefer-const': 'error',

      // No console in production (use structured logger)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // No debugger statements
      'no-debugger': 'error',

      // No eval
      'no-eval': 'error',
    },
  },
  {
    // Relax rules for tests
    files: ['**/__tests__/**', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off', // Mock functions trigger false positives
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-console': 'off',
    },
  },
  {
    // Example handlers are demo/template code
    files: ['**/handlers/example.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // Storage implementations are async for interface but may have sync operations
    files: ['**/storage/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Allow console in server entry points
    files: ['**/server.ts', '**/lambda.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Allow console in logger and storage bootstrap
    files: ['**/utils/logger.ts', '**/storage/index.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'terraform/', '*.js'],
  }
);
