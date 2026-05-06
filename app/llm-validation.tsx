// MediAid — Silent LLM Validation Track (v10)
// Borderline consultation records evaluated against GPT-4o, Gemini, Claude in African clinical context
// This is a PARALLEL validation track only — never shown to CHA or patient during consultation
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
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

// ─── Mock Consultation Records ────────────────────────────────────────────────
interface LLMEval {
  model: 'GPT-4o' | 'Gemini 2.5' | 'Claude 3.7';
  modelColor: string;
  recommendation: string;
  confidence: number; // 0–100
  reasoning: string;
  agreesWithCHA: boolean;
}

interface ConsultationRecord {
  id: string;
  patientRef: string;
  timestamp: string;
  triggerReason: string;
  chaDecision: string;
  chaReasoning: string;
  metrics: { label: string; value: string; flag: 'amber' | 'red' | 'normal' }[];
  llmEvals: LLMEval[];
  syncStatus: 'pending' | 'evaluated' | 'published';
  agreedCount: number;
}

const RECORDS: ConsultationRecord[] = [
  {
    id: 'LLM-001',
    patientRef: 'CHA-4471',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    triggerReason: 'Borderline result (TB 63%, below RED threshold 65%) with cough duration >3 weeks',
    chaDecision: 'Monitor + referral for sputum test',
    chaReasoning: 'Patient has productive cough 3 weeks, night sweats, weight loss — decided to refer despite amber TB score. Patient lives far from facility, arranged transport.',
    metrics: [
      { label: 'TB Risk', value: '63%', flag: 'amber' },
      { label: 'Resp. Rate', value: '26/min', flag: 'amber' },
      { label: 'Heart Rate', value: '94 BPM', flag: 'normal' },
      { label: 'SpO₂', value: '96%', flag: 'normal' },
    ],
    llmEvals: [
      {
        model: 'GPT-4o',
        modelColor: '#10A37F',
        recommendation: 'REFER for sputum smear microscopy',
        confidence: 91,
        reasoning: 'Constellation of productive cough >3 weeks, night sweats, weight loss, and borderline AI TB score in high-prevalence Cameroon context strongly warrants referral. WHO IMCI criteria met. CHA decision is clinically sound.',
        agreesWithCHA: true,
      },
      {
        model: 'Gemini 2.5',
        modelColor: '#4285F4',
        recommendation: 'REFER urgently — clinical criteria override AI score',
        confidence: 87,
        reasoning: 'WHO clinical TB criteria (3+ symptoms) present independent of 63% AI probability. In NW Cameroon endemic context with active TB transmission, threshold for referral should be lower. Agree with CHA.',
        agreesWithCHA: true,
      },
      {
        model: 'Claude 3.7',
        modelColor: '#7C3AED',
        recommendation: 'REFER for sputum culture + chest X-ray if available',
        confidence: 89,
        reasoning: 'The combination of clinical symptoms and borderline AI score represents sufficient evidence for referral. The AI threshold (65%) may be calibrated for sensitivity rather than specificity in this context.',
        agreesWithCHA: true,
      },
    ],
    syncStatus: 'evaluated',
    agreedCount: 3,
  },
  {
    id: 'LLM-002',
    patientRef: 'CHA-7834',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    triggerReason: 'AFib risk 14% (amber) in 67-year-old with occasional palpitations',
    chaDecision: 'Monitor — schedule 2-week follow-up',
    chaReasoning: "Patient says palpitations happen once or twice a month, brief. No dizziness or fainting. Community elder, travels are difficult. Decided monitoring is appropriate versus sending to Bamenda today.",
    metrics: [
      { label: 'AFib Risk', value: '14%', flag: 'amber' },
      { label: 'Heart Rate', value: '78 BPM', flag: 'normal' },
      { label: '10-yr CVD', value: '22%', flag: 'amber' },
      { label: 'SpO₂', value: '98%', flag: 'normal' },
    ],
    llmEvals: [
      {
        model: 'GPT-4o',
        modelColor: '#10A37F',
        recommendation: 'REFER for ECG confirmation — do not monitor only',
        confidence: 78,
        reasoning: 'AFib at 14% with elevated 10-yr CVD risk (22%) and age 67 warrants ECG confirmation. CHA2DS2-VASc score likely ≥3, stroke risk is non-trivial. Recommend ECG at district hospital within 1 week, not 2.',
        agreesWithCHA: false,
      },
      {
        model: 'Gemini 2.5',
        modelColor: '#4285F4',
        recommendation: 'Conditional monitor — acceptable with detailed follow-up protocol',
        confidence: 65,
        reasoning: 'In resource-limited context with transport barriers, CHA decision is pragmatically reasonable if follow-up is enforced. However, if palpitations increase in frequency or duration, refer immediately.',
        agreesWithCHA: true,
      },
      {
        model: 'Claude 3.7',
        modelColor: '#7C3AED',
        recommendation: 'REFER within 7 days for ECG',
        confidence: 82,
        reasoning: 'The combination of age, elevated CVD risk score, and AFib probability warrants objective cardiac assessment. Monitoring without ECG baseline creates a clinical evidence gap that could be important if symptoms progress.',
        agreesWithCHA: false,
      },
    ],
    syncStatus: 'evaluated',
    agreedCount: 1,
  },
  {
    id: 'LLM-003',
    patientRef: 'CHA-2219',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    triggerReason: 'Tremor risk 42% (amber) with reported family history of Parkinson\'s disease',
    chaDecision: 'Refer to neurologist — Bamenda Regional Hospital',
    chaReasoning: "Patient's father had Parkinson's. Tremor in right hand when resting, started ~6 months ago. App shows amber but patient says it's getting worse. Referring to ensure early evaluation.",
    metrics: [
      { label: 'Tremor Risk', value: '42%', flag: 'amber' },
      { label: 'Heart Rate', value: '71 BPM', flag: 'normal' },
      { label: 'SpO₂', value: '99%', flag: 'normal' },
      { label: 'Eye Cond.', value: '0 detected', flag: 'normal' },
    ],
    llmEvals: [
      {
        model: 'GPT-4o',
        modelColor: '#10A37F',
        recommendation: 'REFER — appropriate clinical reasoning',
        confidence: 93,
        reasoning: 'Family history of PD + unilateral resting tremor with 6-month progression meets criteria for neurological evaluation. He et al. 2024 AUC 0.89 model at 42% in this clinical context supports early referral. CHA reasoning is excellent.',
        agreesWithCHA: true,
      },
      {
        model: 'Gemini 2.5',
        modelColor: '#4285F4',
        recommendation: 'REFER — clinical history overrides amber threshold',
        confidence: 90,
        reasoning: 'Positive family history is a known independent risk factor. Resting tremor (vs. intention tremor) favors Parkinson\'s etiology. Amber AI score with this clinical profile justifies referral. Agree with CHA decision.',
        agreesWithCHA: true,
      },
      {
        model: 'Claude 3.7',
        modelColor: '#7C3AED',
        recommendation: 'REFER for movement disorder evaluation',
        confidence: 88,
        reasoning: 'Prodromes of PD (resting tremor, family history, progressive onset) are present. Early intervention window for neuroprotective strategies makes prompt referral clinically meaningful even with amber AI score.',
        agreesWithCHA: true,
      },
    ],
    syncStatus: 'evaluated',
    agreedCount: 3,
  },
  {
    id: 'LLM-004',
    patientRef: 'CHA-9103',
    timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    triggerReason: 'Hemoglobin 9.1 g/dL (amber) in 24-year-old pregnant woman',
    chaDecision: 'Iron supplementation + dietary advice + 4-week repeat scan',
    chaReasoning: 'Patient 26 weeks pregnant, eating poorly, has not been taking antenatal iron. Starting her on ferrous sulfate today, gave dietary advice on leafy greens and beans. Will repeat scan in 4 weeks.',
    metrics: [
      { label: 'Hemoglobin', value: '9.1 g/dL', flag: 'amber' },
      { label: 'Heart Rate', value: '88 BPM', flag: 'normal' },
      { label: 'SpO₂', value: '97%', flag: 'normal' },
      { label: 'Resp. Rate', value: '19/min', flag: 'normal' },
    ],
    llmEvals: [
      {
        model: 'GPT-4o',
        modelColor: '#10A37F',
        recommendation: 'Appropriate — add folate + confirm no malaria',
        confidence: 84,
        reasoning: 'Hb 9.1 in 2nd trimester (WHO threshold: <11g/dL = anaemia) warrants iron supplementation. CHA management is reasonable. Recommend adding folic acid if not already prescribed. Exclude malaria as confounding cause — consider RDT.',
        agreesWithCHA: true,
      },
      {
        model: 'Gemini 2.5',
        modelColor: '#4285F4',
        recommendation: 'Appropriate — flag for antenatal clinic visit',
        confidence: 79,
        reasoning: 'Iron deficiency anaemia in pregnancy is the most likely etiology. CHA management is aligned with WHO antenatal guidelines. Suggest ensuring antenatal care registration and flagging for midwife or nurse review at next ANC visit.',
        agreesWithCHA: true,
      },
      {
        model: 'Claude 3.7',
        modelColor: '#7C3AED',
        recommendation: 'Appropriate with monitoring — add malaria RDT',
        confidence: 81,
        reasoning: 'In NW Cameroon with active malaria transmission, any anaemia in pregnancy should exclude malaria. Otherwise CHA plan is medically sound. 4-week repeat is appropriate to confirm response to iron.',
        agreesWithCHA: true,
      },
    ],
    syncStatus: 'evaluated',
    agreedCount: 3,
  },
  {
    id: 'LLM-005',
    patientRef: 'CHA-5562',
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    triggerReason: 'Eye: 1 condition detected (amber) — patient reports blurred vision 2 months',
    chaDecision: 'Refer to ophthalmologist — patient declines transport today',
    chaReasoning: 'App detected one eye condition. Patient says vision blurry for 2 months, especially in bright light. Referred to Bamenda eye clinic but patient says he cannot go this week. Scheduled for next week and gave referral letter.',
    metrics: [
      { label: 'Eye Cond.', value: '1 detected', flag: 'amber' },
      { label: 'Heart Rate', value: '76 BPM', flag: 'normal' },
      { label: 'SpO₂', value: '98%', flag: 'normal' },
      { label: 'TB Risk', value: '28%', flag: 'normal' },
    ],
    llmEvals: [
      {
        model: 'GPT-4o',
        modelColor: '#10A37F',
        recommendation: 'REFER — appropriate, time-sensitive for cataract',
        confidence: 86,
        reasoning: 'Photophobia + progressive blur over 2 months in adult patient is consistent with early cataract (most common in this demographic/region) or glaucoma. Jin et al. 2024 AI detection of 1 condition is clinically meaningful. Referral decision is correct.',
        agreesWithCHA: true,
      },
      {
        model: 'Gemini 2.5',
        modelColor: '#4285F4',
        recommendation: 'REFER — next-week appointment is acceptable',
        confidence: 77,
        reasoning: 'Given absence of acute symptoms (no pain, no sudden vision loss, no red eye), next-week referral is clinically acceptable. Advise patient to return immediately if vision deteriorates rapidly or eye pain develops.',
        agreesWithCHA: true,
      },
      {
        model: 'Claude 3.7',
        modelColor: '#7C3AED',
        recommendation: 'REFER — document patient refusal for audit trail',
        confidence: 83,
        reasoning: 'Referral decision is appropriate. The key documentation issue is recording the patient\'s informed refusal of same-day transport for the audit trail. This protects both patient and CHA and supports outcomes tracking.',
        agreesWithCHA: true,
      },
    ],
    syncStatus: 'pending',
    agreedCount: 3,
  },
];

// ─── Animated Confidence Bar ──────────────────────────────────────────────────
function ConfBar({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / 100,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value]);
  return (
    <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <Animated.View style={{
        height: '100%',
        borderRadius: 2,
        backgroundColor: color,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function SyncBadge({ status }: { status: ConsultationRecord['syncStatus'] }) {
  const configs = {
    pending: { label: 'Pending Eval', color: theme.statusYellow, icon: 'schedule' },
    evaluated: { label: 'LLM Evaluated', color: theme.statusGreen, icon: 'check-circle' },
    published: { label: 'Published', color: theme.primary, icon: 'publish' },
  };
  const c = configs[status];
  return (
    <View style={[llmStyles.syncBadge, { backgroundColor: c.color + '18', borderColor: c.color + '44' }]}>
      <MaterialIcons name={c.icon as any} size={11} color={c.color} />
      <Text style={[llmStyles.syncBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// ─── LLM Eval Card ────────────────────────────────────────────────────────────
function LLMEvalRow({ eval: ev }: { eval: LLMEval }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      style={[llmStyles.evalCard, { borderColor: ev.modelColor + '44', backgroundColor: ev.modelColor + '08' }]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={llmStyles.evalHeader}>
        <View style={[llmStyles.modelBadge, { backgroundColor: ev.modelColor + '22', borderColor: ev.modelColor + '55' }]}>
          <Text style={[llmStyles.modelBadgeText, { color: ev.modelColor }]}>{ev.model}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[llmStyles.evalRec, { color: ev.agreesWithCHA ? theme.statusGreen : theme.statusYellow }]} numberOfLines={2}>
            {ev.recommendation}
          </Text>
          <View style={llmStyles.confRow}>
            <Text style={[llmStyles.confNum, { color: ev.modelColor }]}>{ev.confidence}%</Text>
            <ConfBar value={ev.confidence} color={ev.modelColor} />
          </View>
        </View>
        <MaterialIcons
          name={ev.agreesWithCHA ? 'check-circle' : 'info'}
          size={18}
          color={ev.agreesWithCHA ? theme.statusGreen : theme.statusYellow}
        />
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={18}
          color={theme.textMuted}
        />
      </View>
      {expanded && (
        <View style={llmStyles.evalExpanded}>
          <View style={llmStyles.agreeTag}>
            <MaterialIcons
              name={ev.agreesWithCHA ? 'handshake' : 'report-problem'}
              size={12}
              color={ev.agreesWithCHA ? theme.statusGreen : theme.statusYellow}
            />
            <Text style={[llmStyles.agreeTagText, { color: ev.agreesWithCHA ? theme.statusGreen : theme.statusYellow }]}>
              {ev.agreesWithCHA ? 'Agrees with CHA decision' : 'Differs from CHA decision'}
            </Text>
          </View>
          <Text style={llmStyles.evalReasoning}>{ev.reasoning}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Record Card ───────────────────────────────────────────────────────────────
function RecordCard({ record }: { record: ConsultationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const agreePct = Math.round((record.agreedCount / 3) * 100);

  return (
    <View style={llmStyles.recordCard}>
      {/* Header */}
      <Pressable style={llmStyles.recordHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={llmStyles.recordTitleRow}>
            <Text style={llmStyles.recordId}>{record.id}</Text>
            <Text style={llmStyles.recordRef}>· {record.patientRef}</Text>
            <SyncBadge status={record.syncStatus} />
          </View>
          <Text style={llmStyles.triggerText} numberOfLines={expanded ? undefined : 2}>
            {record.triggerReason}
          </Text>
          <Text style={llmStyles.recordTime}>{new Date(record.timestamp).toLocaleString()}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={theme.textMuted} />
      </Pressable>

      {/* Agreement summary row */}
      <View style={llmStyles.agreementRow}>
        <View style={llmStyles.agreementMinis}>
          {record.llmEvals.map((ev) => (
            <View
              key={ev.model}
              style={[llmStyles.agreementDot, {
                backgroundColor: ev.agreesWithCHA ? theme.statusGreen : theme.statusYellow,
              }]}
            />
          ))}
        </View>
        <Text style={llmStyles.agreementLabel}>
          {record.agreedCount}/3 LLMs agree with CHA
        </Text>
        <View style={[llmStyles.agreePctBadge, {
          backgroundColor: agreePct === 100 ? theme.statusGreen + '18' : theme.statusYellow + '18',
          borderColor: agreePct === 100 ? theme.statusGreen + '44' : theme.statusYellow + '44',
        }]}>
          <Text style={[llmStyles.agreePctText, {
            color: agreePct === 100 ? theme.statusGreen : theme.statusYellow,
          }]}>{agreePct}%</Text>
        </View>
      </View>

      {expanded && (
        <>
          {/* Metrics */}
          <View style={llmStyles.metricsRow}>
            {record.metrics.map((m) => (
              <View key={m.label} style={[llmStyles.metricChip, {
                borderColor: m.flag === 'red' ? theme.statusRed + '66'
                  : m.flag === 'amber' ? theme.statusYellow + '66' : theme.border,
                backgroundColor: m.flag === 'red' ? theme.statusRedBg
                  : m.flag === 'amber' ? theme.statusYellowBg : theme.surface,
              }]}>
                <Text style={[llmStyles.metricChipLabel, {
                  color: m.flag === 'red' ? theme.statusRed
                    : m.flag === 'amber' ? theme.statusYellow : theme.textMuted,
                }]}>{m.label}</Text>
                <Text style={[llmStyles.metricChipVal, {
                  color: m.flag === 'red' ? theme.statusRed
                    : m.flag === 'amber' ? theme.statusYellow : theme.textPrimary,
                }]}>{m.value}</Text>
              </View>
            ))}
          </View>

          {/* CHA decision */}
          <View style={llmStyles.chaBox}>
            <View style={llmStyles.chaBoxHeader}>
              <MaterialIcons name="person" size={14} color={theme.primary} />
              <Text style={llmStyles.chaBoxLabel}>CHA DECISION</Text>
            </View>
            <Text style={llmStyles.chaDecision}>{record.chaDecision}</Text>
            <Text style={llmStyles.chaReasoning}>{record.chaReasoning}</Text>
          </View>

          {/* LLM Evaluations */}
          <Text style={llmStyles.llmSectionLabel}>LLM PARALLEL EVALUATION</Text>
          {record.llmEvals.map((ev) => <LLMEvalRow key={ev.model} eval={ev} />)}
        </>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LLMValidationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const totalEvaluated = RECORDS.filter((r) => r.syncStatus === 'evaluated').length;
  const fullAgreement = RECORDS.filter((r) => r.agreedCount === 3).length;
  const partialAgreement = RECORDS.filter((r) => r.agreedCount > 0 && r.agreedCount < 3).length;
  const pending = RECORDS.filter((r) => r.syncStatus === 'pending').length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Silent LLM Validation</Text>
          <Text style={styles.navSub}>MediAid v10 · Parallel research track</Text>
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
        {/* Scientific framing banner */}
        <View style={styles.framingCard}>
          <View style={styles.framingIconRow}>
            <MaterialIcons name="science" size={22} color={theme.primary} />
            <Text style={styles.framingTitle}>Silent LLM Validation Track</Text>
          </View>
          <Text style={styles.framingDesc}>
            During borderline (amber) and escalated (red) CHA consultations, MediAid captures a structured record of the CHA's verbal reasoning and decision path. These records are evaluated offline against leading LLMs using a standardised African clinical context prompt.
          </Text>
          <View style={styles.framingTagRow}>
            <View style={[styles.framingTag, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '44' }]}>
              <MaterialIcons name="visibility-off" size={11} color={theme.primary} />
              <Text style={[styles.framingTagText, { color: theme.primary }]}>Never shown to CHA or patient</Text>
            </View>
            <View style={[styles.framingTag, { backgroundColor: '#10B98118', borderColor: '#10B98144' }]}>
              <MaterialIcons name="article" size={11} color="#10B981" />
              <Text style={[styles.framingTagText, { color: '#10B981' }]}>Publishable in Nature Digital Medicine</Text>
            </View>
          </View>
          <Text style={styles.framingPathway}>
            Modelled on PATH Rwanda Phase 3 RCT — first equivalent African clinical AI benchmarking study. Partner institutions: Google DeepMind, Microsoft Research, PATH.
          </Text>
        </View>

        {/* Stat row */}
        <View style={styles.statRow}>
          {[
            { label: 'Evaluated', value: totalEvaluated, color: theme.statusGreen, icon: 'check-circle' },
            { label: 'Full Agree', value: fullAgreement, color: theme.primary, icon: 'handshake' },
            { label: 'Partial', value: partialAgreement, color: theme.statusYellow, icon: 'info' },
            { label: 'Pending', value: pending, color: theme.textMuted, icon: 'schedule' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCell, { borderColor: s.color + '44' }]}>
              <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Models legend */}
        <View style={styles.modelsCard}>
          <Text style={styles.modelsTitle}>EVALUATION MODELS</Text>
          {[
            { model: 'GPT-4o', color: '#10A37F', note: 'OpenAI · African clinical context prompt · Cameroonian health system knowledge base' },
            { model: 'Gemini 2.5', color: '#4285F4', note: 'Google DeepMind · Resource-limited settings specialisation · Multilingual (Fulfulde, FR, EN)' },
            { model: 'Claude 3.7', color: '#7C3AED', note: 'Anthropic · Constitutional AI safety frame · WHO IMCI protocol alignment' },
          ].map((m) => (
            <View key={m.model} style={llmStyles.modelLegendRow}>
              <View style={[llmStyles.modelLegendDot, { backgroundColor: m.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[llmStyles.modelLegendName, { color: m.color }]}>{m.model}</Text>
                <Text style={llmStyles.modelLegendNote}>{m.note}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Records */}
        <Text style={styles.sectionTitle}>CONSULTATION RECORDS — {RECORDS.length} BORDERLINE CASES</Text>
        {RECORDS.map((r) => <RecordCard key={r.id} record={r} />)}

        {/* Publication pathway */}
        <View style={styles.pubCard}>
          <MaterialIcons name="auto-stories" size={18} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pubTitle}>Phase 1 Scientific Output</Text>
            <Text style={styles.pubDesc}>
              First published benchmark of LLM performance on CHW clinical reasoning records from rural Cameroon — submitted to Nature Digital Medicine or Lancet Digital Health. Opens collaboration pathways with Google DeepMind (Gemini Health), Microsoft Research, and PATH.
            </Text>
            <View style={styles.pubTagRow}>
              <View style={styles.pubTag}><Text style={styles.pubTagText}>Zero additional cost</Text></View>
              <View style={styles.pubTag}><Text style={styles.pubTagText}>Passive data collection</Text></View>
              <View style={styles.pubTag}><Text style={styles.pubTagText}>No field staff added</Text></View>
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
  v10BadgeText: { fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 0.5 },
  framingCard: {
    backgroundColor: theme.primary + '08', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  framingIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  framingTitle: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  framingDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 10 },
  framingTagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  framingTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  framingTagText: { fontSize: 10, fontWeight: '700' },
  framingPathway: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCell: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  modelsCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: theme.border, gap: 10,
  },
  modelsTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  pubCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#10B98108', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 4, borderWidth: 1, borderColor: '#10B98144',
  },
  pubTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  pubDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 10 },
  pubTagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pubTag: {
    backgroundColor: '#10B98118', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#10B98144',
  },
  pubTagText: { fontSize: 9, fontWeight: '700', color: '#10B981' },
});

const llmStyles = StyleSheet.create({
  recordCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, marginBottom: 12, overflow: 'hidden',
  },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14 },
  recordTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  recordId: { fontSize: 12, fontWeight: '800', color: theme.primary },
  recordRef: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  triggerText: { fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  recordTime: { fontSize: 10, color: theme.textMuted, marginTop: 3 },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1,
  },
  syncBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  agreementRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  agreementMinis: { flexDirection: 'row', gap: 4 },
  agreementDot: { width: 10, height: 10, borderRadius: 5 },
  agreementLabel: { flex: 1, fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  agreePctBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1,
  },
  agreePctText: { fontSize: 11, fontWeight: '800' },
  metricsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 14, marginBottom: 12,
  },
  metricChip: {
    borderRadius: theme.radius.small, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  metricChipLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricChipVal: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  chaBox: {
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: theme.primary + '08', borderRadius: theme.radius.medium,
    padding: 12, borderWidth: 1, borderColor: theme.primary + '33',
  },
  chaBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  chaBoxLabel: { fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 1, textTransform: 'uppercase' },
  chaDecision: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  chaReasoning: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  llmSectionLabel: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginHorizontal: 14, marginBottom: 8,
  },
  evalCard: {
    borderRadius: theme.radius.medium, borderWidth: 1,
    padding: 12, marginHorizontal: 14, marginBottom: 8,
  },
  evalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, flexShrink: 0,
  },
  modelBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  evalRec: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  confNum: { fontSize: 11, fontWeight: '800', width: 32 },
  evalExpanded: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: theme.border, gap: 8,
  },
  agreeTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  agreeTagText: { fontSize: 11, fontWeight: '700' },
  evalReasoning: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  modelLegendRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  modelLegendDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  modelLegendName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  modelLegendNote: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
});
