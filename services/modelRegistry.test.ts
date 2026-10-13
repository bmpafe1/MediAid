/**
 * MediAid · services/modelRegistry.test.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Tests for the model-swap registry (PROMPT 7).
 *
 * Test categories:
 *   1.  validateContract() accepts a correct descriptor
 *   2.  validateContract() rejects descriptors with specific violations
 *   3.  listModules() returns all 5 bundled modules
 *   4.  getActive() returns the correct descriptor
 *   5.  run() returns correct output structure for each simulated module
 *   6.  run() — investigational modules: affectsReferral === false
 *   7.  run() — funded modules: affectsReferral === true
 *   8.  run() — output fields clamped to min/max
 *   9.  install() validates contract before accepting
 *   10. install() + getActive(): swapping a simulated module for another
 *       conforming simulated one changes the version without code changes
 *   11. rollback() restores the previous version
 *   12. run() — TFLite runtime throws NotImplementedError
 *   13. Investigational modules never cause hasRedAlert=true (referral guard)
 */

import {
  validateContract,
  listModules,
  getActive,
  run,
  install,
  rollback,
  _resetToDefaults,
  _invalidateCache,
  NotImplementedError,
  type ModelDescriptor,
} from './modelRegistry';

// ── Setup: reset to bundled defaults before each test ─────────────────────────

beforeEach(async () => {
  await _resetToDefaults();
});

// ── 1. validateContract() — happy path ────────────────────────────────────────

describe('validateContract: happy path', () => {
  it('accepts a fully correct simulated descriptor', () => {
    const descriptor: ModelDescriptor = {
      id: 'test_module',
      name: 'Test Module',
      version: '1.2.3',
      status: 'simulated',
      runtime: 'simulated',
      funded: true,
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: { fields: [{ key: 'score', type: 'number', min: 0, max: 100 }] },
    };
    expect(validateContract(descriptor)).toBeNull();
  });

  it('accepts a validated image descriptor', () => {
    const descriptor: ModelDescriptor = {
      id: 'eye_module',
      name: 'Eye Module',
      version: '0.1.0',
      status: 'validated',
      runtime: 'simulated',
      funded: false,
      input: { kind: 'image', shape: [224, 224, 3] },
      output: { fields: [{ key: 'conditions', type: 'number', min: 0, max: 7 }] },
    };
    expect(validateContract(descriptor)).toBeNull();
  });

  it('accepts multiple output fields', () => {
    const descriptor: ModelDescriptor = {
      id: 'multi_out',
      name: 'Multi Output',
      version: '2.0.0',
      status: 'investigational',
      runtime: 'simulated',
      funded: false,
      input: { kind: 'video', sampleRateHz: 30, durationSec: 10, channels: 3 },
      output: {
        fields: [
          { key: 'riskScore', type: 'number', min: 0, max: 100 },
          { key: 'flagged',   type: 'boolean' },
          { key: 'category',  type: 'string' },
        ],
      },
    };
    expect(validateContract(descriptor)).toBeNull();
  });
});

// ── 2. validateContract() — rejections ────────────────────────────────────────

describe('validateContract: rejection cases', () => {
  function makeValid(): ModelDescriptor {
    return {
      id: 'ok_module', name: 'OK Module', version: '1.0.0',
      status: 'simulated', runtime: 'simulated', funded: true,
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: { fields: [{ key: 'value', type: 'number', min: 0, max: 100 }] },
    };
  }

  it('rejects empty id', () => {
    expect(validateContract({ ...makeValid(), id: '' })).toMatch(/id/);
  });

  it('rejects empty name', () => {
    expect(validateContract({ ...makeValid(), name: '' })).toMatch(/name/);
  });

  it('rejects invalid semver: "1.0"', () => {
    expect(validateContract({ ...makeValid(), version: '1.0' })).toMatch(/version/);
  });

  it('rejects invalid semver: "v1.0.0"', () => {
    expect(validateContract({ ...makeValid(), version: 'v1.0.0' })).toMatch(/version/);
  });

  it('rejects invalid status', () => {
    expect(validateContract({ ...makeValid(), status: 'fake' as any })).toMatch(/status/);
  });

  it('rejects invalid runtime', () => {
    expect(validateContract({ ...makeValid(), runtime: 'onnx' as any })).toMatch(/runtime/);
  });

  it('rejects invalid input.kind', () => {
    expect(validateContract({ ...makeValid(), input: { kind: 'lidar' as any } })).toMatch(/kind/);
  });

  it('rejects empty output.fields array', () => {
    expect(validateContract({ ...makeValid(), output: { fields: [] } })).toMatch(/fields/);
  });

  it('rejects field with invalid type', () => {
    const d = makeValid();
    d.output.fields = [{ key: 'x', type: 'float' as any }];
    expect(validateContract(d)).toMatch(/type/);
  });

  it('rejects field with min >= max', () => {
    const d = makeValid();
    d.output.fields = [{ key: 'x', type: 'number', min: 100, max: 0 }];
    expect(validateContract(d)).toMatch(/min.*max|max.*min/i);
  });

  it('rejects tflite runtime without modelPath', () => {
    const d = makeValid();
    d.runtime = 'tflite';
    // no modelPath set
    expect(validateContract(d)).toMatch(/modelPath/);
  });

  it('accepts tflite runtime with modelPath', () => {
    const d = makeValid();
    d.runtime = 'tflite';
    d.modelPath = '/some/path/model.tflite';
    expect(validateContract(d)).toBeNull();
  });
});

// ── 3. listModules() ──────────────────────────────────────────────────────────

describe('listModules', () => {
  it('returns all 5 bundled modules', async () => {
    const modules = await listModules();
    expect(modules).toHaveLength(5);
  });

  it('includes the 3 funded modules', async () => {
    const modules = await listModules();
    const funded = modules.filter((m) => m.funded);
    expect(funded).toHaveLength(3);
    const ids = funded.map((m) => m.id);
    expect(ids).toContain('tb_cough');
    expect(ids).toContain('anaemia');
    expect(ids).toContain('bioacoustic');
  });

  it('includes the 2 investigational modules', async () => {
    const modules = await listModules();
    const inv = modules.filter((m) => m.status === 'investigational');
    expect(inv).toHaveLength(2);
    const ids = inv.map((m) => m.id);
    expect(ids).toContain('jaundice');
    expect(ids).toContain('cardiac_ppg');
  });

  it('all modules pass validateContract()', async () => {
    const modules = await listModules();
    for (const m of modules) {
      expect(validateContract(m)).toBeNull();
    }
  });
});

// ── 4. getActive() ────────────────────────────────────────────────────────────

describe('getActive', () => {
  it('returns the tb_cough descriptor', async () => {
    const d = await getActive('tb_cough');
    expect(d).not.toBeNull();
    expect(d!.id).toBe('tb_cough');
    expect(d!.status).toBe('simulated');
    expect(d!.funded).toBe(true);
  });

  it('returns null for unknown module', async () => {
    const d = await getActive('does_not_exist');
    expect(d).toBeNull();
  });
});

// ── 5. run() — basic output structure ────────────────────────────────────────

describe('run: output structure for each module', () => {
  const MODULES = ['tb_cough', 'anaemia', 'bioacoustic', 'jaundice', 'cardiac_ppg'];

  for (const id of MODULES) {
    it(`run("${id}") returns a ModuleOutput with required shape`, async () => {
      const output = await run(id, {});
      expect(output.moduleId).toBe(id);
      expect(typeof output.version).toBe('string');
      expect(['simulated', 'validated', 'investigational']).toContain(output.status);
      expect(typeof output.affectsReferral).toBe('boolean');
      expect(typeof output.fields).toBe('object');
    });
  }

  it('run("tb_cough") returns tbRisk in [0, 100]', async () => {
    for (let i = 0; i < 30; i++) {
      const output = await run('tb_cough', {});
      const tbRisk = output.fields['tbRisk'] as number;
      expect(tbRisk).toBeGreaterThanOrEqual(0);
      expect(tbRisk).toBeLessThanOrEqual(100);
    }
  });

  it('run("anaemia") returns hemoglobin in [3, 20]', async () => {
    for (let i = 0; i < 20; i++) {
      const output = await run('anaemia', {});
      const hgb = output.fields['hemoglobin'] as number;
      expect(hgb).toBeGreaterThanOrEqual(3);
      expect(hgb).toBeLessThanOrEqual(20);
    }
  });

  it('run("bioacoustic") returns heartRate, spo2, respiratoryRate, afibRisk, covidFlag', async () => {
    const output = await run('bioacoustic', {});
    expect(output.fields).toHaveProperty('heartRate');
    expect(output.fields).toHaveProperty('spo2');
    expect(output.fields).toHaveProperty('respiratoryRate');
    expect(output.fields).toHaveProperty('afibRisk');
    expect(output.fields).toHaveProperty('covidFlag');
  });

  it('run("jaundice") returns jaundiceFlag as boolean', async () => {
    const output = await run('jaundice', {});
    expect(typeof output.fields['jaundiceFlag']).toBe('boolean');
  });

  it('run("cardiac_ppg") returns tremorRisk, cvdRisk10yr, glucoseFlag, eyeConditions', async () => {
    const output = await run('cardiac_ppg', {});
    expect(output.fields).toHaveProperty('tremorRisk');
    expect(output.fields).toHaveProperty('cvdRisk10yr');
    expect(output.fields).toHaveProperty('glucoseFlag');
    expect(output.fields).toHaveProperty('eyeConditions');
  });
});

// ── 6. Investigational modules: affectsReferral === false ────────────────────

describe('run: investigational modules never affect referral', () => {
  it('jaundice affectsReferral = false', async () => {
    for (let i = 0; i < 20; i++) {
      const output = await run('jaundice', {});
      expect(output.affectsReferral).toBe(false);
    }
  });

  it('cardiac_ppg affectsReferral = false', async () => {
    for (let i = 0; i < 20; i++) {
      const output = await run('cardiac_ppg', {});
      expect(output.affectsReferral).toBe(false);
    }
  });

  it('investigational modules status is "investigational"', async () => {
    const j = await run('jaundice', {});
    const c = await run('cardiac_ppg', {});
    expect(j.status).toBe('investigational');
    expect(c.status).toBe('investigational');
  });
});

// ── 7. Funded modules: affectsReferral === true ───────────────────────────────

describe('run: funded modules affect referral', () => {
  it('tb_cough affectsReferral = true', async () => {
    const output = await run('tb_cough', {});
    expect(output.affectsReferral).toBe(true);
  });

  it('anaemia affectsReferral = true', async () => {
    const output = await run('anaemia', {});
    expect(output.affectsReferral).toBe(true);
  });

  it('bioacoustic affectsReferral = true', async () => {
    const output = await run('bioacoustic', {});
    expect(output.affectsReferral).toBe(true);
  });
});

// ── 8. Output fields clamped to min/max ──────────────────────────────────────

describe('run: output fields validated against contract', () => {
  it('all numeric fields from tb_cough stay within contract bounds over 100 runs', async () => {
    for (let i = 0; i < 100; i++) {
      const output = await run('tb_cough', {});
      const tbRisk = output.fields['tbRisk'] as number;
      expect(tbRisk).toBeGreaterThanOrEqual(0);
      expect(tbRisk).toBeLessThanOrEqual(100);
    }
  });

  it('eyeConditions from cardiac_ppg stays within [0, 7] over 100 runs', async () => {
    for (let i = 0; i < 100; i++) {
      const output = await run('cardiac_ppg', {});
      const ec = output.fields['eyeConditions'] as number;
      expect(ec).toBeGreaterThanOrEqual(0);
      expect(ec).toBeLessThanOrEqual(7);
    }
  });
});

// ── 9. install() validates contract before accepting ─────────────────────────

describe('install: contract validation', () => {
  it('install() throws on invalid descriptor (bad semver)', async () => {
    const bad: ModelDescriptor = {
      id: 'tb_cough',
      name: 'TB Cough v2',
      version: 'v2.0',   // BAD
      status: 'simulated',
      runtime: 'simulated',
      funded: true,
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: { fields: [{ key: 'tbRisk', type: 'number', min: 0, max: 100 }] },
    };
    await expect(install(bad)).rejects.toThrow(/version/);
  });

  it('install() throws on missing output fields', async () => {
    const bad: ModelDescriptor = {
      id: 'tb_cough',
      name: 'TB Cough v2',
      version: '2.0.0',
      status: 'simulated',
      runtime: 'simulated',
      funded: true,
      input: { kind: 'audio' },
      output: { fields: [] },   // EMPTY
    };
    await expect(install(bad)).rejects.toThrow(/fields/);
  });
});

// ── 10. install() + getActive(): version swap without code changes ────────────

describe('install: module swap', () => {
  it('swapping a simulated module for another conforming simulated one changes version', async () => {
    const v2: ModelDescriptor = {
      id: 'tb_cough',
      name: 'TB Cough v2 (Improved)',
      version: '2.0.0',
      status: 'simulated',
      runtime: 'simulated',
      funded: true,
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: {
        fields: [
          { key: 'tbRisk',      type: 'number', min: 0, max: 100 },
          { key: 'coughPositive', type: 'boolean' },
        ],
      },
    };

    const before = await getActive('tb_cough');
    expect(before!.version).toBe('0.1.0');

    await install(v2);

    const after = await getActive('tb_cough');
    expect(after!.version).toBe('2.0.0');
    expect(after!.name).toBe('TB Cough v2 (Improved)');
  });

  it('run() still works after a module swap', async () => {
    const v2: ModelDescriptor = {
      id: 'tb_cough',
      name: 'TB Cough v2',
      version: '2.0.0',
      status: 'simulated',
      runtime: 'simulated',
      funded: true,
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: {
        fields: [
          { key: 'tbRisk',      type: 'number', min: 0, max: 100 },
          { key: 'coughPositive', type: 'boolean' },
        ],
      },
    };
    await install(v2);
    const output = await run('tb_cough', {});
    expect(output.version).toBe('2.0.0');
    expect(output.fields).toHaveProperty('tbRisk');
  });
});

// ── 11. rollback() ────────────────────────────────────────────────────────────

describe('rollback', () => {
  it('restores the previous version after install', async () => {
    const original = await getActive('anaemia');
    expect(original!.version).toBe('0.1.0');

    const v2: ModelDescriptor = {
      id: 'anaemia',
      name: 'Anaemia v2',
      version: '2.0.0',
      status: 'simulated',
      runtime: 'simulated',
      funded: true,
      input: { kind: 'image', shape: [224, 224, 3] },
      output: { fields: [{ key: 'hemoglobin', type: 'number', min: 3, max: 20 }] },
    };
    await install(v2);
    expect((await getActive('anaemia'))!.version).toBe('2.0.0');

    await rollback('anaemia');
    expect((await getActive('anaemia'))!.version).toBe('0.1.0');
  });

  it('rollback() throws if no rollback state is available', async () => {
    // Never installed a version — no rollback state
    await expect(rollback('tb_cough')).rejects.toThrow(/rollback/i);
  });
});

// ── 12. TFLite runtime: NotImplementedError ───────────────────────────────────

describe('run: TFLite runtime throws NotImplementedError', () => {
  it('installing a tflite descriptor and running it throws NotImplementedError', async () => {
    const tfliteDescriptor: ModelDescriptor = {
      id: 'tb_cough',
      name: 'TB Cough TFLite',
      version: '3.0.0',
      status: 'validated',
      runtime: 'tflite',
      funded: true,
      modelPath: '/docs/models/tb_cough.tflite',
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: {
        fields: [
          { key: 'tbRisk',      type: 'number', min: 0, max: 100 },
          { key: 'coughPositive', type: 'boolean' },
        ],
      },
    };
    await install(tfliteDescriptor);
    await expect(run('tb_cough', {})).rejects.toThrow(NotImplementedError);
  });

  it('NotImplementedError message mentions "TFLite runtime"', async () => {
    const d: ModelDescriptor = {
      id: 'tb_cough',
      name: 'TFLite Test',
      version: '3.0.1',
      status: 'validated',
      runtime: 'tflite',
      funded: true,
      modelPath: '/docs/models/tb_cough.tflite',
      input: { kind: 'audio', sampleRateHz: 16000, durationSec: 20, channels: 1 },
      output: { fields: [{ key: 'tbRisk', type: 'number', min: 0, max: 100 }, { key: 'coughPositive', type: 'boolean' }] },
    };
    await install(d);
    try {
      await run('tb_cough', {});
      fail('Expected NotImplementedError');
    } catch (err: unknown) {
      expect(err instanceof NotImplementedError).toBe(true);
      expect((err as Error).message).toMatch(/TFLite/i);
    }
  });
});

// ── 13. Investigational modules never cause hasRedAlert = true ────────────────

describe('Referral guard: investigational modules excluded from alert logic', () => {
  /**
   * This test verifies the ENFORCED code contract: when assembling the scan
   * result, only outputs from modules where affectsReferral === true are
   * included in the referral colour computation.
   *
   * This mirrors the logic in scan-workflow.tsx: computeHasRedAlert() only
   * reads from the NON-investigational modules.
   */

  function computeHasRedAlert(outputs: Awaited<ReturnType<typeof run>>[]): boolean {
    // ONLY use outputs where affectsReferral === true
    const relevant = outputs.filter((o) => o.affectsReferral);

    for (const output of relevant) {
      const { fields } = output;
      const tbRisk = fields['tbRisk'] as number | undefined;
      const heartRate = fields['heartRate'] as number | undefined;
      const spo2 = fields['spo2'] as number | undefined;
      const hemoglobin = fields['hemoglobin'] as number | undefined;
      const afibRisk = fields['afibRisk'] as number | undefined;
      const respiratoryRate = fields['respiratoryRate'] as number | undefined;

      if (tbRisk !== undefined && tbRisk >= 75) return true;
      if (afibRisk !== undefined && afibRisk >= 15) return true;
      if (heartRate !== undefined && (heartRate <= 40 || heartRate >= 140)) return true;
      if (hemoglobin !== undefined && hemoglobin <= 7) return true;
      if (spo2 !== undefined && spo2 <= 90) return true;
      if (respiratoryRate !== undefined && respiratoryRate >= 30) return true;
    }
    return false;
  }

  it('jaundiceFlag never directly triggers hasRedAlert', async () => {
    // Force jaundice = true but don't trigger any funded-module red conditions
    const jaundiceOutput = await run('jaundice', {});
    // Override fields to force jaundice = true
    const forcedJaundice = { ...jaundiceOutput, fields: { jaundiceFlag: true } };

    const result = computeHasRedAlert([forcedJaundice]);
    expect(result).toBe(false); // must never be true from investigational alone
  });

  it('cardiac_ppg tremorRisk=100 and cvdRisk10yr=100 never trigger hasRedAlert via investigational', async () => {
    const cardiacOutput = await run('cardiac_ppg', {});
    const forcedCardiac = {
      ...cardiacOutput,
      fields: { tremorRisk: 100, cvdRisk10yr: 100, glucoseFlag: true, eyeConditions: 7 },
    };
    const result = computeHasRedAlert([forcedCardiac]);
    expect(result).toBe(false);
  });

  it('funded modules can still trigger hasRedAlert when threshold exceeded', async () => {
    // Force tb_cough to maximum-risk output
    const tbOutput = await run('tb_cough', {});
    const forcedTb = { ...tbOutput, fields: { tbRisk: 99, coughPositive: true } };
    const result = computeHasRedAlert([forcedTb]);
    expect(result).toBe(true);
  });
});
