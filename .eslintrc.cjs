'use strict';

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // Disallow any without justification comment
    '@typescript-eslint/no-explicit-any': 'error',
    // Prefer type imports
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    // No unused variables
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // No floating promises
    '@typescript-eslint/no-floating-promises': 'error',
    // Require await on async functions that return void
    '@typescript-eslint/require-await': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.js',
    '*.cjs',
    '*.mjs',
  ],
  overrides: [
    {
      // Allow JS config files themselves
      files: ['.eslintrc.cjs', 'prettier.config.cjs', '*.config.js', '*.config.cjs'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
