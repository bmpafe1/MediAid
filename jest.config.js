/**
 * MediAid Jest configuration
 * AICEXPERTS Limited · MIT Licence
 *
 * Coverage is measured ONLY on the logic modules listed below.
 * UI screens (app/**, components/**) are excluded — they require a
 * native environment and are not part of the measured scope.
 *
 * Modules in scope:
 *   services/alertRule.ts
 *   services/coughDetector.ts
 *   services/deidentify.ts
 *   services/modelRegistry.ts
 *   services/radarQueue.ts
 *   services/safetyScreen.ts
 *   services/triage.ts
 *
 * Run:
 *   pnpm test            — watch mode
 *   pnpm test:ci         — CI mode with coverage
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  // Transform TypeScript and JS under the Expo preset
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*|ngeohash)',
  ],

  // Module name mapper for path aliases (@/ → root)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Test files
  testMatch: [
    '**/services/**/*.test.ts',
    '**/services/**/__tests__/**/*.ts',
  ],

  // Setup — provides AsyncStorage mock and React Native globals
  setupFiles: [
    '@react-native-async-storage/async-storage/jest/async-storage-mock',
  ],

  // Coverage — ONLY the logic modules (not UI screens)
  collectCoverage: false,   // only in test:ci
  collectCoverageFrom: [
    'services/alertRule.ts',
    'services/coughDetector.ts',
    'services/deidentify.ts',
    'services/modelRegistry.ts',
    'services/radarQueue.ts',
    'services/safetyScreen.ts',
    'services/triage.ts',
    // Explicitly excluded:
    '!services/mockData.ts',        // data fixtures — no logic to test
    '!services/outbreakRadar.ts',   // thin orchestration layer
    '!services/radarRead.ts',       // thin cache layer
    '!services/voiceCommands.ts',   // native-only, no logic
    '!services/**/*.test.ts',
    '!services/providers/**',       // covered via modelRegistry tests
  ],

  coverageThreshold: {
    global: {
      lines:      80,
      branches:   80,
      functions:  80,
      statements: 80,
    },
  },

  coverageReporters: ['text', 'lcov', 'json-summary'],

  // Coverage directory — CI uploads this as an artifact
  coverageDirectory: 'coverage',
};
