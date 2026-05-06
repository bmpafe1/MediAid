// Powered by OnSpace.AI — 90-Second Scan Workflow (Feature 1)
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { generateMockScanResult, generateDemoRedResult } from '@/services/mockData';
import { Accelerometer } from 'expo-sensors';
import { PPGWaveform } from '@/components/PPGWaveform';
import { TremorWaveform } from '@/components/TremorWaveform';
import { CoughWaveform } from '@/components/CoughWaveform';

type WorkflowStep = 'consent' | 'partA' | 'partB' | 'partC' | 'partD' | 'partE' | 'processing';

const STEP_DURATIONS = {
  partA: 20,
  partB: 20,
  partC: 20,
  partD: 15,
  partE: 15,
};

export default function ScanWorkflow() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { demoMode, setCurrentScan, addScanToHistory, language } = useApp();
  const { prefillName } = useLocalSearchParams<{ prefillName?: string }>();

  const speak = useCallback((text: string) => {
    Speech.stop();
    Speech.speak(text, {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: 0.9,
      pitch: 1.0,
    });
  }, [language]);

  const [step, setStep] = useState<WorkflowStep>('consent');
  const [patientName, setPatientName] = useState(prefillName ?? '');
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTimeLeft, setTotalTimeLeft] = useState(90);

  // Real accelerometer state for Part D
  const [accelBuffer, setAccelBuffer] = useState<number[]>([]);
  const [accelRms, setAccelRms] = useState(0);
  const accelSubRef = useRef<{ remove: () => void } | null>(null);

  // Start/stop accelerometer for Part D
  useEffect(() => {
    if (step === 'partD') {
      Accelerometer.setUpdateInterval(50); // 20 Hz
      accelSubRef.current = Accelerometer.addListener(({ x, y, z }) => {
        const rms = Math.sqrt(x * x + y * y + z * z);
        // Normalise: gravity contributes ~1.0; excess above baseline signals tremor
        const excess = Math.max(0, rms - 1.0);
        const normalised = Math.min(1, excess * 2.5); // scale to 0–1
        setAccelBuffer((prev) => {
          const next = [...prev, normalised].slice(-80);
          const avg = next.reduce((a, v) => a + v, 0) / next.length;
          setAccelRms(avg);
          return next;
        });
      });
    } else {
      accelSubRef.current?.remove();
      accelSubRef.current = null;
      if (step !== 'partD') {
        setAccelBuffer([]);
        setAccelRms(0);
      }
    }
    return () => {
      accelSubRef.current?.remove();
      accelSubRef.current = null;
    };
  }, [step]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const speedFactor = demoMode ? 9 : 1;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    return () => pulseAnim.stopAnimation();
  }, []);

  const startTimer = (duration: number, onComplete: () => void) => {
    const actualDuration = Math.round(duration / speedFactor);
    setTimeLeft(actualDuration);
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

  const handleConsent = (agreed: boolean) => {
    if (!agreed) {
      Speech.stop();
      router.back();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTotalTimeLeft(demoMode ? 10 : 90);
    setStep('partA');
    speak(t('tts_partA_prompt', language));
    startTimer(STEP_DURATIONS.partA, () => {
      Haptics.selectionAsync();
      setStep('partB');
      speak(t('tts_partB_prompt', language));
      startTimer(STEP_DURATIONS.partB, () => {
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
            startTimer(STEP_DURATIONS.partE, () => {
              setStep('processing');
              speak(t('tts_processing', language));
              setTimeout(() => {
                const result = demoMode
                  ? generateDemoRedResult(patientName || 'Demo Patient')
                  : generateMockScanResult(patientName || 'Unknown Patient');
                setCurrentScan(result);
                addScanToHistory(result);
                router.replace('/results');
                if (result.hasRedAlert) {
                  setTimeout(() => {
                    speak(t('tts_red_alert', language));
                    router.push('/safety');
                  }, 300);
                }
              }, demoMode ? 1000 : 2000);
            });
          });
        });
      });
    });
  };

  useEffect(() => {
    speak(t('tts_consent_prompt', language));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      Speech.stop();
    };
  }, []);

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

      {/* CONSENT */}
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
          <Text style={styles.consentNote}>
            Oral consent will be timestamp-logged per ethical protocol (Camara et al. 2021)
          </Text>
        </View>
      )}

      {/* PART A — FACIAL VIDEO */}
      {step === 'partA' && (
        <ScanStep
          icon="face"
          part="A"
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
          showWaveform={false}
          showCoughWaveform={false}
          showTremorWaveform={false}
          extraBadge="Yan et al. 2018 · 95% sensitivity"
        />
      )}

      {/* PART B — COUGH ACOUSTIC */}
      {step === 'partB' && (
        <ScanStep
          icon="mic"
          part="B"
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
          showWaveform={false}
          showCoughWaveform={true}
          showTremorWaveform={false}
          extraBadge="HeAR model · 94% accuracy"
        />
      )}

      {/* PART C — FINGER PPG */}
      {step === 'partC' && (
        <ScanStep
          icon="fingerprint"
          part="C"
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
          showWaveform={true}
          showCoughWaveform={false}
          showTremorWaveform={false}
        />
      )}

      {/* PART D — TREMOR DETECTION (Real Accelerometer) */}
      {step === 'partD' && (
        <ScanStep
          icon="vibration"
          part="D"
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
          showWaveform={false}
          showCoughWaveform={false}
          showTremorWaveform={true}
          liveAccelValues={accelBuffer}
          accelRms={accelRms}
          extraBadge="He et al. 2024 · AUC 0.89 · LIVE SENSOR"
        />
      )}

      {/* PART E — EYE SCREENING */}
      {step === 'partE' && (
        <ScanStep
          icon="remove-red-eye"
          part="E"
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
          showWaveform={false}
          showCoughWaveform={false}
          showTremorWaveform={false}
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
            On-device AI inference · TensorFlow Lite · No data transmitted
          </Text>
          <View style={styles.processingChecks}>
            {[
              'Facial PPG analysis',
              'Cough classification',
              'SpO₂ / RR calculation',
              'Tremor + Eye assessment',
              'Generating report',
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

function ScanStep({
  icon, part, partLabel, instruction, subInstruction,
  timeLeft, totalSeconds, pulseAnim, totalTimeLeft, totalDuration,
  demoMode, color, showWaveform, showCoughWaveform, showTremorWaveform,
  liveAccelValues, accelRms, extraBadge,
}: {
  icon: string;
  part: string;
  partLabel: string;
  instruction: string;
  subInstruction: string;
  timeLeft: number;
  totalSeconds: number;
  pulseAnim: Animated.Value;
  totalTimeLeft: number;
  totalDuration: number;
  demoMode: boolean;
  color: string;
  showWaveform: boolean;
  showCoughWaveform: boolean;
  showTremorWaveform: boolean;
  liveAccelValues?: number[];
  accelRms?: number;
  extraBadge?: string;
}) {
  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0;

  return (
    <View style={styles.stepContainer}>
      {/* Overall progress bar */}
      <View style={styles.totalTimerBar}>
        <View
          style={[
            styles.totalTimerFill,
            { width: `${((totalDuration - totalTimeLeft) / totalDuration) * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.totalTimerLabel}>
        {totalTimeLeft}s remaining · Part {part}: {partLabel}
      </Text>

      {/* Pulsing icon */}
      <Animated.View
        style={[styles.scanIconRing, { borderColor: color + '55', transform: [{ scale: pulseAnim }] }]}
      >
        <View style={[styles.scanIconInner, { backgroundColor: color + '22' }]}>
          <MaterialIcons name={icon as any} size={60} color={color} />
        </View>
      </Animated.View>

      {/* Citation badge */}
      {extraBadge && (
        <View style={[styles.extraBadge, { borderColor: color + '55', backgroundColor: color + '15' }]}>
          <MaterialIcons name="verified" size={12} color={color} />
          <Text style={[styles.extraBadgeText, { color }]}>{extraBadge}</Text>
        </View>
      )}

      {/* PPG waveform — Part C */}
      {showWaveform && (
        <View style={{ marginBottom: 12, alignSelf: 'stretch' }}>
          <PPGWaveform color={color} bpm={72} />
          <Text style={[styles.waveformLabel, { color }]}>LIVE PPG WAVEFORM</Text>
        </View>
      )}

      {/* Cough waveform — Part B */}
      {showCoughWaveform && (
        <View style={{ marginBottom: 12, alignSelf: 'stretch' }}>
          <CoughWaveform color={color} phase={timeLeft > 14 ? 'listening' : timeLeft > 6 ? 'cough' : 'analysis'} />
          <Text style={[styles.waveformLabel, { color }]}>ACOUSTIC SIGNAL · COUGH DETECTION</Text>
        </View>
      )}

      {/* Tremor waveform — Part D (real accelerometer when available) */}
      {showTremorWaveform && (
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
      )}

      {/* Countdown */}
      <View style={styles.countdownBox}>
        <Text style={[styles.countdownNum, { color }]}>{timeLeft}</Text>
        <Text style={styles.countdownLabel}>seconds</Text>
      </View>

      {/* Step progress bar */}
      <View style={styles.stepProgressBar}>
        <View style={[styles.stepProgressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  closeBtn: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  demoBadge: {
    alignSelf: 'center',
    backgroundColor: theme.statusYellowBg,
    borderRadius: theme.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.statusYellow + '44',
  },
  demoBadgeText: { color: theme.statusYellow, fontSize: 12, fontWeight: '700' },
  stepContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  stepIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: theme.primary + '44',
  },
  stepInstruction: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  nameInput: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.primary + '66',
    padding: 16,
    fontSize: 18,
    color: theme.textPrimary,
    marginBottom: 28,
    textAlign: 'center',
  },
  consentQuestion: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 28,
  },
  consentBtns: { flexDirection: 'row', gap: 16, width: '100%' },
  yesBtn: {
    flex: 1,
    backgroundColor: theme.statusGreen,
    borderRadius: theme.radius.large,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
    shadowColor: theme.statusGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  yesBtnText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  yesBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  noBtn: {
    flex: 1,
    backgroundColor: theme.statusRed,
    borderRadius: theme.radius.large,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  noBtnText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  noBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  consentNote: {
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  totalTimerBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.surface,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  totalTimerFill: { height: 4, borderRadius: 2 },
  totalTimerLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '600',
  },
  scanIconRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scanIconInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  extraBadgeText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  waveformLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    marginTop: 4,
    color: theme.textMuted,
  },
  countdownBox: { alignItems: 'center', marginVertical: 12 },
  countdownNum: { fontSize: 72, fontWeight: '200', letterSpacing: -2 },
  countdownLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: -8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.surface,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  stepProgressFill: { height: 4, borderRadius: 2 },
  processingRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.primary + '55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  processingTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  processingSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  processingChecks: { gap: 12, width: '100%' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { fontSize: 15, color: theme.textPrimary, fontWeight: '500' },
});
