import js from '@eslint/js';
import globals from 'globals';

export default [{
  files: ['backend/**/*.mjs', 'runtime/**/*.mjs', 'src/**/*.mjs', 'scripts/**/*.mjs', 'tests/js/**/*.mjs'],
  languageOptions: { globals: { ...globals.browser, ...globals.node } },
  rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { ignoreRestSiblings: true }] },
}];
