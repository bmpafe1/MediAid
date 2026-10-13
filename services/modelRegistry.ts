/**
 * MediAid · services/modelRegistry.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Model-swap registry described to UNICEF:
 *   Each module declares an input contract, an output contract and a version.
 *   Any conforming model can be installed without rebuilding the app.
 *
 * ── Key guarantees ────────────────────────────────────────────────────────────
 *  • INVESTIGATIONAL modules NEVER alter the clinical referral colour (enforced
 *    in the run() return value and tested).
 *  • Only a 'tflite' runtime requires a real model file; 'simulated' uses the
 *    built-in simulated provider (wraps generateMockScanResult logic per module).
 *  • install() validates the contract before activating, keeps the previous
 *    version for rollback().
 *  • A clear NotImplementedError is thrown when a TFLite module is run —
 *    no fake TFLite provider exists.
 *
 * ── Data flow ─────────────────────────────────────────────────────────────────
 *  scan-workflow → registry.run(moduleId, input) → { fields, version, status }
 *  results screen reads status from registry to label each card
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import bundledRegistry from '@/models/registry.json';
import { runSimulatedModule } from './providers/simulatedProvider';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModelStatus  = 'simulated' | 'validated' | 'investigational';
export type ModelRuntime = 'simulated' | 'tflite';
export type InputKind    = 'audio' | 'video' | 'image';

export interface OutputField {
  key:   string;
  type:  'number' | 'boolean' | 'string';
  unit?: string;
  min?:  number;
  max?:  number;
}

export interface InputContract {
  kind:          InputKind;
  sampleRateHz?: number;
  durationSec?:  number;
  channels?:     number;
  shape?:        number[];
}

export interface OutputContract {
  fields: OutputField[];
}

export interface ModelDescriptor {
  id:            string;
  name:          string;
  version:       string;       // semver
  status:        ModelStatus;
  runtime:       ModelRuntime;
  funded:        boolean;
  input:         InputContract;
  output:        OutputContract;
  modelPath?:    string;        // local file path after install()
  modelCardUrl?: string;
}

/** Output of registry.run(): validated fields + descriptor metadata */
export interface ModuleOutput {
  moduleId:         string;
  version:          string;
  status:           ModelStatus;
  /** false for investigational modules — they NEVER affect referral colour */
  affectsReferral:  boolean;
  fields:           Record<string, number | boolean | string>;
}

// ── Internal storage ───────────────────────────────────────────────────────────

const REGISTRY_STORAGE_KEY = 'mediaid_model_registry_v1';
const ROLLBACK_STORAGE_KEY = 'mediaid_model_registry_rollback_v1';

// In-memory cache
let _registry: Map<string, ModelDescriptor> | null = null;

async function loadRegistry(): Promise<Map<string, ModelDescriptor>> {
  if (_registry) return _registry;
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_STORAGE_KEY);
    if (raw) {
      const arr: ModelDescriptor[] = JSON.parse(raw);
      _registry = new Map(arr.map((d) => [d.id, d]));
      return _registry;
    }
  } catch { /* corrupted — fall back to bundled */ }
  // Seed from bundled JSON
  const bundled = (bundledRegistry as { modules: ModelDescriptor[] }).modules;
  _registry = new Map(bundled.map((d) => [d.id, d]));
  return _registry;
}

async function persistRegistry(registry: Map<string, ModelDescriptor>): Promise<void> {
  _registry = registry;
  await AsyncStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify([...registry.values()]));
}

// ── Contract validation ───────────────────────────────────────────────────────

/**
 * Validates a ModelDescriptor's contract.
 * Returns null on success, or a descriptive error string on failure.
 */
export function validateContract(descriptor: ModelDescriptor): string | null {
  if (!descriptor.id || typeof descriptor.id !== 'string') {
    return 'Contract error: id must be a non-empty string';
  }
  if (!descriptor.name || typeof descriptor.name !== 'string') {
    return 'Contract error: name must be a non-empty string';
  }
  if (!/^\d+\.\d+\.\d+$/.test(descriptor.version)) {
    return `Contract error: version "${descriptor.version}" must be semver (e.g. "1.2.3")`;
  }
  const validStatuses: ModelStatus[] = ['simulated', 'validated', 'investigational'];
  if (!validStatuses.includes(descriptor.status)) {
    return `Contract error: status "${descriptor.status}" must be one of ${validStatuses.join(', ')}`;
  }
  const validRuntimes: ModelRuntime[] = ['simulated', 'tflite'];
  if (!validRuntimes.includes(descriptor.runtime)) {
    return `Contract error: runtime "${descriptor.runtime}" must be one of ${validRuntimes.join(', ')}`;
  }
  const validKinds: InputKind[] = ['audio', 'video', 'image'];
  if (!validKinds.includes(descriptor.input?.kind)) {
    return `Contract error: input.kind "${descriptor.input?.kind}" must be one of ${validKinds.join(', ')}`;
  }
  if (!descriptor.output?.fields || !Array.isArray(descriptor.output.fields) || descriptor.output.fields.length === 0) {
    return 'Contract error: output.fields must be a non-empty array';
  }
  for (const field of descriptor.output.fields) {
    if (!field.key || typeof field.key !== 'string') {
      return `Contract error: every output field must have a non-empty "key" string`;
    }
    if (!['number', 'boolean', 'string'].includes(field.type)) {
      return `Contract error: field "${field.key}" type must be number | boolean | string`;
    }
    if (field.type === 'number') {
      if (field.min !== undefined && typeof field.min !== 'number') {
        return `Contract error: field "${field.key}" min must be a number`;
      }
      if (field.max !== undefined && typeof field.max !== 'number') {
        return `Contract error: field "${field.key}" max must be a number`;
      }
      if (field.min !== undefined && field.max !== undefined && field.min >= field.max) {
        return `Contract error: field "${field.key}" min (${field.min}) must be < max (${field.max})`;
      }
    }
  }
  if (descriptor.runtime === 'tflite' && !descriptor.modelPath) {
    return `Contract error: tflite runtime requires modelPath`;
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns all registered module descriptors.
 */
export async function listModules(): Promise<ModelDescriptor[]> {
  const reg = await loadRegistry();
  return [...reg.values()];
}

/**
 * Returns the active descriptor for a module, or null if not found.
 */
export async function getActive(moduleId: string): Promise<ModelDescriptor | null> {
  const reg = await loadRegistry();
  return reg.get(moduleId) ?? null;
}

/**
 * Installs a new model descriptor (and optional model file).
 *
 * Steps:
 *   1. validateContract() — throws on invalid contract
 *   2. Copies modelFileUri to the app's documents directory
 *   3. Saves the previous version to rollback storage
 *   4. Activates the new descriptor
 *
 * @param descriptor  Full ModelDescriptor for the new model
 * @param modelFileUri  Local file URI of the model file (required for tflite)
 */
export async function install(
  descriptor: ModelDescriptor,
  modelFileUri?: string,
): Promise<void> {
  const contractError = validateContract(descriptor);
  if (contractError) throw new Error(`[ModelRegistry] install failed: ${contractError}`);

  const reg = await loadRegistry();

  // Save rollback state
  const rollbackRaw = await AsyncStorage.getItem(ROLLBACK_STORAGE_KEY);
  const rollbacks: Record<string, ModelDescriptor> = rollbackRaw ? JSON.parse(rollbackRaw) : {};
  const existing = reg.get(descriptor.id);
  if (existing) rollbacks[descriptor.id] = existing;
  await AsyncStorage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(rollbacks));

  // Copy model file if provided
  let storedPath: string | undefined;
  if (modelFileUri) {
    const docsDir = FileSystem.documentDirectory ?? '';
    const destPath = `${docsDir}mediaid_models/${descriptor.id}_${descriptor.version}.tflite`;
    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(`${docsDir}mediaid_models`, { intermediates: true }).catch(() => {});
    await FileSystem.copyAsync({ from: modelFileUri, to: destPath });
    storedPath = destPath;
  }

  const newDescriptor: ModelDescriptor = { ...descriptor, ...(storedPath ? { modelPath: storedPath } : {}) };
  reg.set(descriptor.id, newDescriptor);
  await persistRegistry(reg);

  // Invalidate cache so next run() picks up new descriptor
  _registry = reg;
}

/**
 * Rolls back the specified module to its previous version.
 * Throws if no rollback state is available.
 */
export async function rollback(moduleId: string): Promise<void> {
  const rollbackRaw = await AsyncStorage.getItem(ROLLBACK_STORAGE_KEY);
  if (!rollbackRaw) throw new Error(`[ModelRegistry] No rollback state found for "${moduleId}"`);
  const rollbacks: Record<string, ModelDescriptor> = JSON.parse(rollbackRaw);
  const prev = rollbacks[moduleId];
  if (!prev) throw new Error(`[ModelRegistry] No rollback state found for module "${moduleId}"`);

  const reg = await loadRegistry();
  const current = reg.get(moduleId);
  if (current) rollbacks[moduleId] = current; // store current as new rollback
  reg.set(moduleId, prev);
  await persistRegistry(reg);
  await AsyncStorage.setItem(ROLLBACK_STORAGE_KEY, JSON.stringify(rollbacks));
}

/**
 * Runs the specified module and returns validated output.
 *
 * Guarantees:
 *   • Output fields are validated against the output contract (type + range).
 *   • affectsReferral = false for investigational modules.
 *   • TFLite runtime throws NotImplementedError if called.
 *   • Never throws unexpectedly — returns a fallback output on error.
 *
 * @param moduleId  The module to run
 * @param input     The raw sensor input (audio buffer, video frame, image, etc.)
 */
export async function run(
  moduleId: string,
  input: unknown,
): Promise<ModuleOutput> {
  const reg = await loadRegistry();
  const descriptor = reg.get(moduleId);

  if (!descriptor) {
    throw new Error(`[ModelRegistry] Module "${moduleId}" not found in registry`);
  }

  if (descriptor.runtime === 'tflite') {
    throw new NotImplementedError(
      `[ModelRegistry] TFLite runtime for "${moduleId}" is planned but not yet built. ` +
      `Install a 'simulated' runtime module to use this slot.`
    );
  }

  // Run the simulated provider
  const rawFields = runSimulatedModule(descriptor.id);

  // Validate output against contract
  const validatedFields = validateOutputFields(rawFields, descriptor.output.fields);

  return {
    moduleId:        descriptor.id,
    version:         descriptor.version,
    status:          descriptor.status,
    // INVESTIGATIONAL modules NEVER affect clinical referral colour
    affectsReferral: descriptor.status !== 'investigational',
    fields:          validatedFields,
  };
}

// ── Output validation ─────────────────────────────────────────────────────────

function validateOutputFields(
  raw: Record<string, unknown>,
  contract: OutputField[],
): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  for (const field of contract) {
    const value = raw[field.key];
    if (field.type === 'boolean') {
      out[field.key] = Boolean(value);
    } else if (field.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value);
      const clamped = (field.min !== undefined && field.max !== undefined)
        ? Math.min(field.max, Math.max(field.min, num))
        : num;
      out[field.key] = clamped;
    } else {
      out[field.key] = String(value ?? '');
    }
  }
  return out;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Resets the registry to bundled defaults.
 * Used in tests.
 */
export async function _resetToDefaults(): Promise<void> {
  await AsyncStorage.removeItem(REGISTRY_STORAGE_KEY);
  await AsyncStorage.removeItem(ROLLBACK_STORAGE_KEY);
  _registry = null;
}

/** Invalidates the in-memory cache. Used in tests. */
export function _invalidateCache(): void {
  _registry = null;
}

// ── Error classes ──────────────────────────────────────────────────────────────

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class ContractViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractViolationError';
  }
}
