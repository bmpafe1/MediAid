// MediAid — Biometric Patient Identity (v10)
// Voice print + facial geometry hash matching for longitudinal patient tracking
// No biometric image stored — anonymised hash only. Matching is GREY adjunct flag only.
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const STORAGE_KEY = 'mediaid_biometric_registry_v1';

interface BiometricRecord {
  id: string;
  patientRef: string;
  registeredAt: string;
  voiceHash: string;        // anonymised SHA-256-style hash
  facialHash: string;       // anonymised SHA-256-style hash
  matchCount: number;       // how many times matched on return visits
  lastMatchAt?: string;
  lastMatchConfidence?: number;
  language: string;
}

// Deterministic hash-like display string (not real cryptographic hash)
function generateMockHash(seed: string, type: 'voice' | 'face'): string {
  const chars = '0123456789abcdef';
  let result = type === 'voice' ? 'V-' : 'F-';
  for (let i = 0; i < 16; i++) {
    result += chars[(seed.charCodeAt(i % seed.length) + i * 7) % 16];
  }
  return result.toUpperCase();
}

// Mock registry data
const MOCK_REGISTRY: BiometricRecord[] = [
  {
    id: 'bio_001',
    patientRef: 'CHA-4471',
    registeredAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    voiceHash: 'V-A3F7C1D92B8E4051',
    facialHash: 'F-9B2E6A047C3D18F5',
    matchCount: 2,
    lastMatchAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    lastMatchConfidence: 91,
    language: 'Fulfulde',
  },
  {
    id: 'bio_002',
    patientRef: 'CHA-7834',
    registeredAt: new Date(Date.now() - 21 * 86400000).toISOString(),
    voiceHash: 'V-E8C2A5B1403F97D6',
    facialHash: 'F-1D7F0B3E9C5A2841',
    matchCount: 4,
    lastMatchAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    lastMatchConfidence: 87,
    language: 'Cameroonian French',
  },
  {
    id: 'bio_003',
    patientRef: 'CHA-2219',
    registeredAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    voiceHash: 'V-62D9F8A3710C4BE5',
    facialHash: 'F-0A4E7C2B8D3F1695',
    matchCount: 1,
    lastMatchAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    lastMatchConfidence: 94,
    language: 'English',
  },
  {
    id: 'bio_004',
    patientRef: 'CHA-9103',
    registeredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    voiceHash: 'V-B5180F6E3C92A47D',
    facialHash: 'F-7E3B0C9A1D8F2546',
    matchCount: 0,
    language: 'Fulfulde',
  },
];

// ─── Animated Ring ─────────────────────────────────────────────────────────────
function RecordingRing({ active, progress }: { active: boolean; progress: Animated.Value }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [active]);

  return (
    <View style={ringStyles.container}>
      <Animated.View style={[ringStyles.outer, { transform: [{ scale: pulse }] }]}>
        <View style={ringStyles.inner}>
          <MaterialIcons
            name={active ? 'mic' : 'mic-none'}
            size={40}
            color={active ? theme.statusRed : theme.primary}
          />
        </View>
      </Animated.View>
      {active && (
        <View style={ringStyles.track}>
          <Animated.View
            style={[ringStyles.fill, {
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]}
          />
        </View>
      )}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  outer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: theme.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.primary + '55',
  },
  inner: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
  },
  track: {
    width: 200, height: 6, backgroundColor: theme.border,
    borderRadius: 3, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.statusRed, borderRadius: 3 },
});

// ─── Hash Display ──────────────────────────────────────────────────────────────
function HashChip({ label, hash, color }: { label: string; hash: string; color: string }) {
  return (
    <View style={hashStyles.chip}>
      <View style={[hashStyles.iconCircle, { backgroundColor: color + '18' }]}>
        <MaterialIcons name="fingerprint" size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={hashStyles.label}>{label}</Text>
        <Text style={hashStyles.hash}>{hash}</Text>
      </View>
      <View style={[hashStyles.lockBadge, { backgroundColor: color + '18', borderColor: color + '44' }]}>
        <MaterialIcons name="lock" size={10} color={color} />
        <Text style={[hashStyles.lockText, { color }]}>No raw data</Text>
      </View>
    </View>
  );
}

const hashStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, borderWidth: 1, borderColor: theme.border,
  },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  hash: { fontSize: 12, fontFamily: 'monospace', color: theme.textPrimary, fontWeight: '600', marginTop: 2 },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
  },
  lockText: { fontSize: 9, fontWeight: '700' },
});

// ─── Match Confidence Widget ───────────────────────────────────────────────────
function MatchConfidence({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / 100, duration: 900,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [value]);
  const color = value >= 85 ? theme.statusGreen : value >= 70 ? theme.statusYellow : theme.statusRed;
  return (
    <View style={confStyles.container}>
      <View style={confStyles.row}>
        <Text style={[confStyles.num, { color }]}>{value}%</Text>
        <View style={confStyles.greyTag}>
          <MaterialIcons name="info" size={10} color={theme.textMuted} />
          <Text style={confStyles.greyTagText}>GREY — Adjunct only</Text>
        </View>
      </View>
      <View style={confStyles.track}>
        <Animated.View style={[confStyles.fill, {
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
        }]} />
      </View>
      <Text style={confStyles.note}>
        Match confidence is displayed as an adjunct grey flag only. CHA confirms manually. No clinical action taken on match alone.
      </Text>
    </View>
  );
}

const confStyles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { fontSize: 28, fontWeight: '800' },
  greyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.border, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  greyTagText: { fontSize: 9, fontWeight: '700', color: theme.textMuted },
  track: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  note: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
});

// ─── Registry Card ─────────────────────────────────────────────────────────────
function RegistryCard({ record }: { record: BiometricRecord }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      style={regStyles.card}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={regStyles.header}>
        <View style={regStyles.avatar}>
          <MaterialIcons name="person" size={22} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={regStyles.patientRef}>{record.patientRef}</Text>
          <Text style={regStyles.sub}>
            {record.language} · Registered {new Date(record.registeredAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={[regStyles.matchBadge, { backgroundColor: record.matchCount > 0 ? theme.statusGreen + '18' : theme.border }]}>
          <Text style={[regStyles.matchCount, { color: record.matchCount > 0 ? theme.statusGreen : theme.textMuted }]}>
            {record.matchCount} match{record.matchCount !== 1 ? 'es' : ''}
          </Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
      </View>

      {expanded && (
        <View style={regStyles.expanded}>
          <View style={{ gap: 8 }}>
            <HashChip label="Voice Hash" hash={record.voiceHash} color="#22D3EE" />
            <HashChip label="Facial Hash" hash={record.facialHash} color="#818CF8" />
          </View>
          {record.lastMatchAt && record.lastMatchConfidence ? (
            <View style={regStyles.lastMatch}>
              <Text style={regStyles.lastMatchLabel}>LAST MATCH</Text>
              <Text style={regStyles.lastMatchDate}>{new Date(record.lastMatchAt).toLocaleString()}</Text>
              <MatchConfidence value={record.lastMatchConfidence} />
            </View>
          ) : (
            <Text style={regStyles.noMatch}>No return visits yet</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const regStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, marginBottom: 10, overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  patientRef: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  sub: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  matchBadge: { borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  matchCount: { fontSize: 11, fontWeight: '700' },
  expanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  lastMatch: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 12, gap: 6, borderWidth: 1, borderColor: theme.border,
  },
  lastMatchLabel: { fontSize: 9, fontWeight: '800', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  lastMatchDate: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
  noMatch: { fontSize: 12, color: theme.textMuted, textAlign: 'center', paddingVertical: 8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BiometricIdentityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [recording, setRecording] = useState(false);
  const [recordingStep, setRecordingStep] = useState<'idle' | 'voice' | 'facial' | 'done'>('idle');
  const [voiceHash, setVoiceHash] = useState<string | null>(null);
  const [facialHash, setFacialHash] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<{ confidence: number; patientRef: string } | null>(null);
  const [registry, setRegistry] = useState<BiometricRecord[]>(MOCK_REGISTRY);
  const progress = useRef(new Animated.Value(0)).current;

  const startVoiceCapture = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecordingStep('voice');
    setRecording(true);
    setVoiceHash(null);
    setFacialHash(null);
    setMatchResult(null);
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration: 5000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setRecording(false);
        const hash = generateMockHash(`voice_${Date.now()}`, 'voice');
        setVoiceHash(hash);
        setRecordingStep('facial');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Auto-proceed to facial after short delay
        setTimeout(() => {
          startFacialCapture(hash);
        }, 800);
      }
    });
  };

  const startFacialCapture = (vHash: string) => {
    setRecordingStep('facial');
    const fHash = generateMockHash(`facial_${Date.now()}`, 'face');

    setTimeout(() => {
      setFacialHash(fHash);
      setRecordingStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Simulate matching against registry
      const confidence = Math.round(Math.random() * 20 + 75); // 75–95
      const matchesExisting = Math.random() > 0.45; // ~55% chance of match

      if (matchesExisting) {
        const matched = registry[Math.floor(Math.random() * registry.length)];
        setMatchResult({ confidence, patientRef: matched.patientRef });
      } else {
        setMatchResult(null);
      }
    }, 2000);
  };

  const handleRegister = () => {
    if (!voiceHash || !facialHash) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newRec: BiometricRecord = {
      id: `bio_${Date.now()}`,
      patientRef: `CHA-${Math.floor(Math.random() * 9000 + 1000)}`,
      registeredAt: new Date().toISOString(),
      voiceHash,
      facialHash,
      matchCount: 0,
      language: 'English',
    };
    setRegistry((prev) => [newRec, ...prev]);
    setRecordingStep('idle');
    setVoiceHash(null);
    setFacialHash(null);
    setMatchResult(null);
    Alert.alert('Registered', `New biometric identity registered: ${newRec.patientRef}\n\nNo raw audio or image stored — anonymised hash only.`);
  };

  const reset = () => {
    setRecordingStep('idle');
    setRecording(false);
    setVoiceHash(null);
    setFacialHash(null);
    setMatchResult(null);
    progress.setValue(0);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Biometric Patient Identity</Text>
          <Text style={styles.navSub}>MediAid v10 · Longitudinal matching</Text>
        </View>
        <View style={styles.v10Badge}>
          <Text style={styles.v10BadgeText}>NEW v10</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Privacy notice */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyIconRow}>
            <MaterialIcons name="lock" size={18} color={theme.statusGreen} />
            <Text style={styles.privacyTitle}>Privacy-First Design</Text>
          </View>
          <View style={styles.privacyPoints}>
            {[
              'No raw audio or video ever stored on device',
              'Anonymised hash only — cannot be reverse-engineered',
              'Hash never transmitted during sync',
              'Patient can delete all biometric data from Settings',
              'GREY adjunct flag only — CHA confirms manually',
            ].map((p) => (
              <View key={p} style={styles.privacyPoint}>
                <MaterialIcons name="check" size={12} color={theme.statusGreen} />
                <Text style={styles.privacyPointText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Capture section */}
        <Text style={styles.sectionTitle}>BIOMETRIC CAPTURE</Text>
        <View style={styles.captureCard}>
          {recordingStep === 'idle' && (
            <>
              <Text style={styles.captureInstruct}>
                Ask patient to say their name in their own language (5 seconds). Then the front camera captures a brief facial geometry hash during the PPG segment.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
                onPress={startVoiceCapture}
              >
                <MaterialIcons name="mic" size={22} color="#FFF" />
                <Text style={styles.startBtnText}>Begin Biometric Capture</Text>
              </Pressable>
            </>
          )}

          {(recordingStep === 'voice' || recordingStep === 'facial') && (
            <View style={styles.captureActive}>
              <RecordingRing active={recordingStep === 'voice'} progress={progress} />
              <View style={styles.stepIndicators}>
                {[
                  { step: 'voice', label: 'Voice Print', icon: 'mic', done: !!voiceHash },
                  { step: 'facial', label: 'Facial Hash', icon: 'face', done: !!facialHash },
                ].map((s) => (
                  <View key={s.step} style={[styles.stepIndicator, {
                    borderColor: recordingStep === s.step ? theme.primary : s.done ? theme.statusGreen : theme.border,
                    backgroundColor: s.done ? theme.statusGreen + '18' : recordingStep === s.step ? theme.primary + '18' : theme.surface,
                  }]}>
                    <MaterialIcons
                      name={s.done ? 'check-circle' : s.icon as any}
                      size={16}
                      color={s.done ? theme.statusGreen : recordingStep === s.step ? theme.primary : theme.textMuted}
                    />
                    <Text style={[styles.stepLabel, {
                      color: s.done ? theme.statusGreen : recordingStep === s.step ? theme.primary : theme.textMuted,
                    }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.captureStatus}>
                {recordingStep === 'voice' ? 'Capturing voice print — 5 seconds...' : 'Capturing facial geometry hash...'}
              </Text>
              <Pressable style={styles.cancelBtn} onPress={reset}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {recordingStep === 'done' && voiceHash && facialHash && (
            <View style={styles.captureResult}>
              <View style={styles.captureResultHeader}>
                <MaterialIcons name="check-circle" size={28} color={theme.statusGreen} />
                <Text style={styles.captureResultTitle}>Biometric hashes generated</Text>
              </View>

              <View style={{ gap: 8 }}>
                <HashChip label="Voice Hash" hash={voiceHash} color="#22D3EE" />
                <HashChip label="Facial Hash" hash={facialHash} color="#818CF8" />
              </View>

              {/* Match result */}
              {matchResult ? (
                <View style={styles.matchFound}>
                  <View style={styles.matchFoundHeader}>
                    <MaterialIcons name="person-search" size={20} color={theme.statusGreen} />
                    <Text style={styles.matchFoundTitle}>Returning Patient Match</Text>
                    <View style={styles.greyTag}>
                      <MaterialIcons name="info" size={10} color={theme.textMuted} />
                      <Text style={styles.greyTagText}>GREY</Text>
                    </View>
                  </View>
                  <Text style={styles.matchFoundRef}>Matched to: {matchResult.patientRef}</Text>
                  <Text style={styles.matchFoundNote}>CHA must confirm manually — match is adjunct information only</Text>
                  <MatchConfidence value={matchResult.confidence} />
                </View>
              ) : (
                <View style={styles.noMatchBox}>
                  <MaterialIcons name="person-add" size={20} color={theme.primary} />
                  <Text style={styles.noMatchText}>No existing match found — new patient</Text>
                </View>
              )}

              <View style={styles.resultActions}>
                <Pressable
                  style={({ pressed }) => [styles.registerBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleRegister}
                >
                  <MaterialIcons name="how-to-reg" size={18} color="#FFF" />
                  <Text style={styles.registerBtnText}>Register Biometric Identity</Text>
                </Pressable>
                <Pressable style={styles.retryBtn} onPress={reset}>
                  <MaterialIcons name="refresh" size={16} color={theme.textSecondary} />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Why it matters */}
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>Why Biometric Identity Matters</Text>
          <Text style={styles.whyDesc}>
            In communities where many people lack formal identification, tracking the same patient across visits is one of the most significant barriers to building longitudinal health records and to outcomes-based financing.
          </Text>
          <View style={styles.whyPoints}>
            {[
              { icon: 'timeline', text: 'Longitudinal records: screen TB positive → ECG confirmed → treated → outcome documented', color: theme.primary },
              { icon: 'monetization-on', text: 'Outcomes evidence for Phase 3 development impact bonds and outcomes-based financing', color: '#10B981' },
              { icon: 'people', text: 'Community data sovereignty: hash stored on local device only, never in sync transmission', color: '#A78BFA' },
            ].map((p) => (
              <View key={p.text} style={styles.whyPoint}>
                <MaterialIcons name={p.icon as any} size={14} color={p.color} />
                <Text style={styles.whyPointText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Phase 1 pilot scope */}
        <View style={styles.pilotCard}>
          <View style={styles.pilotHeader}>
            <MaterialIcons name="flag" size={16} color={theme.statusYellow} />
            <Text style={styles.pilotTitle}>Phase 1 Pilot Scope</Text>
          </View>
          <Text style={styles.pilotDesc}>
            Voice-print + facial hash patient matching piloted in one village (n≥100 patients) to assess feasibility, CHA acceptance, and matching accuracy. Results published as standalone feasibility study.
          </Text>
          <View style={styles.pilotMetrics}>
            {[
              { label: 'Target patients', value: '100+', color: theme.primary },
              { label: 'Villages', value: '1 pilot', color: theme.statusGreen },
              { label: 'Languages', value: '3', color: '#A78BFA' },
            ].map((m) => (
              <View key={m.label} style={[styles.pilotMetric, { borderColor: m.color + '44' }]}>
                <Text style={[styles.pilotMetricVal, { color: m.color }]}>{m.value}</Text>
                <Text style={styles.pilotMetricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Registry */}
        <Text style={styles.sectionTitle}>PATIENT HASH REGISTRY — {registry.length} REGISTERED</Text>
        {registry.map((r) => <RegistryCard key={r.id} record={r} />)}

        <Text style={styles.footer}>
          MediAid v10 · Biometric Identity · No raw biometric data stored · Hash-only registry
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  v10Badge: {
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: theme.primary + '44',
  },
  v10BadgeText: { fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 0.5 },
  privacyCard: {
    backgroundColor: theme.statusGreen + '08', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16, marginBottom: 14,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  privacyIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  privacyTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  privacyPoints: { gap: 7 },
  privacyPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privacyPointText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  captureCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 14,
  },
  captureInstruct: { fontSize: 14, color: theme.textSecondary, lineHeight: 21, marginBottom: 16, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium, padding: 16,
    shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  startBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  captureActive: { alignItems: 'center', gap: 16 },
  stepIndicators: { flexDirection: 'row', gap: 10 },
  stepIndicator: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: theme.radius.medium, padding: 10, borderWidth: 1,
  },
  stepLabel: { fontSize: 11, fontWeight: '700' },
  captureStatus: { fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  cancelBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  captureResult: { gap: 12 },
  captureResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  captureResultTitle: { fontSize: 15, fontWeight: '700', color: theme.statusGreen },
  matchFound: {
    backgroundColor: theme.statusGreen + '08', borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.statusGreen + '44', gap: 8,
  },
  matchFoundHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchFoundTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.statusGreen },
  greyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.border, borderRadius: theme.radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  greyTagText: { fontSize: 9, fontWeight: '700', color: theme.textMuted },
  matchFoundRef: { fontSize: 13, color: theme.textPrimary, fontWeight: '700' },
  matchFoundNote: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  noMatchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.primary + '08', borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.primary + '33',
  },
  noMatchText: { flex: 1, fontSize: 13, color: theme.primary, fontWeight: '600' },
  resultActions: { gap: 8 },
  registerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.statusGreen, borderRadius: theme.radius.medium, padding: 14,
  },
  registerBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium, padding: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  whyCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: theme.border,
  },
  whyTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
  whyDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },
  whyPoints: { gap: 10 },
  whyPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  whyPointText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  pilotCard: {
    backgroundColor: theme.statusYellow + '08', borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  pilotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pilotTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  pilotDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },
  pilotMetrics: { flexDirection: 'row', gap: 8 },
  pilotMetric: {
    flex: 1, borderRadius: theme.radius.medium, padding: 10, alignItems: 'center',
    backgroundColor: theme.surface, borderWidth: 1, gap: 3,
  },
  pilotMetricVal: { fontSize: 18, fontWeight: '800' },
  pilotMetricLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
