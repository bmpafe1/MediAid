// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// ── Supabase import restriction ────────────────────────────────────────────────
//
// PRIVACY ENFORCEMENT RULE (PROMPT 6):
// Only services/radarQueue.ts and services/radarRead.ts may import
// @supabase/supabase-js (or the shared client from @/template/core).
// All other files must go through the typed gateway in services/deidentify.ts
// and services/radarQueue.ts.
//
// This turns "no code path transmits raw patient data" into a checked
// static property of the repository. A companion Jest test
// (services/__tests__/supabaseImport.test.ts) performs a source-tree scan
// at test time to catch dynamic requires and template literals that ESLint
// would miss.
// ──────────────────────────────────────────────────────────────────────────────

const SUPABASE_ALLOWED_FILES = [
  // Only these two files may import Supabase directly
  '**/services/radarQueue.ts',
  '**/services/radarRead.ts',
  // Template infrastructure (onspace-internal)
  '**/template/**',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Apply the restriction to all source files EXCEPT the allowed list
    files: ['**/*.ts', '**/*.tsx'],
    ignores: SUPABASE_ALLOWED_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message:
                '[MediAid privacy] Only services/radarQueue.ts and services/radarRead.ts ' +
                'may import @supabase/supabase-js. Use the typed gateway in services/deidentify.ts.',
            },
          ],
          patterns: [
            {
              group: ['@supabase/*'],
              message:
                '[MediAid privacy] Supabase imports are restricted to radarQueue.ts and radarRead.ts.',
            },
          ],
        },
      ],
    },
  },
]);
