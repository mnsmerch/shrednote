import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'src/generated/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      /*
       * Security-relevant: raw HTML injection is forbidden across the app.
       * Note contents are always rendered as React text children. The single
       * legitimate use - JSON-LD structured data, which is JSON-serialised
       * with `<` escaped - opts out explicitly with an eslint-disable comment.
       */
      'react/no-danger': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default config;
