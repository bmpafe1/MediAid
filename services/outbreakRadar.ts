// services/outbreakRadar.ts
// Logs prototype session data to Supabase outbreak_radar table.
// Called at the end of every completed 90-second scan.

import { getSharedSupabaseClient } from '../template/core/client';

export type SimulatedResult = 'GREEN' | 'AMBER' | 'RED';
export type SessionType = 'co-design' | 'demo' | 'training' | 'field-test';

export interface PrototypeSession {
  villageName: string;      // 'Baligham' | 'Bagam' | 'Lab/Demo'
  villageGeohash: string;   // 's0yg' Baligham | 's0yf' Bagam | 's000' Lab
  simulatedResult: SimulatedResult;
  coughFlag: boolean;       // Did the scan show a cough positive result?
  sessionType: SessionType;
}

export async function logPrototypeSession(params: PrototypeSession): Promise<void> {
  const client = getSharedSupabaseClient();

  const coughRate = params.coughFlag ? 0.4 : 0;

  const alertLevel =
    params.simulatedResult === 'RED'   ? 'ELEVATED' :
    coughRate > 0.35                   ? 'ELEVATED' : 'NORMAL';

  const { error } = await client
    .from('outbreak_radar')
    .insert({
      village_name:    params.villageName,
      village_geohash: params.villageGeohash,
      total_scans:     1,
      green_count:     params.simulatedResult === 'GREEN' ? 1 : 0,
      amber_count:     params.simulatedResult === 'AMBER' ? 1 : 0,
      red_count:       params.simulatedResult === 'RED'   ? 1 : 0,
      cough_positive:  params.coughFlag ? 1 : 0,
      fever_flag:      0,
      referral_count:  params.simulatedResult !== 'GREEN' ? 1 : 0,
      alert_level:     alertLevel,
    });

  if (error) {
    // Fail silently — prototype session logging must never block the CHA workflow
    console.warn('[MediAid] Outbreak radar sync failed:', error.message);
  }
}
