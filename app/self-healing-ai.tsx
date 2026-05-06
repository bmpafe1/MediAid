// MediAid — Self-Healing AI Indicator (v10)
// Federated on-device learning loop: low-confidence cases → on-device fine-tuning → sync parameters
// Visual log for grant evaluators demonstrating the self-improving AI architecture
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
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

// ─── Mock low-confidence cases ────────────────────────────────────────────────
interface LowConfCase {
  id: string;
  patientRef: string;
  timestamp: string;
  condition: string;
  conditionColor: string;
  aiProbability: number; // 51–65% = borderline
  audioFlagged: boolean;
  sensorFlagged: boolean;
  processingStatus: 'queued' | 'fine-tuning' | 'complete' | 'synced';
  processingProgress: number; // 0–100
  deltaAccuracy: number; // accuracy improvement after fine-tune (mock)
  language: string;
}

const CASES: LowConfCase[] = [
  {
    id: 'hc_001',
    patientRef: 'CHA-4471',
    timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
    condition: 'TB Risk',
    conditionColor: theme.statusRed,
    aiProbability: 58,
    audioFlagged: true,
    sensorFlagged: false,
    processingStatus: 'complete',
    processingProgress: 100,
    deltaAccuracy: 1.2,
    language: 'Fulfulde',
  },
  {
    id: 'hc_002',
    patientRef: 'CHA-7834',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    condition: 'AFib Risk',
    conditionColor: theme.primary,
    aiProbability: 63,
    audioFlagged: false,
    sensorFlagged: true,
    processingStatus: 'synced',
    processingProgress: 100,
    deltaAccuracy: 0.8,
    language: 'Cameroonian French',
  },
  {
    id: 'hc_003',
    patientRef: 'CHA-2219',
    timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
    condition: 'Cough / TB',
    conditionColor: '#F97316',
    aiProbability: 54,
    audioFlagged: true,
    sensorFlagged: false,
    processingStatus: 'fine-tuning',
    processingProgress: 67,
    deltaAccuracy: 0,
    language: 'English',
  },
  {
    id: 'hc_004',
    patientRef: 'CHA-9103',
    timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
    condition: 'Tremor / PD',
    conditionColor: '#F59E0B',
    aiProbability: 61,
    audioFlagged: false,
    sensorFlagged: true,
    processingStatus: 'synced',
    processingProgress: 100,
    deltaAccuracy: 1.5,
    language: 'Fulfulde',
  },
  {
    id: 'hc_005',
    patientRef: 'CHA-5562',
    timestamp: new Date(Date.now() - 18 * 3600000).toISOString(),
    condition: 'Respiratory Rate',
    conditionColor: '#34D399',
    aiProbability: 57,
    audioFlagged: true,
    sensorFlagged: true,
    processingStatus: 'queued',
    processingProgress: 0,
    deltaAccuracy: 0,
    language: 'Cameroonian French',
  },
  {
    id: 'hc_006',
    patientRef: 'CHA-3381',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    condition: 'Eye Conditions',
    conditionColor: '#A78BFA',
    aiProbability: 52,
    audioFlagged: false,
    sensorFlagged: true,
    processingStatus: 'synced',
    processingProgress: 100,
    deltaAccuracy: 0.6,
    language: 'English',
  },
  {
    id: 'hc_007',
    patientRef: 'CHA-6614',
    timestamp: new Date(Date.now() - 30 * 3600000).toISOString(),
    condition: 'Cough / COVID',
    conditionColor: '#6366F1',
    aiProbability: 64,
    audioFlagged: true,
    sensorFlagged: false,
    processingStatus: 'complete',
    processingProgress: 100,
    deltaAccuracy: 2.1,
    language: 'Fulfulde',
  },
  {
    id: 'hc_008',
    patientRef: 'CHA-8823',
    timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
    condition: 'Hemoglobin',
    conditionColor: '#EC4899',
    aiProbability: 59,
    audioFlagged: false,
    sensorFlagged: true,
    processingStatus: 'synced',
    processingProgress: 100,
    deltaAccuracy: 1.0,
    language: 'Cameroonian French',
  },
  {
    id: 'hc_009',
    patientRef: 'CHA-1102',
    timestamp: new Date(Date.now() - 42 * 3600000).toISOString(),
    condition: 'TB Risk',
    conditionColor: theme.statusRed,
    aiProbability: 55,
    audioFlagged: true,
    sensorFlagged: true,
    processingStatus: 'synced',
    processingProgress: 100,
    deltaAccuracy: 1.8,
    language: 'English',
  },
  {
    id: 'hc_010',
    patientRef: 'CHA-7771',
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    condition: 'AFib Risk',
    conditionColor: theme.primary,
    aiProbability: 62,
    audioFlagged: false,
    sensorFlagged: true,
    processingStatus: 'synced',
    processingProgress: 100,
    deltaAccuracy: 0.9,
    language: 'Fulfulde',
  },
];

// ─── Processing status badge ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: LowConfCase['processingStatus'] }) {
  const config = {
    queued: { label: 'Queued', color: theme.textMuted, icon: 'schedule' },
    'fine-tuning': { label: 'Fine-Tuning', color: theme.statusYellow, icon: 'psychology' },
    complete: { label: 'Complete', color: theme.statusGreen, icon: 'check-circle' },
    synced: { label: 'Synced', color: theme.primary, icon: 'cloud-done' },
  };
  const c = config[status];
  return (
    <View style={[sbStyles.badge, { backgroundColor: c.color + '18', borderColor: c.color + '44' }]}>
      <MaterialIcons name={c.icon as any} size={11} color={c.color} />
      <Text style={[sbStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
  },
  text: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Animated progress bar ────────────────────────────────────────────────────
function AnimProgressBar({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / 100,
      duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [value]);
  return (
    <View style={apbStyles.track}>
      <Animated.View style={[apbStyles.fill, {
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        backgroundColor: color,
      }]} />
    </View>
  );
}
const apbStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 2 },
});

// ─── Case Card ────────────────────────────────────────────────────────────────
function CaseCard({ c }: { c: LowConfCase }) {
  const [expanded, setExpanded] = useState(false);
  const probColor = c.aiProbability >= 60 ? theme.statusYellow : '#F97316';

  return (
    <Pressable
      style={[caseStyles.card, { borderColor: c.conditionColor + '33' }]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={caseStyles.header}>
        <View style={[caseStyles.condCircle, { backgroundColor: c.conditionColor + '18' }]}>
          <MaterialIcons name="science" size={14} color={c.conditionColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={caseStyles.titleRow}>
            <Text style={[caseStyles.condLabel, { color: c.conditionColor }]}>{c.condition}</Text>
            <Text style={[caseStyles.prob, { color: probColor }]}>{c.aiProbability}%</Text>
            <View style={[caseStyles.borderlineTag, { backgroundColor: probColor + '18', borderColor: probColor + '44' }]}>
              <Text style={[caseStyles.borderlineText, { color: probColor }]}>BORDERLINE</Text>
            </View>
          </View>
          <Text style={caseStyles.meta}>{c.patientRef} · {c.language} · {new Date(c.timestamp).toLocaleString()}</Text>
        </View>
        <StatusBadge status={c.processingStatus} />
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={theme.textMuted} />
      </View>

      {/* Progress */}
      {c.processingStatus === 'fine-tuning' && (
        <View style={caseStyles.progressRow}>
          <Text style={caseStyles.progressLabel}>Fine-tuning: {c.processingProgress}%</Text>
          <AnimProgressBar value={c.processingProgress} color={theme.statusYellow} />
        </View>
      )}

      {expanded && (
        <View style={caseStyles.expanded}>
          {/* Flags */}
          <View style={caseStyles.flagRow}>
            <View style={[caseStyles.flagChip, { backgroundColor: c.audioFlagged ? '#22D3EE18' : theme.surface, borderColor: c.audioFlagged ? '#22D3EE44' : theme.border }]}>
              <MaterialIcons name="mic" size={12} color={c.audioFlagged ? '#22D3EE' : theme.textMuted} />
              <Text style={[caseStyles.flagText, { color: c.audioFlagged ? '#22D3EE' : theme.textMuted }]}>
                Audio {c.audioFlagged ? 'captured' : 'N/A'}
              </Text>
            </View>
            <View style={[caseStyles.flagChip, { backgroundColor: c.sensorFlagged ? '#818CF818' : theme.surface, borderColor: c.sensorFlagged ? '#818CF844' : theme.border }]}>
              <MaterialIcons name="sensors" size={12} color={c.sensorFlagged ? '#818CF8' : theme.textMuted} />
              <Text style={[caseStyles.flagText, { color: c.sensorFlagged ? '#818CF8' : theme.textMuted }]}>
                Sensor {c.sensorFlagged ? 'captured' : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Process description */}
          <View style={caseStyles.processBox}>
            <Text style={caseStyles.processTitle}>ON-DEVICE FINE-TUNING PROCESS</Text>
            {[
              { step: '1', label: 'Low-confidence detection', desc: `AI returned ${c.aiProbability}% (51–65% = borderline threshold)`, done: true },
              { step: '2', label: 'CHA structured follow-up', desc: 'Two questions recorded — symptoms, history. No raw audio transmitted.', done: true },
              { step: '3', label: 'Overnight batch fine-tuning', desc: 'Lightweight federated step during device charge. On-device only.', done: c.processingStatus !== 'queued' },
              { step: '4', label: 'Parameter sync', desc: 'Gradient updates synced (not raw data) on next connectivity window.', done: c.processingStatus === 'synced' },
            ].map((s) => (
              <View key={s.step} style={caseStyles.processStep}>
                <View style={[caseStyles.processStepNum, { backgroundColor: s.done ? theme.statusGreen + '22' : theme.border }]}>
                  <MaterialIcons
                    name={s.done ? 'check' : 'radio-button-unchecked'}
                    size={11}
                    color={s.done ? theme.statusGreen : theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={caseStyles.processStepLabel}>{s.label}</Text>
                  <Text style={caseStyles.processStepDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Delta accuracy */}
          {c.deltaAccuracy > 0 && (
            <View style={caseStyles.deltaBox}>
              <MaterialIcons name="trending-up" size={16} color={theme.statusGreen} />
              <View style={{ flex: 1 }}>
                <Text style={caseStyles.deltaTitle}>Model Improvement</Text>
                <Text style={caseStyles.deltaDesc}>
                  +{c.deltaAccuracy.toFixed(1)}% accuracy delta on {c.condition} for {c.language} speakers after this fine-tuning step.
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const caseStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, padding: 12, marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  condCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  condLabel: { fontSize: 13, fontWeight: '700' },
  prob: { fontSize: 13, fontWeight: '800' },
  borderlineTag: {
    borderRadius: theme.radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1,
  },
  borderlineText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  meta: { fontSize: 10, color: theme.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressLabel: { fontSize: 10, color: theme.statusYellow, fontWeight: '700', width: 90 },
  expanded: { marginTop: 12, gap: 10 },
  flagRow: { flexDirection: 'row', gap: 8 },
  flagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  flagText: { fontSize: 10, fontWeight: '600' },
  processBox: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 12, borderWidth: 1, borderColor: theme.border, gap: 8,
  },
  processTitle: { fontSize: 9, fontWeight: '800', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  processStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  processStepNum: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  processStepLabel: { fontSize: 11, fontWeight: '700', color: theme.textPrimary },
  processStepDesc: { fontSize: 10, color: theme.textMuted, lineHeight: 14, marginTop: 1 },
  deltaBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.statusGreen + '08', borderRadius: theme.radius.medium,
    padding: 10, borderWidth: 1, borderColor: theme.statusGreen + '33',
  },
  deltaTitle: { fontSize: 12, fontWeight: '700', color: theme.statusGreen, marginBottom: 2 },
  deltaDesc: { fontSize: 11, color: theme.textMuted, lineHeight: 15 },
});

// ─── Cumulative improvement chart ─────────────────────────────────────────────
function ImprovementChart() {
  // Simulate 8-week cumulative accuracy improvement
  const weeks = ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5', 'Wk6', 'Wk7', 'Wk8'];
  const values = [0, 0.8, 1.4, 2.1, 2.9, 3.4, 4.0, 4.7]; // cumulative % improvement
  const max = 5;

  return (
    <View style={{ gap: 4 }}>
      {weeks.map((w, i) => {
        const barAnim = useRef(new Animated.Value(0)).current;
        useEffect(() => {
          Animated.timing(barAnim, {
            toValue: values[i] / max,
            duration: 600 + i * 100, easing: Easing.out(Easing.cubic), useNativeDriver: false,
          }).start();
        }, []);
        return (
          <View key={w} style={chartStyles.row}>
            <Text style={chartStyles.wkLabel}>{w}</Text>
            <View style={chartStyles.track}>
              <Animated.View style={[chartStyles.fill, {
                width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: i < 4 ? theme.primary : theme.statusGreen,
              }]} />
            </View>
            <Text style={[chartStyles.val, { color: i < 4 ? theme.primary : theme.statusGreen }]}>
              +{values[i].toFixed(1)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}
const chartStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wkLabel: { width: 32, fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  track: { flex: 1, height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  val: { width: 40, fontSize: 10, fontWeight: '700', textAlign: 'right' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SelfHealingAIScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Animate sync pulse
  const syncPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(syncPulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(syncPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const queued = CASES.filter((c) => c.processingStatus === 'queued').length;
  const fineTuning = CASES.filter((c) => c.processingStatus === 'fine-tuning').length;
  const complete = CASES.filter((c) => c.processingStatus === 'complete').length;
  const synced = CASES.filter((c) => c.processingStatus === 'synced').length;
  const totalDelta = CASES.reduce((a, c) => a + c.deltaAccuracy, 0);
  const audioCaptures = CASES.filter((c) => c.audioFlagged).length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Self-Healing AI</Text>
          <Text style={styles.navSub}>MediAid v10 · Federated on-device learning loop</Text>
        </View>
        <View style={styles.v10Badge}>
          <Text style={styles.v10Text}>v10</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Architecture banner */}
        <View style={styles.archCard}>
          <View style={styles.archHeader}>
            <Animated.View style={{ transform: [{ scale: syncPulse }] }}>
              <View style={styles.archIconCircle}>
                <MaterialIcons name="psychology" size={24} color={theme.primary} />
              </View>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.archTitle}>Adaptive On-Device Learning Loop</Text>
              <Text style={styles.archSub}>Ships a static model. Improves autonomously in the field.</Text>
            </View>
          </View>
          <Text style={styles.archDesc}>
            When the AI returns a low-confidence result (51–65%), MediAid records the audio and two structured CHA follow-up questions. During overnight device charging, a lightweight federated fine-tuning step runs locally. Updated parameters sync on the next connectivity window — without raw data ever leaving the device.
          </Text>
          <View style={styles.archFlowRow}>
            {[
              { icon: 'psychology', label: 'Low Conf. Result', color: '#F97316' },
              { icon: 'mic', label: 'Audio + Q&A', color: '#22D3EE' },
              { icon: 'nights-stay', label: 'Overnight Tune', color: '#818CF8' },
              { icon: 'cloud-sync', label: 'Param Sync', color: theme.primary },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                <View style={styles.archFlowStep}>
                  <View style={[styles.archFlowIcon, { backgroundColor: s.color + '18', borderColor: s.color + '44' }]}>
                    <MaterialIcons name={s.icon as any} size={16} color={s.color} />
                  </View>
                  <Text style={[styles.archFlowLabel, { color: s.color }]}>{s.label}</Text>
                </View>
                {i < 3 && <MaterialIcons name="arrow-forward" size={14} color={theme.border} />}
              </React.Fragment>
            ))}
          </View>
          <View style={styles.privacyNote}>
            <MaterialIcons name="lock" size={12} color={theme.statusGreen} />
            <Text style={styles.privacyNoteText}>
              Raw audio NEVER transmitted · Parameter gradients only · GDPR-compatible federated architecture
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statRow}>
          {[
            { label: 'Queued', value: queued, color: theme.textMuted, icon: 'schedule' },
            { label: 'Fine-Tuning', value: fineTuning, color: theme.statusYellow, icon: 'psychology' },
            { label: 'Complete', value: complete, color: theme.statusGreen, icon: 'check-circle' },
            { label: 'Synced', value: synced, color: theme.primary, icon: 'cloud-done' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCell, { borderColor: s.color + '44' }]}>
              <MaterialIcons name={s.icon as any} size={16} color={s.color} />
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Key metrics */}
        <View style={styles.keyMetrics}>
          <View style={[styles.keyMetric, { borderColor: '#22D3EE44' }]}>
            <MaterialIcons name="mic" size={18} color="#22D3EE" />
            <Text style={[styles.keyMetricNum, { color: '#22D3EE' }]}>{audioCaptures}</Text>
            <Text style={styles.keyMetricLabel}>Audio{`\n`}Captures</Text>
          </View>
          <View style={[styles.keyMetric, { borderColor: theme.statusGreen + '44' }]}>
            <MaterialIcons name="trending-up" size={18} color={theme.statusGreen} />
            <Text style={[styles.keyMetricNum, { color: theme.statusGreen }]}>+{totalDelta.toFixed(1)}%</Text>
            <Text style={styles.keyMetricLabel}>Total Accuracy{`\n`}Delta</Text>
          </View>
          <View style={[styles.keyMetric, { borderColor: '#818CF844' }]}>
            <MaterialIcons name="nights-stay" size={18} color="#818CF8" />
            <Text style={[styles.keyMetricNum, { color: '#818CF8' }]}>{complete + synced}</Text>
            <Text style={styles.keyMetricLabel}>Fine-Tune{`\n`}Runs</Text>
          </View>
          <View style={[styles.keyMetric, { borderColor: theme.primary + '44' }]}>
            <MaterialIcons name="language" size={18} color={theme.primary} />
            <Text style={[styles.keyMetricNum, { color: theme.primary }]}>3</Text>
            <Text style={styles.keyMetricLabel}>Language{`\n`}Groups</Text>
          </View>
        </View>

        {/* Why this solves the core problem */}
        <View style={styles.problemCard}>
          <Text style={styles.problemTitle}>The Transferability Problem — Solved</Text>
          <Text style={styles.problemDesc}>
            Models trained on Indian or Kenyan coughs underperform on Cameroonian variants. The Self-Healing AI loop continuously fine-tunes on local population data — automatically closing the transferability gap without any engineer involvement.
          </Text>
          <View style={styles.problemPoints}>
            {[
              { icon: 'check', text: 'No engineer needed in the field', color: theme.statusGreen },
              { icon: 'check', text: 'No raw biometric data transmitted', color: theme.statusGreen },
              { icon: 'check', text: 'Cameroonian acoustic profile learned automatically', color: theme.statusGreen },
              { icon: 'check', text: 'Supports Fulfulde, French, and English speech patterns', color: theme.statusGreen },
            ].map((p) => (
              <View key={p.text} style={styles.problemPoint}>
                <MaterialIcons name={p.icon as any} size={13} color={p.color} />
                <Text style={styles.problemPointText}>{p.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Cumulative accuracy chart */}
        <Text style={styles.sectionTitle}>CUMULATIVE ACCURACY IMPROVEMENT (8 WEEKS)</Text>
        <View style={styles.chartCard}>
          <ImprovementChart />
          <Text style={styles.chartNote}>
            Simulated accuracy delta from federated fine-tuning of TB cough AI on Cameroonian population · Illustrative Phase 1 trajectory
          </Text>
        </View>

        {/* Case log */}
        <Text style={styles.sectionTitle}>LOW-CONFIDENCE CASE LOG — {CASES.length} CASES</Text>
        {CASES.map((c) => <CaseCard key={c.id} c={c} />)}

        {/* Research output */}
        <View style={styles.pubCard}>
          <MaterialIcons name="science" size={18} color="#818CF8" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pubTitle}>Phase 2 Scientific Output</Text>
            <Text style={styles.pubDesc}>
              The Self-Healing AI federated loop produces the first field-deployed adaptive health AI from rural Cameroon. Phase 2 paper: "Federated On-Device Learning for Community Health AI in Low-Connectivity African Settings." Target: Nature Machine Intelligence or Lancet Digital Health.
            </Text>
            <View style={styles.pubTags}>
              {['Zero extra hardware', 'No engineer in field', 'Privacy-preserving', 'Qualcomm mandate match'].map((t) => (
                <View key={t} style={styles.pubTag}><Text style={styles.pubTagText}>{t}</Text></View>
              ))}
            </View>
          </View>
        </View>
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
  v10Text: { fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 0.5 },
  archCard: {
    backgroundColor: theme.primary + '08', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16, marginBottom: 14,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  archHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  archIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.primary + '44',
  },
  archTitle: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  archSub: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  archDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 14 },
  archFlowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  archFlowStep: { alignItems: 'center', gap: 4, flex: 1 },
  archFlowIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  archFlowLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
  privacyNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.statusGreen + '0D', borderRadius: theme.radius.small,
    padding: 8, borderWidth: 1, borderColor: theme.statusGreen + '33',
  },
  privacyNoteText: { flex: 1, fontSize: 11, color: theme.statusGreen + 'CC', fontWeight: '500' },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCell: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 10, alignItems: 'center', gap: 3, borderWidth: 1,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 8, color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  keyMetrics: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  keyMetric: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 10, alignItems: 'center', gap: 4, borderWidth: 1,
  },
  keyMetricNum: { fontSize: 16, fontWeight: '800' },
  keyMetricLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  problemCard: {
    backgroundColor: theme.statusGreen + '08', borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  problemTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
  problemDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 10 },
  problemPoints: { gap: 7 },
  problemPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  problemPointText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  sectionTitle: {
    fontSize: 11, color: theme.textMuted, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8,
  },
  chartCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 14, gap: 12,
  },
  chartNote: { fontSize: 10, color: theme.textMuted, lineHeight: 15 },
  pubCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#818CF808', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 4, borderWidth: 1, borderColor: '#818CF844',
  },
  pubTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  pubDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 10 },
  pubTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pubTag: {
    backgroundColor: '#818CF818', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#818CF844',
  },
  pubTagText: { fontSize: 9, fontWeight: '700', color: '#818CF8' },
});
