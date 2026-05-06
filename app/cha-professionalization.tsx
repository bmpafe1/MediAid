// MediAid — CHA Professionalization Metric Screen (v10)
// Phase 1 objective: Measure CHA confidence, professional identity, and retention rates
// Before/after structured interviews at Month 1 and Month 18 · Zero cost · UNICEF/Gates/Wellcome mandate
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const STORAGE_KEY = 'mediaid_cha_professionalization_v1';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SurveyResponse {
  id: string;
  phase: 'baseline' | 'midpoint' | 'endline';
  label: string;
  completedAt: string | null;
  scores: Record<string, number>; // dimension -> Likert 1-5
}

interface ProfessionalizationData {
  responses: SurveyResponse[];
  retentionStatus: 'active' | 'at-risk' | 'departed';
  interviewNotes: string;
}

const DIMENSIONS = [
  { id: 'confidence', label: 'Clinical Confidence', icon: 'psychology', color: theme.primary, desc: 'I feel confident in my ability to screen patients accurately.' },
  { id: 'identity', label: 'Professional Identity', icon: 'badge', color: '#A78BFA', desc: 'I see myself as a skilled healthcare professional in my community.' },
  { id: 'recognition', label: 'Community Recognition', icon: 'people', color: '#10B981', desc: 'My community respects and trusts me as a health resource.' },
  { id: 'empowerment', label: 'Decision Empowerment', icon: 'bolt', color: theme.statusYellow, desc: 'I feel empowered to make clinical decisions within my scope.' },
  { id: 'retention', label: 'Retention Intent', icon: 'favorite', color: '#EC4899', desc: 'I plan to continue working as a CHA for the next 18 months.' },
];

const PHASES: { id: SurveyResponse['phase']; label: string; timing: string; color: string }[] = [
  { id: 'baseline', label: 'Baseline Survey', timing: 'Month 1', color: theme.primary },
  { id: 'midpoint', label: 'Midpoint Survey', timing: 'Month 9', color: theme.statusYellow },
  { id: 'endline', label: 'Endline Survey', timing: 'Month 18', color: theme.statusGreen },
];

const DEFAULT_DATA: ProfessionalizationData = {
  responses: [
    {
      id: 'r1',
      phase: 'baseline',
      label: 'Baseline Survey',
      completedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      scores: { confidence: 2, identity: 2, recognition: 3, empowerment: 2, retention: 3 },
    },
    {
      id: 'r2',
      phase: 'midpoint',
      label: 'Midpoint Survey',
      completedAt: null, // not yet completed
      scores: {},
    },
    {
      id: 'r3',
      phase: 'endline',
      label: 'Endline Survey',
      completedAt: null,
      scores: {},
    },
  ],
  retentionStatus: 'active',
  interviewNotes: '',
};

// ─── Radar Chart (simplified 5-axis via View layout) ──────────────────────────
function RadarChart({ before, after }: { before: Record<string, number>; after: Record<string, number> }) {
  const size = 180;
  const center = size / 2;
  const maxR = 70;

  const dimensionAngles = DIMENSIONS.map((_, i) => (i / DIMENSIONS.length) * 2 * Math.PI - Math.PI / 2);

  const getPoint = (score: number, angle: number) => {
    const r = (score / 5) * maxR;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  return (
    <View style={{ width: size, height: size, position: 'relative', alignSelf: 'center' }}>
      {/* Grid rings */}
      {[1, 2, 3, 4, 5].map((ring) => (
        <View
          key={ring}
          style={{
            position: 'absolute',
            width: (ring / 5) * maxR * 2,
            height: (ring / 5) * maxR * 2,
            borderRadius: (ring / 5) * maxR,
            borderWidth: 1,
            borderColor: theme.border,
            left: center - (ring / 5) * maxR,
            top: center - (ring / 5) * maxR,
          }}
        />
      ))}
      {/* Axis lines */}
      {DIMENSIONS.map((d, i) => {
        const angle = dimensionAngles[i];
        const end = getPoint(5, angle);
        return (
          <View
            key={d.id}
            style={{
              position: 'absolute',
              width: 1,
              backgroundColor: theme.border,
              height: maxR,
              left: center,
              top: center - maxR,
              transformOrigin: `0 ${maxR}px`,
              transform: [{ rotate: `${angle + Math.PI / 2}rad` }],
            }}
          />
        );
      })}
      {/* Before dots */}
      {Object.keys(before).length > 0 && DIMENSIONS.map((d, i) => {
        const angle = dimensionAngles[i];
        const score = before[d.id] ?? 1;
        const pt = getPoint(score, angle);
        return (
          <View
            key={`before-${d.id}`}
            style={{
              position: 'absolute',
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: theme.textMuted,
              left: pt.x - 4,
              top: pt.y - 4,
            }}
          />
        );
      })}
      {/* After dots */}
      {Object.keys(after).length > 0 && DIMENSIONS.map((d, i) => {
        const angle = dimensionAngles[i];
        const score = after[d.id] ?? 1;
        const pt = getPoint(score, angle);
        return (
          <View
            key={`after-${d.id}`}
            style={{
              position: 'absolute',
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: theme.statusGreen,
              left: pt.x - 5,
              top: pt.y - 5,
              shadowColor: theme.statusGreen,
              shadowOpacity: 0.6, shadowRadius: 4,
            }}
          />
        );
      })}
      {/* Dimension labels */}
      {DIMENSIONS.map((d, i) => {
        const angle = dimensionAngles[i];
        const labelR = maxR + 18;
        const lx = center + labelR * Math.cos(angle);
        const ly = center + labelR * Math.sin(angle);
        return (
          <View
            key={`label-${d.id}`}
            style={{
              position: 'absolute',
              left: lx - 30, top: ly - 10, width: 60,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 8, color: d.color, fontWeight: '700', textAlign: 'center', lineHeight: 11 }}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Likert Scale ─────────────────────────────────────────────────────────────
function LikertScale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'];
  const colors = [theme.statusRed, '#F97316', theme.statusYellow, theme.statusGreen, '#10B981'];
  return (
    <View style={likertStyles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          style={[
            likertStyles.btn,
            {
              backgroundColor: value === n ? colors[n - 1] : theme.surface,
              borderColor: value === n ? colors[n - 1] : theme.border,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(n);
          }}
        >
          <Text style={[likertStyles.num, { color: value === n ? '#FFF' : theme.textMuted }]}>{n}</Text>
          <Text style={[likertStyles.label, { color: value === n ? '#FFF' : theme.textMuted }]} numberOfLines={2}>
            {labels[n - 1]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const likertStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1, borderRadius: theme.radius.small, padding: 8,
    alignItems: 'center', borderWidth: 1, gap: 3,
  },
  num: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 8, textAlign: 'center', lineHeight: 11, fontWeight: '600' },
});

// ─── Survey Modal ─────────────────────────────────────────────────────────────
function SurveyModal({
  visible, phase, onComplete, onClose,
}: {
  visible: boolean;
  phase: typeof PHASES[0];
  onComplete: (scores: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const dim = DIMENSIONS[step];

  const allAnswered = DIMENSIONS.every((d) => scores[d.id]);
  const progressPct = (Object.keys(scores).length / DIMENSIONS.length) * 100;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={surveyStyles.header}>
          <View style={{ flex: 1 }}>
            <Text style={surveyStyles.title}>{phase.label}</Text>
            <Text style={surveyStyles.sub}>{phase.timing} · 5 questions · ~3 minutes</Text>
          </View>
          <Pressable style={surveyStyles.closeBtn} onPress={onClose}>
            <MaterialIcons name="close" size={22} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* Progress */}
        <View style={surveyStyles.progressBar}>
          <View style={[surveyStyles.progressFill, { width: `${progressPct}%`, backgroundColor: phase.color }]} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>
          {/* Step indicator */}
          <View style={surveyStyles.stepRow}>
            {DIMENSIONS.map((d, i) => (
              <Pressable
                key={d.id}
                style={[
                  surveyStyles.stepDot,
                  {
                    backgroundColor: scores[d.id] ? phase.color : i === step ? phase.color + '44' : theme.border,
                    borderColor: i === step ? phase.color : 'transparent',
                    borderWidth: i === step ? 2 : 0,
                  },
                ]}
                onPress={() => setStep(i)}
              />
            ))}
          </View>

          {/* Dimension card */}
          <View style={[surveyStyles.dimCard, { borderColor: dim.color + '44' }]}>
            <View style={[surveyStyles.dimIcon, { backgroundColor: dim.color + '18' }]}>
              <MaterialIcons name={dim.icon as any} size={24} color={dim.color} />
            </View>
            <Text style={[surveyStyles.dimLabel, { color: dim.color }]}>{dim.label}</Text>
            <Text style={surveyStyles.dimDesc}>{dim.desc}</Text>
          </View>

          <LikertScale
            value={scores[dim.id] ?? 0}
            onChange={(v) => setScores((prev) => ({ ...prev, [dim.id]: v }))}
          />

          {/* Navigation */}
          <View style={surveyStyles.navRow}>
            {step > 0 && (
              <Pressable style={surveyStyles.navBtn} onPress={() => setStep((s) => s - 1)}>
                <MaterialIcons name="arrow-back" size={16} color={theme.textSecondary} />
                <Text style={surveyStyles.navBtnText}>Back</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            {step < DIMENSIONS.length - 1 ? (
              <Pressable
                style={[surveyStyles.navBtnPrimary, !scores[dim.id] && { opacity: 0.4 }]}
                disabled={!scores[dim.id]}
                onPress={() => setStep((s) => s + 1)}
              >
                <Text style={surveyStyles.navBtnPrimaryText}>Next</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#FFF" />
              </Pressable>
            ) : (
              <Pressable
                style={[surveyStyles.submitBtn, !allAnswered && { opacity: 0.4 }]}
                disabled={!allAnswered}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onComplete(scores);
                }}
              >
                <MaterialIcons name="check-circle" size={18} color="#FFF" />
                <Text style={surveyStyles.submitBtnText}>Submit Survey</Text>
              </Pressable>
            )}
          </View>

          {/* All responses summary */}
          {Object.keys(scores).length > 0 && (
            <View style={surveyStyles.summaryCard}>
              <Text style={surveyStyles.summaryTitle}>YOUR RESPONSES SO FAR</Text>
              {DIMENSIONS.filter((d) => scores[d.id]).map((d) => (
                <View key={d.id} style={surveyStyles.summaryRow}>
                  <MaterialIcons name={d.icon as any} size={13} color={d.color} />
                  <Text style={surveyStyles.summaryLabel}>{d.label}</Text>
                  <View style={surveyStyles.summaryDots}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <View
                        key={n}
                        style={[surveyStyles.summaryDot, {
                          backgroundColor: n <= (scores[d.id] ?? 0) ? d.color : theme.border,
                        }]}
                      />
                    ))}
                  </View>
                  <Text style={[surveyStyles.summaryScore, { color: d.color }]}>{scores[d.id]}/5</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const surveyStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  sub: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressBar: { height: 3, backgroundColor: theme.border },
  progressFill: { height: '100%', borderRadius: 2 },
  stepRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  dimCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.large,
    padding: 20, alignItems: 'center', gap: 10, borderWidth: 1,
  },
  dimIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  dimLabel: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  dimDesc: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: theme.border,
  },
  navBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  navBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  navBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusGreen, borderRadius: theme.radius.full,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  summaryCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border, gap: 8,
  },
  summaryTitle: { fontSize: 9, fontWeight: '800', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { flex: 1, fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  summaryDots: { flexDirection: 'row', gap: 3 },
  summaryDot: { width: 8, height: 8, borderRadius: 4 },
  summaryScore: { fontSize: 12, fontWeight: '800', width: 28, textAlign: 'right' },
});

// ─── Score Dimension Bar ──────────────────────────────────────────────────────
function DimScoreBar({ dim, before, after }: {
  dim: typeof DIMENSIONS[0];
  before?: number;
  after?: number;
}) {
  const beforeAnim = useRef(new Animated.Value(0)).current;
  const afterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (before != null) {
      Animated.timing(beforeAnim, {
        toValue: before / 5,
        duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    }
    if (after != null) {
      Animated.timing(afterAnim, {
        toValue: after / 5,
        duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    }
  }, [before, after]);

  const delta = before != null && after != null ? after - before : null;

  return (
    <View style={dimBarStyles.row}>
      <View style={[dimBarStyles.iconCircle, { backgroundColor: dim.color + '18' }]}>
        <MaterialIcons name={dim.icon as any} size={14} color={dim.color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={dimBarStyles.label}>{dim.label}</Text>
        {before != null && (
          <View style={dimBarStyles.barRow}>
            <Text style={dimBarStyles.barTag}>Before</Text>
            <View style={dimBarStyles.track}>
              <Animated.View style={[dimBarStyles.fill, {
                width: beforeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: theme.textMuted,
                opacity: 0.5,
              }]} />
            </View>
            <Text style={[dimBarStyles.score, { color: theme.textMuted }]}>{before}/5</Text>
          </View>
        )}
        {after != null && (
          <View style={dimBarStyles.barRow}>
            <Text style={dimBarStyles.barTag}>After</Text>
            <View style={dimBarStyles.track}>
              <Animated.View style={[dimBarStyles.fill, {
                width: afterAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: dim.color,
              }]} />
            </View>
            <Text style={[dimBarStyles.score, { color: dim.color }]}>{after}/5</Text>
          </View>
        )}
      </View>
      {delta != null && (
        <View style={[dimBarStyles.deltaBadge, {
          backgroundColor: delta > 0 ? theme.statusGreen + '18' : delta < 0 ? theme.statusRed + '18' : theme.border,
          borderColor: delta > 0 ? theme.statusGreen + '44' : delta < 0 ? theme.statusRed + '44' : theme.border,
        }]}>
          <MaterialIcons
            name={delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'trending-flat'}
            size={12}
            color={delta > 0 ? theme.statusGreen : delta < 0 ? theme.statusRed : theme.textMuted}
          />
          <Text style={[dimBarStyles.deltaText, {
            color: delta > 0 ? theme.statusGreen : delta < 0 ? theme.statusRed : theme.textMuted,
          }]}>{delta > 0 ? '+' : ''}{delta}</Text>
        </View>
      )}
    </View>
  );
}

const dimBarStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: 11, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barTag: { fontSize: 9, color: theme.textMuted, fontWeight: '700', width: 32 },
  track: { flex: 1, height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  score: { fontSize: 10, fontWeight: '700', width: 26, textAlign: 'right' },
  deltaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, flexShrink: 0,
  },
  deltaText: { fontSize: 10, fontWeight: '800' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CHAProfessionalizationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<ProfessionalizationData>(DEFAULT_DATA);
  const [surveyPhase, setSurveyPhase] = useState<typeof PHASES[0] | null>(null);
  const [surveyOpen, setSurveyOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setData(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const save = async (d: ProfessionalizationData) => {
    setData(d);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  };

  const handleSurveyComplete = async (phase: typeof PHASES[0], scores: Record<string, number>) => {
    const updated: ProfessionalizationData = {
      ...data,
      responses: data.responses.map((r) =>
        r.phase === phase.id
          ? { ...r, scores, completedAt: new Date().toISOString() }
          : r
      ),
    };
    await save(updated);
    setSurveyOpen(false);
    setSurveyPhase(null);
  };

  const baseline = data.responses.find((r) => r.phase === 'baseline');
  const midpoint = data.responses.find((r) => r.phase === 'midpoint');
  const endline = data.responses.find((r) => r.phase === 'endline');

  // Composite professionalization score (avg of all Likert dimensions, 1–5)
  const computeScore = (resp: SurveyResponse | undefined) => {
    if (!resp?.completedAt || Object.keys(resp.scores).length === 0) return null;
    const vals = Object.values(resp.scores);
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const baselineScore = computeScore(baseline);
  const midpointScore = computeScore(midpoint);
  const endlineScore = computeScore(endline);

  const latestCompleted = [endline, midpoint, baseline].find((r) => r?.completedAt);
  const latestScore = computeScore(latestCompleted);

  const scoreColor = latestScore != null
    ? latestScore >= 4 ? theme.statusGreen : latestScore >= 3 ? theme.statusYellow : theme.statusRed
    : theme.textMuted;

  const retentionColors = {
    active: theme.statusGreen,
    'at-risk': theme.statusYellow,
    departed: theme.statusRed,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {surveyPhase && (
        <SurveyModal
          visible={surveyOpen}
          phase={surveyPhase}
          onComplete={(scores) => handleSurveyComplete(surveyPhase, scores)}
          onClose={() => { setSurveyOpen(false); setSurveyPhase(null); }}
        />
      )}

      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>CHA Professionalization</Text>
          <Text style={styles.navSub}>MediAid v10 · Phase 1 metric · Structured interviews</Text>
        </View>
        <View style={styles.v10Badge}>
          <Text style={styles.v10Text}>NEW v10</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Why this matters */}
        <View style={styles.whyCard}>
          <View style={styles.whyHeader}>
            <MaterialIcons name="trending-up" size={20} color={theme.primary} />
            <Text style={styles.whyTitle}>Phase 1 Professionalization Objective</Text>
          </View>
          <Text style={styles.whyDesc}>
            Measure CHA confidence, professional identity, and retention rates via structured before/after interviews at Month 1 and Month 18. Zero additional field cost — data collected during scheduled CHA supervision visits.
          </Text>
          <View style={styles.funderRow}>
            {['UNICEF', 'Gates Foundation', 'Wellcome Trust'].map((f) => (
              <View key={f} style={styles.funderChip}>
                <MaterialIcons name="verified" size={10} color={theme.primary} />
                <Text style={styles.funderText}>{f}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.whySub}>
            All three funders explicitly prioritise health worker equity and CHA sustainability as primary outcomes.
          </Text>
        </View>

        {/* Composite score */}
        {latestScore != null && (
          <>
            <Text style={styles.sectionTitle}>PROFESSIONALIZATION SCORE</Text>
            <View style={[styles.scoreCard, { borderColor: scoreColor + '44' }]}>
              <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
                <Text style={[styles.scoreNum, { color: scoreColor }]}>{latestScore}</Text>
                <Text style={styles.scoreMax}>/5</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scoreLabel, { color: scoreColor }]}>
                  {latestScore >= 4 ? 'High Professionalization' : latestScore >= 3 ? 'Developing' : 'Low — Support Needed'}
                </Text>
                <Text style={styles.scoreSub}>
                  Composite Likert score across 5 dimensions · {latestCompleted?.phase === 'baseline' ? 'Baseline' : latestCompleted?.phase === 'midpoint' ? 'Midpoint' : 'Endline'} survey
                </Text>
                {baselineScore != null && endlineScore != null && (
                  <View style={styles.deltaRow}>
                    <MaterialIcons name="trending-up" size={14} color={theme.statusGreen} />
                    <Text style={styles.deltaText}>
                      +{(endlineScore - baselineScore).toFixed(1)} improvement from baseline
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* Survey phases */}
        <Text style={styles.sectionTitle}>INTERVIEW SCHEDULE</Text>
        {PHASES.map((phase) => {
          const resp = data.responses.find((r) => r.phase === phase.id);
          const completed = !!resp?.completedAt;
          const score = computeScore(resp);

          return (
            <View key={phase.id} style={[styles.phaseCard, { borderColor: completed ? phase.color + '55' : theme.border }]}>
              <View style={styles.phaseHeader}>
                <View style={[styles.phaseIcon, { backgroundColor: completed ? phase.color + '18' : theme.surface, borderColor: completed ? phase.color + '44' : theme.border }]}>
                  <MaterialIcons
                    name={completed ? 'check-circle' : 'radio-button-unchecked'}
                    size={22}
                    color={completed ? phase.color : theme.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.phaseName}>{phase.label}</Text>
                  <Text style={styles.phaseTiming}>{phase.timing} · 5 questions · ~3 min</Text>
                  {completed && resp?.completedAt && (
                    <Text style={[styles.phaseCompleted, { color: phase.color }]}>
                      Completed {new Date(resp.completedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                {score != null && (
                  <Text style={[styles.phaseScore, { color: phase.color }]}>{score}/5</Text>
                )}
              </View>

              {!completed && (
                <Pressable
                  style={({ pressed }) => [styles.startSurveyBtn, { borderColor: phase.color + '44', backgroundColor: phase.color + '12' }, pressed && { opacity: 0.8 }]}
                  onPress={() => { setSurveyPhase(phase); setSurveyOpen(true); }}
                >
                  <MaterialIcons name="assignment" size={16} color={phase.color} />
                  <Text style={[styles.startSurveyText, { color: phase.color }]}>Start {phase.label}</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={phase.color} />
                </Pressable>
              )}

              {completed && resp && Object.keys(resp.scores).length > 0 && (
                <View style={styles.phaseScores}>
                  {DIMENSIONS.map((d) => (
                    <View key={d.id} style={styles.phaseScoreRow}>
                      <MaterialIcons name={d.icon as any} size={11} color={d.color} />
                      <Text style={styles.phaseScoreLabel}>{d.label}</Text>
                      <View style={styles.phaseScoreDots}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <View key={n} style={[styles.phaseScoreDot, { backgroundColor: n <= (resp.scores[d.id] ?? 0) ? d.color : theme.border }]} />
                        ))}
                      </View>
                      <Text style={[styles.phaseScoreNum, { color: d.color }]}>{resp.scores[d.id]}/5</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Before/After comparison */}
        {baselineScore != null && (endlineScore != null || midpointScore != null) && (
          <>
            <Text style={styles.sectionTitle}>BEFORE / AFTER COMPARISON</Text>
            <View style={styles.compCard}>
              {DIMENSIONS.map((d) => (
                <DimScoreBar
                  key={d.id}
                  dim={d}
                  before={baseline?.scores[d.id]}
                  after={(endline?.completedAt ? endline : midpoint)?.scores[d.id]}
                />
              ))}
            </View>

            {/* Radar chart */}
            <Text style={styles.sectionTitle}>5-DIMENSION RADAR</Text>
            <View style={styles.radarCard}>
              <RadarChart
                before={baseline?.scores ?? {}}
                after={(endline?.completedAt ? endline : midpoint)?.scores ?? {}}
              />
              <View style={styles.radarLegend}>
                <View style={styles.radarLegendRow}>
                  <View style={[styles.radarLegendDot, { backgroundColor: theme.textMuted }]} />
                  <Text style={styles.radarLegendText}>Before (Baseline)</Text>
                </View>
                <View style={styles.radarLegendRow}>
                  <View style={[styles.radarLegendDot, { backgroundColor: theme.statusGreen }]} />
                  <Text style={styles.radarLegendText}>After ({endline?.completedAt ? 'Endline' : 'Midpoint'})</Text>
                </View>
              </View>
              <Text style={styles.radarNote}>
                Each dot represents a 1–5 Likert score on that dimension. Outward movement = professionalization gain.
              </Text>
            </View>
          </>
        )}

        {/* Retention tracker */}
        <Text style={styles.sectionTitle}>RETENTION STATUS</Text>
        <View style={styles.retentionCard}>
          <View style={styles.retentionRow}>
            {(['active', 'at-risk', 'departed'] as const).map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.retentionChip,
                  {
                    backgroundColor: data.retentionStatus === s ? retentionColors[s] : theme.surface,
                    borderColor: data.retentionStatus === s ? retentionColors[s] : theme.border,
                  },
                ]}
                onPress={async () => {
                  Haptics.selectionAsync();
                  await save({ ...data, retentionStatus: s });
                }}
              >
                <Text style={[styles.retentionChipText, {
                  color: data.retentionStatus === s ? '#FFF' : theme.textSecondary,
                }]}>
                  {s === 'active' ? 'Active' : s === 'at-risk' ? 'At Risk' : 'Departed'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.retentionNote}>
            Track CHA retention as a Phase 1 outcome metric. "At Risk" triggers supervisor follow-up protocol. Target: 0 involuntary departures in Phase 1.
          </Text>
        </View>

        {/* Publication pathway */}
        <View style={styles.pubCard}>
          <MaterialIcons name="article" size={18} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pubTitle}>Phase 1 Publication Pathway</Text>
            <Text style={styles.pubDesc}>
              CHA professionalization data submitted as a standalone paper to the International Journal of Community Health and primary author on the Phase 1 feasibility publication. First structured CHW professionalization dataset from rural Cameroon.
            </Text>
            <View style={styles.pubTags}>
              <View style={styles.pubTag}><Text style={styles.pubTagText}>IJCH submission</Text></View>
              <View style={styles.pubTag}><Text style={styles.pubTagText}>Zero cost</Text></View>
              <View style={styles.pubTag}><Text style={styles.pubTagText}>Month 1 start</Text></View>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          MediAid v10 · CHA Professionalization Metric · Phase 1 objective · UNICEF / Gates / Wellcome mandate
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
  v10Text: { fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 0.5 },
  whyCard: {
    backgroundColor: theme.primary + '08', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16, marginBottom: 14,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  whyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  whyTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, flex: 1 },
  whyDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 10 },
  funderRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  funderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: theme.primary + '44',
  },
  funderText: { fontSize: 10, fontWeight: '700', color: theme.primary },
  whySub: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  sectionTitle: {
    fontSize: 11, color: theme.textMuted, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 16,
  },
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 16, borderWidth: 1,
  },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.background, flexDirection: 'row',
    flexShrink: 0,
  },
  scoreNum: { fontSize: 28, fontWeight: '800' },
  scoreMax: { fontSize: 14, color: theme.textMuted, fontWeight: '600', marginTop: 8 },
  scoreLabel: { fontSize: 14, fontWeight: '700' },
  scoreSub: { fontSize: 11, color: theme.textMuted, marginTop: 3, lineHeight: 15 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  deltaText: { fontSize: 12, color: theme.statusGreen, fontWeight: '700' },
  phaseCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, padding: 14, marginBottom: 10,
  },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  phaseIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0,
  },
  phaseName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  phaseTiming: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  phaseCompleted: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  phaseScore: { fontSize: 22, fontWeight: '800' },
  startSurveyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: theme.radius.medium, padding: 12, borderWidth: 1,
    justifyContent: 'center',
  },
  startSurveyText: { fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'center' },
  phaseScores: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
  phaseScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  phaseScoreLabel: { flex: 1, fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  phaseScoreDots: { flexDirection: 'row', gap: 3 },
  phaseScoreDot: { width: 7, height: 7, borderRadius: 3.5 },
  phaseScoreNum: { fontSize: 11, fontWeight: '800', width: 24, textAlign: 'right' },
  compCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border,
  },
  radarCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center', gap: 16,
  },
  radarLegend: { flexDirection: 'row', gap: 20 },
  radarLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radarLegendDot: { width: 10, height: 10, borderRadius: 5 },
  radarLegendText: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
  radarNote: { fontSize: 10, color: theme.textMuted, textAlign: 'center', lineHeight: 15 },
  retentionCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border, gap: 12,
  },
  retentionRow: { flexDirection: 'row', gap: 8 },
  retentionChip: {
    flex: 1, borderRadius: theme.radius.medium, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1,
  },
  retentionChipText: { fontSize: 13, fontWeight: '700' },
  retentionNote: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  pubCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#10B98108', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#10B98144',
  },
  pubTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  pubDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 10 },
  pubTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pubTag: {
    backgroundColor: '#10B98118', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#10B98144',
  },
  pubTagText: { fontSize: 9, fontWeight: '700', color: '#10B981' },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
