/**
 * MediAid · constants/featureFlags.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Feature flags controlling what is visible in the UNICEF demo build.
 *
 * UNICEF-FUNDED SCOPE (always visible):
 *   - 90-second scan workflow
 *   - Results dashboard
 *   - Outbreak Radar (Radar tab)
 *   - Data Sync (Sync tab)
 *   - History / Evidence tabs
 *   - Safety screen (non-bypassable RED alert)
 *   - Consent step (part of scan workflow)
 *   - Settings: language, demo mode, site selector
 *   - Voice Self-Test (microphone diagnostic)
 *   - Models page (model-swap registry viewer)
 *   - Daily report (aggregate data only)
 *   - Patient detail (within scan history)
 *   - FHIR viewer (within patient detail)
 *   - Biometric identity (prominently labelled SIMULATED)
 *   - SMS escalation (within safety screen)
 *
 * NON-FUNDED / VISION-ONLY (hidden when VISION_MODULES = false):
 *   - llm-validation       (mock GPT-4o/Gemini/Claude — contradicts no-cloud-inference)
 *   - ai-advisor           (mock AI — not funded scope)
 *   - self-healing-ai      (experimental — not funded scope)
 *   - formulary            (drug formulary — not funded scope)
 *   - risk-calculator      (clinical risk calculators — not funded scope)
 *   - treatment-protocols  (treatment protocol viewer — not funded scope)
 *   - training-quiz        (CHA training quiz — not funded scope)
 *   - cha-professionalization (CHA CPD tracker — not funded scope)
 *   - impact-dashboard     (impact metrics — not funded scope)
 *   - health-education     (health education library — not funded scope)
 *   - vital-trends         (longitudinal vital trends — not funded scope)
 *   - analytics            (aggregate analytics — not funded scope)
 *   - emergency-directory  (facility directory — not funded scope)
 *   - schedule             (patient scheduling — not funded scope)
 *   - patient-queue        (patient queue — not funded scope)
 *
 * To enable the vision modules (e.g. for internal development):
 *   Set EXPO_PUBLIC_VISION_MODULES=true in your .env file.
 *
 * The UNICEF demo build MUST have VISION_MODULES = false.
 */

/**
 * When false (default), only the funded scope is visible.
 * When true, all research/vision modules are accessible.
 *
 * Controlled by the EXPO_PUBLIC_VISION_MODULES environment variable.
 * Defaults to false (funded-scope-only) when the variable is absent.
 */
export const VISION_MODULES: boolean =
  process.env['EXPO_PUBLIC_VISION_MODULES'] === 'true';

/**
 * Convenience guard — call this at the top of any vision-module screen.
 * If it returns false, the screen should show a "Not available" placeholder
 * or navigate back immediately.
 *
 * Usage:
 *   if (!isVisionEnabled()) { router.back(); return null; }
 */
export function isVisionEnabled(): boolean {
  return VISION_MODULES;
}

/**
 * Routes that are only reachable when VISION_MODULES is true.
 * Used by the Home screen to conditionally render tiles,
 * and by _layout.tsx to block deep links.
 */
export const VISION_ONLY_ROUTES = [
  'llm-validation',
  'ai-advisor',
  'self-healing-ai',
  'formulary',
  'risk-calculator',
  'treatment-protocols',
  'training-quiz',
  'cha-professionalization',
  'impact-dashboard',
  'health-education',
  'vital-trends',
  'analytics',
  'emergency-directory',
  'schedule',
  'patient-queue',
] as const;

export type VisionOnlyRoute = typeof VISION_ONLY_ROUTES[number];

/** Returns true if the given route name is a vision-only route. */
export function isVisionOnlyRoute(route: string): boolean {
  return VISION_ONLY_ROUTES.includes(route as VisionOnlyRoute);
}
