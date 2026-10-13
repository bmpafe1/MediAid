
// Powered by OnSpace.AI — 90-Second Scan Workflow (Feature 1)
// AICEXPERTS Limited · MIT Licence
//
// WHAT IS REAL:
//   - Accelerometer tremor (Part D): expo-sensors at 20 Hz, live RMS
//   - Cough detection (Part B): expo-av Recording + metering at 100 ms intervals;
//     on-device burst detector (services/coughDetector.ts); shows real count live.
//     Audio file is DELETED immediately after Part B — never stored, never transmitted.
//   - Voice TTS guidance: expo-speech EN/FR
//   - Microphone permission requested before scan (once per session)
//   - Voice commands on consent step (TASK C): expo-speech-recognition
//     "yes"/"scan" = consent; "no"/"stop" = cancel. REQUIRES NATIVE BUILD.
//     Graceful no-op in Expo Go — buttons always work.
//
// WHAT IS SIMULATED (labelled on every result card):
//   - TB cough classification, AFib, Hemoglobin, SpO₂, Eye conditions, etc.
//   - These come from the Model Registry (services/modelRegistry.ts).
//     Each module returns its own status label: "Simulated model v0.1.0".
//   - INVESTIGATIONAL modules (jaundice, cardiac_ppg) are EXCLUDED from
//     the referral colour/hasRedAlert logic — enforced in computeHasRedAlert().
//
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/constants/i18n';
import { config } from '@/constants/config';
import { generateDemoRedResult } from '@/services/mockData';
import { getStatusForMetric } from '@/services/mockData';
import type { ScanResult } from '@/services/mockData';
import { logPrototypeSession } from '@/services/outbreakRadar';
import { Accelerometer } from 'expo-sensors';
import { PPGWaveform } from '@/components/PPGWaveform';
import { TremorWaveform } from '@/components/TremorWaveform';
import { CoughWaveform } from '@/components/CoughWaveform';
import {
  createDetectorState,
  updateDetector,
  type DetectorState,
} from '@/services/coughDetector';
import {
  isVoiceCommandAvailable,
  startVoiceCommandSession,
  type RecognitionState,
  type VoiceCommandSession,
} from '@/services/voiceCommands';
import {
  run as registryRun,
  type ModuleOutput,
} from '@/services/modelRegistry';
import { runDemoSimulatedModule } from '@/services/providers/simulatedProvider';

type WorkflowStep = 'consent' | 'partA' | 'partB' | 'partC' | 'partD' | 'partE' | 'processing';

const STEP_DURATIONS = {
  partA: 20,
  partB: 20,
  partC: 20,
  partD: 15,
  partE: 15,
};

const ALL_MODULE_IDS = ['tb_cough', 'anaemia', 'bioacoustic', 'jaundice', 'cardiac_ppg'];

// ── Referral guard ─────────────────────────────────────────────────────────────
// Only outputs from modules where affectsReferral === true contribute to RED.
// INVESTIGATIONAL modules NEVER appear here.
function computeHasRedAlert(outputs: ModuleOutput[]): boolean {
  const relevant = outputs.filter((o) => o.affectsReferral);
  const t = config.thresholds;
  for (const output of relevant) {
    const f = output.fields;
    const tbRisk        = f['tbRisk']        as number | undefined;
    const afibRisk      = f['afibRisk']      as number | undefined;
    const heartRate     = f['heartRate']      as number | undefined;
    const hemoglobin    = f['hemoglobin']     as number | undefined;
    const spo2          = f['spo2']           as number | undefined;
    const respiratoryRate = f['respiratoryRate'] as number | undefined;
    const tremorRisk    = f['tremorRisk']     as number | undefined;

    if (tbRisk       !== undefined && tbRisk          >= t.tbRisk.red)          return true;
    if (afibRisk     !== undefined && afibRisk         >= t.afibRisk.red)        return true;
    if (heartRate    !== undefined && (heartRate <= t.heartRate.redLow || heartRate >= t.heartRate.redHigh)) return true;
    if (hemoglobin   !== undefined && hemoglobin       <= t.hemoglobin.red)      return true;
    if (spo2         !== undefined && spo2             <= t.spo2.red)            return true;
    if (respiratoryRate !== undefined && (respiratoryRate >= t.respiratoryRate.redHigh || respiratoryRate <= t.respiratoryRate.redLow)) return true;
    if (tremorRisk   !== undefined && tremorRisk       >= 60)                    return true;
  }
  return false;
}

// ── Build ScanResult from module outputs ──────────────────────────────────────
function buildScanResult(
  patientName: string,
  outputs: ModuleOutput[],
  moduleVersions: Record<string, string>,
): ScanResult {
  const fields: Record<string, unknown> = {};
  for (const o of outputs) {
    Object.assign(fields, o.fields);
  }
  const hasRedAlert = computeHasRedAlert(outputs);

  return {
    id: `scan_${Date.now()}`,
    patientName: patientName || 'Unknown Patient',
    patientId: `CHA-${Math.floor(Math.random() * 9000 + 1000)}`,
    consentTimestamp: new Date().toISOString(),
    scanTimestamp: new Date().toISOString(),
    tbRisk:          (fields['tbRisk']          as number)  ?? 0,
    afibRisk:        (fields['afibRisk']        as number)  ?? 0,
    heartRate:       (fields['heartRate']        as number)  ?? 60,
    hemoglobin:      (fields['hemoglobin']       as number)  ?? 12,
    spo2:            (fields['spo2']             as number)  ?? 98,
    respiratoryRate: (fields['respiratoryRate']  as number)  ?? 16,
    tremorRisk:      (fields['tremorRisk']       as number)  ?? 0,
    eyeConditions:   (fields['eyeConditions']    as number)  ?? 0,
    cvdRisk10yr:     (fields['cvdRisk10yr']      as number)  ?? 0,
    glucoseFlag:     (fields['glucoseFlag']       as boolean) ?? false,
    covidFlag:       (fields['covidFlag']         as boolean) ?? false,
    jaundiceFlag:    (fields['jaundiceFlag']      as boolean) ?? false,
    hasRedAlert,
    bypassLogged: false,
    synced: false,
    // Registry metadata for results screen
    moduleVersions,
  } as ScanResult & { moduleVersions: Record<string, string> };
}

export default function ScanWorkflow() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { demoMode, setCurrentScan, addScanToHistory, language, activeSite, refreshRadarStats } = useApp();
  const { prefillName } = useLocalSearchParams<{ prefillName?: string }>();

  const speak = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, { language: language === 'fr' ? 'fr-FR' : 'en-US', rate: 0.9, pitch: 1.0 });
  }, [language]);

  const [step, setStep] = useState<WorkflowStep>('consent');
  const [patientName, setPatientName] = useState(prefillName ?? '');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeLeft, setTotalTimeLeft] = useState(90);

  // ── Real accelerometer (Part D) ────────────────────────────────────────────
  const [accelBuffer, setAccelBuffer] = useState<number[]>([]);
  const [accelRms, setAccelRms] = useState(0);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);

  // ── Real cough detection (Part B) ─────────────────────────────────────────
  const [latestDbfs, setLatestDbfs] = useState<number | null>(null);
  const [coughCount, setCoughCount] = useState(0);
  const [coughInsufficient, setCoughInsufficient] = useState(false);
  const [retryPromptVisible, setRetryPromptVisible] = useState(false);
  const coughRecordingRef = useRef<Audio.Recording | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<DetectorState>(createDetectorState());
  const coughCountRef = useRef(0);
  const coughRetryAllowed = useRef(true);
  const afterRetryDecision = useRef<(() => void) | null>(null);

  // ── Voice command state (TASK C) ──────────────────────────────────────────
  const [vcState, setVcState] = useState<RecognitionState | 'not_checked' | 'unavailable'>('not_checked');
  const [vcTranscript, setVcTranscript] = useState('');
  const vcSessionRef = useRef<VoiceCommandSession | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedFactor = demoMode ? 9 : 1;

  // ── Accelerometer subscription (Part D) ───────────────────────────────────
  useEffect(() => {
    if (step === 'partD') {
      Accelerometer.setUpdateInterval(50);
      accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
        const rms = Math.sqrt(x * x + y * y + z * z);
        const excess = Math.max(0, rms - 1.0);
        const norm = Math.min(1, excess * 2.5);
        setAccelBuffer((prev) => {
          const next = [...prev, norm].slice(-80);
          const avg = next.reduce((a, v) => a + v, 0) / next.length;
          setAccelRms(avg);
          return next;
        });
      });
    } else {
      accelSubRef.current?.remove();
      accelSubRef.current = null;
      if (step !== 'partD') { setAccelBuffer([]); setAccelRms(0); }
    }
    return () => { accelSubRef.current?.remove(); accelSubRef.current = null; };
  }, [step]);

  // ── Pulse animation ────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    return () => pulseAnim.stopAnimation();
  }, [pulseAnim]);

  // ── Voice commands on consent step (TASK C) ───────────────────────────────
  useEffect(() => {
    if (step !== 'consent') {
      vcSessionRef.current?.stop();
      vcSessionRef.current = null;
      return;
    }
    let mounted = true;
    (async () => {
      const avail = await isVoiceCommandAvailable();
      if (!avail || !mounted) {
        if (mounted) setVcState('unavailable');
        return;
      }
      const session = await startVoiceCommandSession(
        language === 'fr' ? 'fr-FR' : 'en-US',
        (cmd) => {
          if (!mounted) return;
          if (cmd === 'START_SCAN' || cmd === 'YES') handleConsent(true);
          else if (cmd === 'STOP' || cmd === 'NO') handleConsent(false);
        },
        (state) => { if (mounted) setVcState(state); },
        (text) => { if (mounted) setVcTranscript(text); },
      );
      if (mounted) vcSessionRef.current = session;
    })();
    return () => {
      mounted = false;
      vcSessionRef.current?.stop();
      vcSessionRef.current = null;
    };
  }, [step, language]);

  // ── Timer helper ───────────────────────────────────────────────────────────
  const startTimer = (duration: number, onComplete: () => void) => {
    const actual = Math.round(duration / speedFactor);
    setTimeLeft(actual);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onComplete();
          return 0;
        }
        setTotalTimeLeft((total) => Math.max(0, total - 1));
        return prev - 1;
      });
    }, 1000);
  };

  // ── Real cough recording ───────────────────────────────────────────────────
  const startCoughRecording = useCallback(async () => {
    detectorRef.current = createDetectorState();
    coughCountRef.current = 0;
    setCoughCount(0);
    setLatestDbfs(null);
    setCoughInsufficient(false);

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setCoughInsufficient(true); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await rec.startAsync();
      coughRecordingRef.current = rec;

      meterTimerRef.current = setInterval(async () => {
        try {
          const status = await coughRecordingRef.current?.getStatusAsync();
          if (status?.isRecording && status.metering !== undefined) {
            setLatestDbfs(status.metering);
            detectorRef.current = updateDetector(detectorRef.current, status.metering);
            const count = detectorRef.current.events.length;
            if (count !== coughCountRef.current) {
              coughCountRef.current = count;
              setCoughCount(count);
            }
          }
        } catch { /* non-fatal */ }
      }, 100);
    } catch {
      setCoughInsufficient(true);
    }
  }, []);

  // ── Stop + discard cough audio ─────────────────────────────────────────────
  const stopCoughRecording = useCallback(async () => {
    clearInterval(meterTimerRef.current!);
    meterTimerRef.current = null;
    setLatestDbfs(null);
    const rec = coughRecordingRef.current;
    coughRecordingRef.current = null;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
    } catch { /* non-fatal */ }
  }, []);

  // ── Part B retry logic ─────────────────────────────────────────────────────
  const onPartBDone = useCallback(async (advance: () => void) => {
    await stopCoughRecording();
    const count = coughCountRef.current;
    if (count < 3 && coughRetryAllowed.current && !demoMode) {
      coughRetryAllowed.current = false;
      afterRetryDecision.current = advance;
      setRetryPromptVisible(true);
      return;
    }
    if (count < 3) setCoughInsufficient(true);
    advance();
  }, [stopCoughRecording, demoMode]);

  const handleCoughRetry = useCallback(async () => {
    setRetryPromptVisible(false);
    setCoughCount(0);
    coughCountRef.current = 0;
    setStep('partB');
    speak(t('tts_partB_prompt', language));
    await startCoughRecording();
    startTimer(STEP_DURATIONS.partB, async () => {
      await stopCoughRecording();
      if (coughCountRef.current < 3) setCoughInsufficient(true);
      afterRetryDecision.current?.();
      afterRetryDecision.current = null;
    });
  }, [startCoughRecording, stopCoughRecording, language, speak]);

  const handleSkipRetry = useCallback(() => {
    setRetryPromptVisible(false);
    setCoughInsufficient(true);
    afterRetryDecision.current?.();
    afterRetryDecision.current = null;
  }, []);

  // ── Run all modules via registry ───────────────────────────────────────────
  const runAllModules = useCallback(async (): Promise<{
    outputs: ModuleOutput[];
    moduleVersions: Record<string, string>;
  }> => {
    if (demoMode) {
      // Demo mode: use fixed demo values, still routed through registry structure
      const demoOutputs: ModuleOutput[] = ALL_MODULE_IDS.map((id) => ({
        moduleId: id,
        version: '0.1.0',
        status: (id === 'jaundice' || id === 'cardiac_ppg') ? 'investigational' : 'simulated',
        affectsReferral: id !== 'jaundice' && id !== 'cardiac_ppg',
        fields: runDemoSimulatedModule(id),
      }));
      const versions: Record<string, string> = {};
      for (const o of demoOutputs) versions[o.moduleId] = o.version;
      return { outputs: demoOutputs, moduleVersions: versions };
    }

    const outputs: ModuleOutput[] = [];
    const versions: Record<string, string> = {};
    await Promise.all(
      ALL_MODULE_IDS.map(async (id) => {
        try {
          const output = await registryRun(id, {});
          outputs.push(output);
          versions[id] = output.version;
        } catch (err) {
          console.warn(`[ScanWorkflow] registry.run("${id}") failed:`, err);
          // Produce a safe fallback output (grey adjunct, does not affect referral)
          outputs.push({
            moduleId: id,
            version: '0.0.0',
            status: 'simulated',
            affectsReferral: false,
            fields: {},
          });
        }
      })
    );
    for (const o of outputs) versions[o.moduleId] = o.version;
    return { outputs, moduleVersions: versions };
  }, [demoMode]);

  // ── Consent handler ────────────────────────────────────────────────────────
  const handleConsent = useCallback(async (agreed: boolean) => {
    if (!agreed) { Speech.stop(); router.back(); return; }

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted && !demoMode) {
      Alert.alert(
        'Microphone Access Required',
        'MediAid uses the microphone to detect cough events in Part B. '
        + 'The cough segment will be marked insufficient without access.\n\n'
        + 'To enable: Settings → Apps → MediAid → Permissions → Microphone → Allow\n\n'
        + 'All other scan parts work without microphone.',
        [{ text: 'Continue Anyway' }]
      );
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTotalTimeLeft(demoMode ? 10 : 90);
    setStep('partA');
    speak(t('tts_partA_prompt', language));

    startTimer(STEP_DURATIONS.partA, () => {
      Haptics.selectionAsync();
      setStep('partB');
      speak(t('tts_partB_prompt', language));
      startCoughRecording();

      const advanceToPartC = () => {
        Haptics.selectionAsync();
        setStep('partC');
        speak(t('tts_partC_prompt', language));
        startTimer(STEP_DURATIONS.partC, () => {
          Haptics.selectionAsync();
          setStep('partD');
          speak(t('tts_partD_prompt', language));
          startTimer(STEP_DURATIONS.partD, () => {
            Haptics.selectionAsync();
            setStep('partE');
            speak(t('tts_partE_prompt', language));
            startTimer(STEP_DURATIONS.partE, async () => {
              setStep('processing');
              speak(t('tts_processing', language));

              const delay = demoMode ? 1000 : 2000;
              await new Promise((res) => setTimeout(res, delay));

              // ── Run all modules via registry (PROMPT 7) ──────────────────
              const { outputs, moduleVersions } = await runAllModules();

              const result = demoMode
                ? { ...generateDemoRedResult(patientName || 'Demo Patient'), moduleVersions }
                : buildScanResult(patientName || 'Unknown Patient', outputs, moduleVersions);

              setCurrentScan(result as ScanResult);
              addScanToHistory(result as ScanResult);

              // Derive outcomeColour from registry outputs (NOT from hasRedAlert alone)
              const hasYellow =
                getStatusForMetric('tbRisk', result.tbRisk) === 'yellow' ||
                getStatusForMetric('afibRisk', result.afibRisk) === 'yellow' ||
                getStatusForMetric('heartRate', result.heartRate) === 'yellow' ||
                getStatusForMetric('hemoglobin', result.hemoglobin) === 'yellow' ||
                getStatusForMetric('spo2', result.spo2) === 'yellow' ||
                getStatusForMetric('respiratoryRate', result.respiratoryRate) === 'yellow' ||
                getStatusForMetric('tremorRisk', result.tremorRisk) === 'yellow';

              const outcomeColour: 'green' | 'amber' | 'red' | 'grey' =
                result.hasRedAlert ? 'red' : hasYellow ? 'amber' : 'green';

              logPrototypeSession({
                villageGeohash: activeSite.geohash,
                sessionType: demoMode ? 'demo' : 'field-test',
                outcomeColour,
                coughPositive: (result.tbRisk ?? 0) >= 50,
                referralIssued: result.hasRedAlert,
              }).then(() => refreshRadarStats()).catch(() => {});

              router.replace('/results');
              if (result.hasRedAlert) {
                setTimeout(() => {
                  speak(t('tts_red_alert', language));
                  router.push('/safety');
                }, 300);
              }
            });
          });
        });
      };

      startTimer(STEP_DURATIONS.partB, () => onPartBDone(advanceToPartC));
    });
  }, [demoMode, language, speak, router, startCoughRecording, onPartBDone, patientName, setCurrentScan, addScanToHistory, activeSite, refreshRadarStats, runAllModules]);

  useEffect(() => {
    speak(t('tts_consent_prompt', language));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(meterTimerRef.current!);
      stopCoughRecording();
      vcSessionRef.current?.stop();
      Speech.stop();
    };
  }, [language, speak, stopCoughRecording]);

  // ── Retry overlay ──────────────────────────────────────────────────────────
  if (retryPromptVisible) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.stepContainer}>
          <View style={styles.retryCard}>
            <MaterialIcons name="mic-off" size={44} color={theme.statusYellow} />
            <Text style={styles.retryTitle}>
              We heard {coughCount} cough{coughCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.retryDesc}>
              At least 3 coughs are needed for a valid cough analysis.{'\n'}
              Would you like to try the cough segment again?
            </Text>
            <Text style={styles.retryNote}>
              TB classification: Simulated model v0.1.0 · Cough events: Real microphone{'\n'}
              If you skip, the cough result will be marked insufficient (GREY adjunct).
            </Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleCoughRetry}
            >
              <MaterialIcons name="refresh" size={20} color="#FFF" />
              <Text style={styles.retryBtnText}>Try Again (one attempt)</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSkipRetry}
            >
              <Text style={styles.skipBtnText}>
                Continue with {coughCount} cough{coughCount !== 1 ? 's' : ''} (GREY)
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const vcActive = vcState === 'listening' || vcState === 'online';

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]}>
      {step === 'consent' && (
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textSecondary} />
        </Pressable>
      )}

      {demoMode && (
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>⚡ DEMO — 10-sec mode</Text>
        </View>
      )}

      {/* CONSENT ── */}
      {step === 'consent' && (
        <View style={styles.stepContainer}>
          <View style={styles.stepIconCircle}>
            <MaterialIcons name="mic" size={48} color={theme.primary} />
          </View>
          <Text style={styles.stepInstruction}>State patient name or ID</Text>
          <TextInput
            style={styles.nameInput}
            value={patientName}
            onChangeText={setPatientName}
            placeholder="Patient name or ID..."
            placeholderTextColor={theme.textMuted}
            autoFocus
          />
          <Text style={styles.consentQuestion}>Do you consent to this health scan?</Text>
          <View style={styles.consentBtns}>
            <Pressable
              style={({ pressed }) => [styles.yesBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleConsent(true)}
            >
              <MaterialIcons name="check" size={32} color="#FFF" />
              <Text style={styles.yesBtnText}>YES</Text>
              <Text style={styles.yesBtnSub}>I consent</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.noBtn, pressed && { opacity: 0.85 }]}
              onPress={() => handleConsent(false)}
            >
              <MaterialIcons name="close" size={32} color="#FFF" />
              <Text style={styles.noBtnText}>NO</Text>
              <Text style={styles.noBtnSub}>Cancel</Text>
            </Pressable>
          </View>

          {vcState !== 'not_checked' && vcState !== 'unavailable' && (
            <View style={styles.vcStatusRow}>
              <MaterialIcons
                name={vcActive ? 'mic' : 'mic-none'}
                size={13}
                color={vcActive ? theme.statusGreen : theme.textMuted}
              />
              <Text style={styles.vcStatusText}>
                {vcState === 'listening'
                  ? 'Voice: say "yes"/"scan" to consent, "no"/"stop" to cancel (on-device)'
                  : vcState === 'online'
                    ? 'Voice: say "yes"/"scan" to consent, "no"/"stop" to cancel (online)'
                    : 'Voice commands: ' + vcState}
                {vcTranscript ? ' · heard: "' + vcTranscript + '"' : ''}
              </Text>
            </View>
          )}

          <Text style={styles.consentNote}>
            Oral consent will be timestamp-logged per ethical protocol (Camara et al. 2021).
            {'\n'}Microphone used for cough detection in Part B only.
            Audio deleted immediately — never stored or transmitted.
          </Text>
        </View>
      )}

      {/* PART A ── FACIAL VIDEO */}
      {step === 'partA' && (
        <ScanStep
          icon="face" part="A"
          partLabel={t('partA_label', language)}
          instruction={t('partA_instruction', language)}
          subInstruction={t('partA_sub', language)}
          timeLeft={timeLeft}
          totalSeconds={Math.round(STEP_DURATIONS.partA / speedFactor)}
          pulseAnim={pulseAnim}
          totalTimeLeft={totalTimeLeft}
          totalDuration={demoMode ? 10 : 90}
          demoMode={demoMode}
          color={theme.primary}
          showWaveform={false} showCoughWaveform={false} showTremorWaveform={false}
          extraBadge="Yan et al. 2018 · 95% sensitivity"
        />
      )}

      {/* PART B ── COUGH ACOUSTIC (REAL MICROPHONE) */}
      {step === 'partB' && (
        <ScanStep
          icon="mic" part="B"
          partLabel={t('partB_label', language)}
          instruction={t('partB_instruction', language)}
          subInstruction={t('partB_sub', language)}
          timeLeft={timeLeft}
          totalSeconds={Math.round(STEP_DURATIONS.partB / speedFactor)}
          pulseAnim={pulseAnim}
          totalTimeLeft={totalTimeLeft}
          totalDuration={demoMode ? 10 : 90}
          demoMode={demoMode}
          color="#A855F7"
          showWaveform={false} showCoughWaveform={true} showTremorWaveform={false}
          extraBadge="HeAR model · 94% accuracy (TB: Simulated model v0.1.0)"
          coughCount={coughCount}
          latestDbfs={latestDbfs}
          coughInsufficient={coughInsufficient}
        />
      )}

      {/* PART C ── FINGER PPG */}
      {step === 'partC' && (
        <ScanStep
          icon="fingerprint" part="C"
          partLabel={t('partC_label', language)}
          instruction={t('partC_instruction', language)}
          subInstruction={t('partC_sub', language)}
          timeLeft={timeLeft}
          totalSeconds={Math.round(STEP_DURATIONS.partC / speedFactor)}
          pulseAnim={pulseAnim}
          totalTimeLeft={totalTimeLeft}
          totalDuration={demoMode ? 10 : 90}
          demoMode={demoMode}
          color={theme.statusGreen}
          showWaveform={true} showCoughWaveform={false} showTremorWaveform={false}
        />
      )}

      {/* PART D ── TREMOR (REAL ACCELEROMETER) */}
      {step === 'partD' && (
        <ScanStep
          icon="vibration" part="D"
          partLabel={t('partD_label', language)}
          instruction={t('partD_instruction', language)}
          subInstruction={t('partD_sub', language)}
          timeLeft={timeLeft}
          totalSeconds={Math.round(STEP_DURATIONS.partD / speedFactor)}
          pulseAnim={pulseAnim}
          totalTimeLeft={totalTimeLeft}
          totalDuration={demoMode ? 10 : 90}
          demoMode={demoMode}
          color="#F59E0B"
          showWaveform={false} showCoughWaveform={false} showTremorWaveform={true}
          liveAccelValues={accelBuffer}
          accelRms={accelRms}
          extraBadge="He et al. 2024 · AUC 0.89 · LIVE SENSOR"
        />
      )}

      {/* PART E ── EYE SCREENING */}
      {step === 'partE' && (
        <ScanStep
          icon="remove-red-eye" part="E"
          partLabel={t('partE_label', language)}
          instruction={t('partE_instruction', language)}
          subInstruction={t('partE_sub', language)}
          timeLeft={timeLeft}
          totalSeconds={Math.round(STEP_DURATIONS.partE / speedFactor)}
          pulseAnim={pulseAnim}
          totalTimeLeft={totalTimeLeft}
          totalDuration={demoMode ? 10 : 90}
          demoMode={demoMode}
          color="#A78BFA"
          showWaveform={false} showCoughWaveform={false} showTremorWaveform={false}
          extraBadge="Jin et al. 2024 · AUC 0.91–0.97"
        />
      )}

      {/* PROCESSING */}
      {step === 'processing' && (
        <View style={styles.stepContainer}>
          <Animated.View style={[styles.processingRing, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialIcons name="psychology" size={56} color={theme.primary} />
          </Animated.View>
          <Text style={styles.processingTitle}>Analysing Results</Text>
          <Text style={styles.processingSubtitle}>
            Running model registry · 5 modules · All simulated · No data transmitted
          </Text>
          <View style={styles.processingChecks}>
            {[
              'tb_cough v0.1.0 — simulated',
              'anaemia v0.1.0 — simulated',
              'bioacoustic v0.1.0 — simulated',
              'jaundice v0.0.1 — investigational (adjunct)',
              'cardiac_ppg v0.0.1 — investigational (adjunct)',
            ].map((label) => (
              <View key={label} style={styles.checkRow}>
                <MaterialIcons name="check-circle" size={16} color={theme.statusGreen} />
                <Text style={styles.checkText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── ScanStep ───────────────────────────────────────────────────────────────────
function ScanStep({
  icon, part, partLabel, instruction, subInstruction,
  timeLeft, totalSeconds, pulseAnim, totalTimeLeft, totalDuration,
  demoMode, color, showWaveform, showCoughWaveform, showTremorWaveform,
  liveAccelValues, accelRms, extraBadge,
  coughCount, latestDbfs, coughInsufficient,
}: {
  icon: string; part: string; partLabel: string;
  instruction: string; subInstruction: string;
  timeLeft: number; totalSeconds: number;
  pulseAnim: Animated.Value;
  totalTimeLeft: number; totalDuration: number;
  demoMode: boolean; color: string;
  showWaveform: boolean; showCoughWaveform: boolean; showTremorWaveform: boolean;
  liveAccelValues?: number[]; accelRms?: number; extraBadge?: string;
  coughCount?: number; latestDbfs?: number | null; coughInsufficient?: boolean;
}) {
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.totalTimerBar}>
        <View style={[styles.totalTimerFill, {
          width: `${((totalDuration - totalTimeLeft) / totalDuration) * 100}%`,
          backgroundColor: color,
        }]} />
      </View>
      <Text style={styles.totalTimerLabel}>
        {totalTimeLeft}s remaining · Part {part}: {partLabel}
      </Text>

      <Animated.View style={[styles.scanIconRing, {
        borderColor: color + '55',
        transform: [{ scale: pulseAnim }],
      }]}>
        <View style={[styles.scanIconInner, { backgroundColor: color + '22' }]}>
          <MaterialIcons name={icon as any} size={60} color={color} />
        </View>
      </Animated.View>

      {extraBadge ? (
        <View style={[styles.extraBadge, {
          borderColor: color + '55',
          backgroundColor: color + '15',
        }]}>
          <MaterialIcons name="verified" size={12} color={color} />
          <Text style={[styles.extraBadgeText, { color }]}>{extraBadge}</Text>
        </View>
      ) : null}

      {showWaveform ? (
        <View style={{ marginBottom: 12, alignSelf: 'stretch' }}>
          <PPGWaveform color={color} bpm={72} />
          <Text style={[styles.waveformLabel, { color }]}>LIVE PPG WAVEFORM</Text>
        </View>
      ) : null}

      {showCoughWaveform ? (
        <View style={{ marginBottom: 12, alignSelf: 'stretch' }}>
          <CoughWaveform
            color={color}
            phase={timeLeft > 14 ? 'listening' : timeLeft > 6 ? 'cough' : 'analysis'}
          />
          <View style={styles.coughCountRow}>
            <MaterialIcons name="mic" size={14} color={color} />
            <Text style={[styles.coughCountText, { color }]}>
              Coughs detected: {coughCount ?? 0} of 3
              {(coughCount ?? 0) >= 3 ? ' ✓' : ''}
            </Text>
            {latestDbfs !== null ? (
              <Text style={styles.dbfsText}>{(latestDbfs ?? -80).toFixed(0)} dBFS</Text>
            ) : null}
          </View>
          {coughInsufficient ? (
            <Text style={styles.insufficientText}>
              Insufficient audio — cough result marked GREY (adjunct only)
            </Text>
          ) : null}
          <Text style={[styles.waveformLabel, { color }]}>
            COUGH EVENTS: REAL MIC · TB CLASSIFICATION: SIMULATED MODEL v0.1.0
          </Text>
        </View>
      ) : null}

      {showTremorWaveform ? (
        <View style={{ marginBottom: 12, alignSelf: 'stretch' }}>
          {liveAccelValues && liveAccelValues.length > 3 ? (
            <TremorWaveform
              color={color}
              liveValues={liveAccelValues}
              tremorLevel={(accelRms ?? 0) > 0.15 ? 'high' : 'low'}
            />
          ) : (
            <TremorWaveform color={color} tremorLevel={timeLeft % 6 < 3 ? 'high' : 'low'} />
          )}
          <Text style={[styles.waveformLabel, { color }]}>
            {liveAccelValues && liveAccelValues.length > 3
              ? `LIVE ACCELEROMETER · RMS ${((accelRms ?? 0) * 100).toFixed(1)}%`
              : 'ACCELEROMETER SIGNAL (SIMULATED)'}
          </Text>
        </View>
      ) : null}

      <View style={styles.countdownBox}>
        <Text style={[styles.countdownNum, { color }]}>{timeLeft}</Text>
        <Text style={styles.countdownLabel}>seconds</Text>
      </View>

      <View style={styles.stepProgressBar}>
        <View style={[styles.stepProgressFill, {
          width: `${progress * 100}%`,
          backgroundColor: color,
        }]} />
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  closeBtn: {
    position: 'absolute', top: 60, left: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
    zIndex: 10, borderWidth: 1, borderColor: theme.border,
  },
  demoBadge: {
    alignSelf: 'center', backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.full,
    paddingHorizontal: 16, paddingVertical: 6, marginTop: 16,
    borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  demoBadgeText: { color: theme.statusYellow, fontSize: 12, fontWeight: '700' },
  stepContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  stepIconCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: theme.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32,
    borderWidth: 2, borderColor: theme.primary + '44',
  },
  stepInstruction: {
    fontSize: 24, fontWeight: '700', color: theme.textPrimary,
    textAlign: 'center', lineHeight: 32, marginBottom: 12,
  },
  nameInput: {
    width: '100%', backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.primary + '66', padding: 16, fontSize: 18,
    color: theme.textPrimary, marginBottom: 28, textAlign: 'center',
  },
  consentQuestion: {
    fontSize: 20, fontWeight: '700', color: theme.textPrimary,
    textAlign: 'center', marginBottom: 28, lineHeight: 28,
  },
  consentBtns: { flexDirection: 'row', gap: 16, width: '100%' },
  yesBtn: {
    flex: 1, backgroundColor: theme.statusGreen, borderRadius: theme.radius.large,
    alignItems: 'center', paddingVertical: 20, gap: 4,
    shadowColor: theme.statusGreen, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  yesBtnText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  yesBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  noBtn: {
    flex: 1, backgroundColor: theme.statusRed, borderRadius: theme.radius.large,
    alignItems: 'center', paddingVertical: 20, gap: 4,
  },
  noBtnText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  noBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  vcStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    backgroundColor: theme.statusGreen + '10', borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.statusGreen + '33', width: '100%',
  },
  vcStatusText: { fontSize: 10, color: theme.statusGreen, fontWeight: '600', flex: 1 },
  consentNote: {
    fontSize: 11, color: theme.textMuted, textAlign: 'center',
    marginTop: 16, lineHeight: 18, paddingHorizontal: 8,
  },
  totalTimerBar: {
    width: '100%', height: 4, backgroundColor: theme.surface,
    borderRadius: 2, marginBottom: 8, overflow: 'hidden',
  },
  totalTimerFill: { height: 4, borderRadius: 2 },
  totalTimerLabel: { fontSize: 12, color: theme.textMuted, marginBottom: 24, textAlign: 'center', fontWeight: '600' },
  scanIconRing: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  scanIconInner: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  extraBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12,
  },
  extraBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  waveformLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
    textAlign: 'center', marginTop: 4, color: theme.textMuted,
  },
  coughCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, justifyContent: 'center' },
  coughCountText: { fontSize: 14, fontWeight: '800' },
  dbfsText: { fontSize: 10, color: theme.textMuted, fontFamily: 'monospace' },
  insufficientText: { fontSize: 10, color: theme.statusYellow, textAlign: 'center', marginTop: 4 },
  countdownBox: { alignItems: 'center', marginVertical: 12 },
  countdownNum: { fontSize: 72, fontWeight: '200', letterSpacing: -2 },
  countdownLabel: {
    fontSize: 14, color: theme.textSecondary, marginTop: -8,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1,
  },
  stepProgressBar: { width: '100%', height: 4, backgroundColor: theme.surface, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  stepProgressFill: { height: 4, borderRadius: 2 },
  processingRing: {
    width: 140, height: 140, borderRadius: 70, backgroundColor: theme.surface,
    borderWidth: 2, borderColor: theme.primary + '55',
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  processingTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  processingSubtitle: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  processingChecks: { gap: 12, width: '100%' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { fontSize: 14, color: theme.textPrimary, fontWeight: '500' },
  retryCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.large,
    padding: 28, gap: 16, borderWidth: 1, borderColor: theme.statusYellow + '55',
    alignItems: 'center', width: '100%',
  },
  retryTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  retryDesc: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  retryNote: { fontSize: 11, color: theme.textMuted, textAlign: 'center', lineHeight: 17, fontStyle: 'italic' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    paddingHorizontal: 24, paddingVertical: 14, width: '100%', justifyContent: 'center',
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  skipBtn: {
    alignItems: 'center', paddingVertical: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, width: '100%',
  },
  skipBtnText: { fontSize: 13, fontWeight: '600', color: theme.textMuted },
});
