// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Edge Functions run on Deno and get their own lint setup.
    ignores: ['dist/*', '.expo/*', 'supabase/functions/*'],
  },
]);
