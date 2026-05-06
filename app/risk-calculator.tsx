// MediAid — Offline Clinical Risk Calculators
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CriterionItem {
  id: string;
  label: string;
  detail?: string;
  points: number;
}

interface Calculator {
  id: string;
  name: string;
  acronym: string;
  condition: string;
  icon: string;
  color: string;
  description: string;
  citation: string;
  criteria: CriterionItem[];
  interpret: (score: number) => { label: string; color: string; action: string; risk?: string };
}

// ─── Calculators ──────────────────────────────────────────────────────────────
const CALCULATORS: Calculator[] = [
  {
    id: 'wells_pe',
    name: 'WELLS Score',
    acronym: 'PE',
    condition: 'Pulmonary Embolism',
    icon: 'air',
    color: '#F97316',
    description: 'Estimates pre-test probability of Pulmonary Embolism. Use to decide on D-dimer vs direct CT-PA.',
    citation: 'Wells PS et al. Ann Intern Med 2001 · ESC PE Guidelines 2019',
    criteria: [
      { id: 'dvt_signs', label: 'Clinical signs/symptoms of DVT', detail: 'Leg swelling, pain on palpation of deep veins', points: 3 },
      { id: 'alt_dx_less', label: 'PE is #1 diagnosis OR equally likely', detail: 'Clinical judgment — PE most likely diagnosis', points: 3 },
      { id: 'hr_gt100', label: 'Heart rate > 100 BPM', detail: 'From MediAid HR reading', points: 1.5 },
      { id: 'immobile', label: 'Immobilization ≥3 days OR surgery in past 4 weeks', detail: 'Recent surgery, bed rest, long travel', points: 1.5 },
      { id: 'prev_dvt_pe', label: 'Previous DVT or PE', detail: 'Confirmed prior episode', points: 1.5 },
      { id: 'haemoptysis', label: 'Haemoptysis (coughing blood)', detail: 'Any blood in sputum', points: 1 },
      { id: 'malignancy', label: 'Active malignancy (treatment within 6 months)', detail: 'Or receiving palliative care', points: 1 },
    ],
    interpret: (score) => {
      if (score <= 1) return { label: 'LOW Probability', color: theme.statusGreen, action: 'D-dimer test. If negative, PE excluded. If positive, CT-PA required.', risk: '1.3% PE prevalence' };
      if (score <= 6) return { label: 'MODERATE Probability', color: theme.statusYellow, action: 'D-dimer recommended. If elevated, proceed to CT-PA. Close clinical monitoring required.', risk: '16.2% PE prevalence' };
      return { label: 'HIGH Probability', color: theme.statusRed, action: 'CT-PA IMMEDIATELY. Empirical anticoagulation may be warranted before imaging. Emergency referral.', risk: '37.5% PE prevalence' };
    },
  },
  {
    id: 'cha2ds2',
    name: 'CHA₂DS₂-VASc',
    acronym: 'AFib Stroke',
    condition: 'AFib Stroke Risk',
    icon: 'monitor-heart',
    color: theme.primary,
    description: 'Estimates annual stroke risk in non-valvular Atrial Fibrillation. Guides anticoagulation decisions.',
    citation: 'Lip GYH et al. Chest 2010 · ESC AFib Guidelines 2020',
    criteria: [
      { id: 'chf', label: 'Congestive Heart Failure / LV dysfunction', detail: 'Known HFrEF, HFpEF, or LV systolic dysfunction', points: 1 },
      { id: 'hypertension', label: 'Hypertension', detail: 'Resting BP > 140/90 mmHg or on antihypertensives', points: 1 },
      { id: 'age_75', label: 'Age ≥ 75 years', detail: '2 points — highest age risk', points: 2 },
      { id: 'diabetes', label: 'Diabetes Mellitus', detail: 'Type 1, Type 2, or treatment with insulin/oral agents', points: 1 },
      { id: 'stroke_prev', label: 'Prior Stroke / TIA / Thromboembolism', detail: '2 points — strongest single predictor', points: 2 },
      { id: 'vascular_disease', label: 'Vascular disease', detail: 'Prior MI, peripheral arterial disease, or aortic plaque', points: 1 },
      { id: 'age_65_74', label: 'Age 65–74 years', detail: 'Intermediate age group', points: 1 },
      { id: 'female_sex', label: 'Female sex category', detail: 'Biological female — adds 1 point', points: 1 },
    ],
    interpret: (score) => {
      if (score === 0) return { label: 'VERY LOW Risk (Male) / LOW Risk (Female)', color: theme.statusGreen, action: 'Anticoagulation NOT recommended. Aspirin not routinely indicated. Annual re-assessment.', risk: '0% annual stroke rate' };
      if (score === 1) return { label: 'LOW-MODERATE Risk', color: theme.statusYellow, action: 'Consider anticoagulation (OAC preferred over aspirin). Discuss bleeding risk (HAS-BLED). Physician review.', risk: '1.3% annual stroke rate' };
      if (score <= 3) return { label: 'MODERATE Risk', color: '#F97316', action: 'Oral anticoagulation RECOMMENDED (NOAC preferred over warfarin). Warfarin if INR monitoring available. Refer to physician.', risk: `${score === 2 ? '2.2' : '3.2'}% annual stroke rate` };
      return { label: 'HIGH Risk', color: theme.statusRed, action: 'Oral anticoagulation STRONGLY RECOMMENDED. Assess bleeding risk. Long-term anticoagulation essential. Emergency physician review if new AFib.', risk: `${Math.min(score * 1.8, 15).toFixed(1)}% annual stroke rate` };
    },
  },
  {
    id: 'malaria_severity',
    name: 'WHO Malaria Severity',
    acronym: 'Malaria',
    condition: 'Malaria Severity Score',
    icon: 'bug-report',
    color: theme.statusYellow,
    description: 'WHO criteria for severe malaria in sub-Saharan Africa. Each criterion = refer for IV artesunate.',
    citation: 'WHO Malaria Treatment Guidelines 2022 · MINSANTE Cameroon 2021',
    criteria: [
      { id: 'consciousness', label: 'Impaired consciousness / coma', detail: 'GCS < 11 or Blantyre Coma Scale < 3 in children', points: 1 },
      { id: 'prostration', label: 'Prostration', detail: 'Inability to sit/stand unsupported in previously mobile patient', points: 1 },
      { id: 'multiple_convulsions', label: 'Multiple convulsions (≥2 in 24h)', detail: 'Witnessed or reported seizures', points: 1 },
      { id: 'resp_distress', label: 'Respiratory distress (RR > 30)', detail: 'From MediAid Respiratory Rate reading — acidotic breathing', points: 1 },
      { id: 'abnormal_bleeding', label: 'Abnormal bleeding', detail: 'Spontaneous bleeding from gums, nose, petechiae', points: 1 },
      { id: 'jaundice', label: 'Clinical jaundice', detail: 'Yellow sclera or skin — hepatic involvement', points: 1 },
      { id: 'haemoglobinuria', label: 'Haemoglobinuria (black water fever)', detail: 'Dark/black urine — massive haemolysis', points: 1 },
      { id: 'severe_anaemia', label: 'Severe anaemia (Hgb < 7 g/dL)', detail: 'From MediAid haemoglobin reading', points: 1 },
      { id: 'hypoglycaemia', label: 'Hypoglycaemia (RBS < 2.2 mmol/L)', detail: 'Sweating, confusion, coma without fever', points: 1 },
    ],
    interpret: (score) => {
      if (score === 0) return { label: 'Uncomplicated Malaria', color: theme.statusGreen, action: 'Treat with Artemether-Lumefantrine (AL) orally. Monitor at 24h, 48h, 72h. Refer if no improvement in 72h.', risk: 'Low mortality' };
      if (score <= 2) return { label: 'Severe Malaria — Urgent Referral', color: theme.statusYellow, action: 'REFER SAME DAY for IV Artesunate. Pre-referral rectal artesunate (10mg/kg) if > 2 hours to hospital. Call hospital.', risk: 'Moderate mortality — 10–20%' };
      return { label: 'CRITICAL Severe Malaria — EMERGENCY', color: theme.statusRed, action: 'IMMEDIATE emergency transport. Pre-referral IM Artesunate or rectal artesunate. Ensure airway. Do NOT delay. Call +237 233 362 450.', risk: `HIGH mortality — up to ${Math.min(score * 8, 40)}%` };
    },
  },
  {
    id: 'bishop',
    name: 'Bishop Score',
    acronym: 'Obstetric',
    condition: 'Cervical Ripening (Labour)',
    icon: 'child-care',
    color: '#EC4899',
    description: 'Assesses cervical readiness for labour induction. Used in ante-natal care for induction decisions.',
    citation: 'Bishop EH. Obstet Gynecol 1964 · WHO ANC Guidelines 2016',
    criteria: [
      { id: 'dilation_0', label: 'Cervical dilation: Closed (0 cm)', detail: '0 points — completely closed', points: 0 },
      { id: 'dilation_1', label: 'Cervical dilation: 1–2 cm', detail: '1 point — early dilation', points: 1 },
      { id: 'dilation_3', label: 'Cervical dilation: 3–4 cm', detail: '2 points — active dilation', points: 2 },
      { id: 'dilation_5', label: 'Cervical dilation: ≥5 cm', detail: '3 points — advanced dilation', points: 3 },
      { id: 'effacement_30', label: 'Effacement: 0–30%', detail: '0 points — no effacement', points: 0 },
      { id: 'effacement_60', label: 'Effacement: 40–60%', detail: '1 point — partial effacement', points: 1 },
      { id: 'effacement_80', label: 'Effacement: 70–80%', detail: '2 points — near complete', points: 2 },
      { id: 'effacement_100', label: 'Effacement: ≥80%', detail: '3 points — complete effacement', points: 3 },
      { id: 'station_m3', label: 'Station: -3', detail: '0 points — high presenting part', points: 0 },
      { id: 'station_m2', label: 'Station: -2', detail: '1 point', points: 1 },
      { id: 'station_m1_0', label: 'Station: -1/0', detail: '2 points — engaged', points: 2 },
      { id: 'station_p', label: 'Station: +1/+2', detail: '3 points — low presenting part', points: 3 },
      { id: 'consistency_firm', label: 'Consistency: Firm', detail: '0 points', points: 0 },
      { id: 'consistency_medium', label: 'Consistency: Medium', detail: '1 point', points: 1 },
      { id: 'consistency_soft', label: 'Consistency: Soft', detail: '2 points', points: 2 },
      { id: 'position_post', label: 'Position: Posterior', detail: '0 points', points: 0 },
      { id: 'position_mid', label: 'Position: Mid', detail: '1 point', points: 1 },
      { id: 'position_ant', label: 'Position: Anterior', detail: '2 points', points: 2 },
    ],
    interpret: (score) => {
      if (score < 6) return { label: 'Unfavorable Cervix', color: theme.statusRed, action: 'Cervical ripening required before induction. Consider prostaglandins or mechanical methods. Obstetric referral required.', risk: 'Higher induction failure rate' };
      if (score <= 8) return { label: 'Moderately Favorable', color: theme.statusYellow, action: 'Induction with oxytocin may proceed. Monitor progress closely. Obstetric supervision recommended.', risk: 'Moderate success rate' };
      return { label: 'Favorable Cervix', color: theme.statusGreen, action: 'Favorable for induction — cervix is ripe. Oxytocin induction appropriate. Routine intrapartum monitoring.', risk: 'High induction success rate' };
    },
  },
  {
    id: 'nihss',
    name: 'Simplified Stroke',
    acronym: 'Stroke',
    condition: 'Stroke Recognition',
    icon: 'psychology',
    color: '#A78BFA',
    description: 'Simplified FAST+ stroke recognition checklist for community health settings. Each positive = act immediately.',
    citation: 'Kothari R et al. Ann Emerg Med 1999 · WHO Stroke Response · Stroke Alliance Africa 2023',
    criteria: [
      { id: 'face_droop', label: 'F — Face drooping on one side', detail: 'Ask patient to smile. Is one side drooping or numb?', points: 1 },
      { id: 'arm_weak', label: 'A — Arm weakness (unilateral)', detail: 'Ask to raise both arms. Does one arm drift down?', points: 1 },
      { id: 'speech', label: 'S — Speech difficulty', detail: 'Ask to repeat "The sun is shining." Is speech slurred or strange?', points: 1 },
      { id: 'sudden_onset', label: 'T — Sudden onset (time of symptom)', detail: 'Symptoms appeared suddenly, not gradually', points: 1 },
      { id: 'vision_loss', label: '+ Vision loss (unilateral or bilateral)', detail: 'Sudden vision change, double vision, or blindness', points: 1 },
      { id: 'severe_headache', label: '+ Sudden severe headache', detail: '"Worst headache of my life" — may indicate subarachnoid haemorrhage', points: 1 },
      { id: 'balance', label: '+ Balance / coordination loss', detail: 'Sudden dizziness, loss of balance, or unsteady gait', points: 1 },
    ],
    interpret: (score) => {
      if (score === 0) return { label: 'No Stroke Signs Detected', color: theme.statusGreen, action: 'No FAST+ criteria met. Continue monitoring. Re-assess if symptoms develop. Advise on stroke warning signs.', risk: 'No immediate stroke risk identified' };
      if (score === 1) return { label: 'Possible TIA / Minor Stroke', color: theme.statusYellow, action: 'Single FAST criterion — possible TIA. Refer to clinic same day. Do NOT give aspirin before confirmed diagnosis. Time-critical.', risk: 'TIA — 10% stroke risk within 48h' };
      if (score <= 3) return { label: 'LIKELY STROKE — Urgent Referral', color: '#F97316', action: 'Multiple FAST criteria = high stroke probability. EMERGENCY referral. Note exact time of symptom onset. Bamenda Regional Hospital: +237 233 362 450.', risk: 'High stroke probability — act within 4.5h' };
      return { label: 'PROBABLE STROKE — EMERGENCY', color: theme.statusRed, action: 'IMMEDIATE emergency transport. Note time onset precisely (thrombolysis window = 4.5h from onset). Do NOT give food/water. Keep patient flat. Call hospital NOW.', risk: '4.5-hour thrombolysis window — every minute counts' };
    },
  },
];

// ─── Animated Result Bar ──────────────────────────────────────────────────────
function ResultBar({ score, maxScore, color }: { score: number; maxScore: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: maxScore > 0 ? score / maxScore : 0,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score, maxScore]);
  return (
    <View style={rbStyles.track}>
      <Animated.View
        style={[
          rbStyles.fill,
          {
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}
const rbStyles = StyleSheet.create({
  track: { height: 10, backgroundColor: theme.border, borderRadius: 5, overflow: 'hidden', marginVertical: 8 },
  fill: { height: '100%', borderRadius: 5 },
});

// ─── Calculator Detail View ───────────────────────────────────────────────────
function CalculatorView({ calc, onBack }: { calc: Calculator; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const score = Array.from(selected).reduce((sum, id) => {
    const item = calc.criteria.find((c) => c.id === id);
    return sum + (item?.points ?? 0);
  }, 0);

  const maxScore = calc.criteria.reduce((sum, c) => sum + c.points, 0);
  const result = calc.interpret(score);

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(new Set());
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>{calc.name}</Text>
          <Text style={styles.navSub}>{calc.condition}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.8 }]}
          onPress={reset}
        >
          <MaterialIcons name="refresh" size={16} color={theme.textMuted} />
          <Text style={styles.resetBtnText}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={[styles.descCard, { borderColor: calc.color + '44', backgroundColor: calc.color + '0D' }]}>
          <MaterialIcons name={calc.icon as any} size={22} color={calc.color} />
          <Text style={[styles.descText, { color: calc.color + 'DD' }]}>{calc.description}</Text>
        </View>

        {/* Criteria */}
        <Text style={styles.sectionTitle}>CLINICAL CRITERIA — TAP TO TOGGLE</Text>
        {calc.criteria.map((c) => {
          const isSelected = selected.has(c.id);
          return (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.criterionCard,
                isSelected && { borderColor: calc.color, backgroundColor: calc.color + '12' },
                pressed && { opacity: 0.88 },
              ]}
              onPress={() => toggle(c.id)}
            >
              <View style={[styles.checkbox, isSelected && { backgroundColor: calc.color, borderColor: calc.color }]}>
                {isSelected && <MaterialIcons name="check" size={14} color="#FFF" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.criterionLabel, isSelected && { color: calc.color, fontWeight: '700' }]}>
                  {c.label}
                </Text>
                {c.detail && (
                  <Text style={styles.criterionDetail}>{c.detail}</Text>
                )}
              </View>
              <View style={[styles.pointsBadge, { backgroundColor: isSelected ? calc.color : theme.background, borderColor: isSelected ? calc.color : theme.border }]}>
                <Text style={[styles.pointsText, { color: isSelected ? '#FFF' : theme.textMuted }]}>
                  +{c.points}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* Score + Result */}
        <Text style={styles.sectionTitle}>RESULT</Text>
        <View style={[styles.resultCard, { borderColor: result.color + '55' }]}>
          {/* Score display */}
          <View style={styles.scoreRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreLabel}>TOTAL SCORE</Text>
              <Text style={[styles.scoreNum, { color: result.color }]}>{score}</Text>
              <Text style={styles.scoreMax}>of {maxScore} maximum</Text>
            </View>
            <View style={[styles.resultBadge, { backgroundColor: result.color + '18', borderColor: result.color + '55' }]}>
              <MaterialIcons
                name={
                  result.color === theme.statusRed ? 'warning' :
                  result.color === theme.statusYellow ? 'info' : 'check-circle'
                }
                size={24}
                color={result.color}
              />
            </View>
          </View>

          <ResultBar score={score} maxScore={maxScore} color={result.color} />

          {/* Result interpretation */}
          <View style={[styles.interpretBanner, { backgroundColor: result.color + '12', borderColor: result.color + '44' }]}>
            <Text style={[styles.interpretLabel, { color: result.color }]}>{result.label}</Text>
            {result.risk && (
              <Text style={[styles.interpretRisk, { color: result.color + 'AA' }]}>{result.risk}</Text>
            )}
          </View>

          {/* Action */}
          <View style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <MaterialIcons name="local-hospital" size={14} color={theme.primary} />
              <Text style={styles.actionTitle}>RECOMMENDED ACTION</Text>
            </View>
            <Text style={styles.actionText}>{result.action}</Text>
          </View>
        </View>

        {/* Citation */}
        <View style={styles.citationBox}>
          <MaterialIcons name="science" size={12} color={theme.textMuted} />
          <Text style={styles.citationText}>{calc.citation}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RiskCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCalc = CALCULATORS.find((c) => c.id === selectedId);
  if (selectedCalc) {
    return <CalculatorView calc={selectedCalc} onBack={() => setSelectedId(null)} />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Clinical Risk Calculators</Text>
          <Text style={styles.navSub}>5 validated scoring tools · 100% offline</Text>
        </View>
        <View style={styles.offlineBadge}>
          <MaterialIcons name="cloud-off" size={12} color={theme.statusGreen} />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introBanner}>
          <MaterialIcons name="calculate" size={22} color={theme.primary} />
          <Text style={styles.introText}>
            Evidence-based clinical decision support tools for Community Health Aides. Tap any calculator to begin. All scores are computed locally with no internet required.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{CALCULATORS.length} VALIDATED CALCULATORS</Text>

        {CALCULATORS.map((calc) => (
          <Pressable
            key={calc.id}
            style={({ pressed }) => [styles.calcCard, { borderLeftColor: calc.color }, pressed && { opacity: 0.88 }]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedId(calc.id);
            }}
          >
            <View style={[styles.calcIconCircle, { backgroundColor: calc.color + '18', borderColor: calc.color + '44' }]}>
              <MaterialIcons name={calc.icon as any} size={24} color={calc.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.calcHeader}>
                <Text style={styles.calcName}>{calc.name}</Text>
                <View style={[styles.acroTag, { backgroundColor: calc.color + '18', borderColor: calc.color + '44' }]}>
                  <Text style={[styles.acroText, { color: calc.color }]}>{calc.acronym}</Text>
                </View>
              </View>
              <Text style={styles.calcCondition}>{calc.condition}</Text>
              <Text style={styles.calcDesc} numberOfLines={2}>{calc.description}</Text>
              <Text style={styles.calcMeta}>{calc.criteria.length} criteria · Max {calc.criteria.reduce((s, c) => s + c.points, 0)} points</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        ))}

        <View style={styles.footerCard}>
          <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
          <Text style={styles.footerText}>
            These calculators are clinical decision-support tools. Results must be interpreted by a qualified health professional in the context of the full clinical picture. Do not substitute for clinical judgment or replace physician evaluation.
          </Text>
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
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  offlineBadgeText: { fontSize: 10, fontWeight: '700', color: theme.statusGreen },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.border,
  },
  resetBtnText: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  introBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.primary + '12', borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  introText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
  calcCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  calcIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  calcHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  calcName: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  acroTag: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1,
  },
  acroText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  calcCondition: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 2 },
  calcDesc: { fontSize: 11, color: theme.textMuted, lineHeight: 16, marginBottom: 5 },
  calcMeta: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },

  footerCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: theme.border,
  },
  footerText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 17 },

  // Calculator Detail
  descCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: theme.radius.medium, padding: 14, marginTop: 14, marginBottom: 4,
    borderWidth: 1,
  },
  descText: { flex: 1, fontSize: 13, lineHeight: 20 },
  criterionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: theme.border,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  criterionLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  criterionDetail: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  pointsBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, minWidth: 32, alignItems: 'center',
  },
  pointsText: { fontSize: 11, fontWeight: '800' },

  resultCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 16, borderWidth: 1, gap: 10,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  scoreNum: { fontSize: 52, fontWeight: '900', lineHeight: 60 },
  scoreMax: { fontSize: 12, color: theme.textMuted },
  resultBadge: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  interpretBanner: {
    borderRadius: theme.radius.medium, padding: 12,
    borderWidth: 1,
  },
  interpretLabel: { fontSize: 16, fontWeight: '800' },
  interpretRisk: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  actionCard: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 12, borderWidth: 1, borderColor: theme.border,
  },
  actionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  actionTitle: { fontSize: 10, fontWeight: '700', color: theme.primary, letterSpacing: 1, textTransform: 'uppercase' },
  actionText: { fontSize: 13, color: theme.textPrimary, lineHeight: 20 },
  citationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  citationText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 17 },
});
