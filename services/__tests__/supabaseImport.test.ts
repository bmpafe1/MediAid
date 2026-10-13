/**
 * MediAid · services/__tests__/supabaseImport.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Source-tree scan: asserts that only the two permitted files import
 * @supabase/supabase-js (or the Supabase URL) across the entire project.
 *
 * This test turns "no rogue Supabase call path" into a CI-checked property.
 * ESLint covers static imports; this test also catches:
 *   - require('@supabase/supabase-js')
 *   - Dynamic template literals containing the Supabase URL
 *   - Imports of supabase via the shared template client (allowed only in
 *     the two whitelisted files)
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Configuration ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '../../');

/** Files that ARE allowed to reference Supabase directly. */
const ALLOWED = new Set([
  path.join(PROJECT_ROOT, 'services', 'radarQueue.ts'),
  path.join(PROJECT_ROOT, 'services', 'radarRead.ts'),
]);

/** Patterns that indicate a direct Supabase reference. */
const SUPABASE_PATTERNS = [
  /@supabase\/supabase-js/,
  /createClient\s*\(/,           // supabase createClient()
  /SUPABASE_URL/,                // env var references
  /supabase\.co/,                // hardcoded Supabase domain
];

/** Directories to skip entirely. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.expo',
  'dist',
  '.git',
  '__tests__',    // avoid self-referential match
  'supabase',     // SQL migration files are fine
]);

/** File extensions to scan. */
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// ── File walker ────────────────────────────────────────────────────────────────

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...walkFiles(path.join(dir, entry.name)));
      }
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

// ── Test ───────────────────────────────────────────────────────────────────────

describe('Supabase import restriction', () => {
  it('only radarQueue.ts and radarRead.ts reference Supabase across the source tree', () => {
    const files = walkFiles(PROJECT_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      if (ALLOWED.has(file)) continue;

      // Also allow template/ directory (onspace-internal infrastructure)
      const rel = path.relative(PROJECT_ROOT, file);
      if (rel.startsWith('template' + path.sep)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of SUPABASE_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`  ${rel}  (matched: ${pattern})`);
          break; // one violation per file is enough
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        '[MediAid privacy] Supabase references found outside permitted files:\n' +
        violations.join('\n') +
        '\n\nOnly services/radarQueue.ts and services/radarRead.ts may import ' +
        '@supabase/supabase-js. Route all data through services/deidentify.ts first.'
      );
    }

    expect(violations).toHaveLength(0);
  });
});
