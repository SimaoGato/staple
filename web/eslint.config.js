import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'src/wasm-pkg',
      'src/pdfium-pkg',
      'dist-prod',
      'scripts/*.mjs',
      'pdfium-wasm',
      'public',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
