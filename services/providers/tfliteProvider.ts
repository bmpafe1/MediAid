/**
 * MediAid · services/providers/tfliteProvider.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * TFLite provider stub.
 *
 * This module exists to document the planned interface.
 * It currently throws NotImplementedError for every call.
 *
 * DO NOT implement fake TFLite inference here.
 * When a real TFLite runtime is available:
 *   1. Install expo-tflite (or react-native-fast-tflite) as a dev dependency
 *   2. Replace the throw with real model loading and inference
 *   3. Update the descriptor's runtime to 'tflite' in registry.json
 *   4. Run the contract tests to confirm output fields are correct
 *
 * The registry routes 'tflite' runtime descriptors here automatically.
 */

import { NotImplementedError } from '@/services/modelRegistry';

/**
 * Run a TFLite model for the given module.
 *
 * @throws NotImplementedError — always, until a real runtime is implemented
 */
export function runTfliteModule(_moduleId: string, _input: unknown): never {
  throw new NotImplementedError(
    '[TFLite Provider] TFLite runtime is planned but not yet built. ' +
    'See services/providers/tfliteProvider.ts for the planned interface. ' +
    'Use a "simulated" runtime descriptor for development and testing.'
  );
}
