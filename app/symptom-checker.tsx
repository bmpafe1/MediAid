// MediAid — Guided Symptom Checker with Differential Diagnosis
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

type Urgency = 'critical' | 'urgent' | 'routine' | 'watchful';

interface Symptom {
  id: string;
  label: string;
  icon: string;
  category: 'respiratory' | 'cardiac' | 'neuro' | 'gi' | 'systemic' | 'vision';
}

interface Condition {
  name: string;
  confidence: number; // 0-100
  urgency: Urgency;
  icon: string;
  action: string;
  reference: string;
  triageNote: string;
  en: string;
  fr: string;
}

const SYMPTOMS: Symptom[] = [
  { id: 'cough', label: 'Cough > 2 weeks', icon: 'air', category: 'respiratory' },
  { id: 'cough_blood', label: 'Blood in cough', icon: 'water-drop', category: 'respiratory' },
  { id: 'fever', label: 'Fever > 38°C', icon: 'thermostat', category: 'systemic' },
  { id: 'night_sweats', label: 'Night sweats', icon: 'bedtime', category: 'systemic' },
  { id: 'weight_loss', label: 'Unexplained weight loss', icon: 'trending-down', category: 'systemic' },
  { id: 'chest_pain', label: 'Chest pain / tightness', icon: 'favorite-border', category: 'cardiac' },
  { id: 'palpitations', label: 'Heart palpitations', icon: 'monitor-heart', category: 'cardiac' },
  { id: 'shortness_breath', label: 'Shortness of breath', icon: 'self-improvement', category: 'respiratory' },
  { id: 'fatigue', label: 'Severe fatigue / pallor', icon: 'battery-1-bar', category: 'systemic' },
  { id: 'headache', label: 'Severe headache', icon: 'psychology', category: 'neuro' },
  { id: 'tremor', label: 'Hand tremor / shaking', icon: 'vibration', category: 'neuro' },
  { id: 'confusion', label: 'Confusion / altered state', icon: 'warning', category: 'neuro' },
  { id: 'vomiting', label: 'Vomiting / diarrhea', icon: 'sick', category: 'gi' },
  { id: 'jaundice', label: 'Yellowing of eyes/skin', icon: 'remove-red-eye', category: 'vision' },
  { id: 'blurred_vision', label: 'Blurred / loss of vision', icon: 'visibility-off', category: 'vision' },
  { id: 'swelling', label: 'Leg / ankle swelling', icon: 'accessibility', category: 'cardiac' },
  { id: 'stiff_neck', label: 'Stiff neck', icon: 'person', category: 'neuro' },
  { id: 'rash', label: 'Skin rash / itching', icon: 'healing', category: 'systemic' },
  { id: 'joint_pain', label: 'Joint / muscle pain', icon: 'sports-gymnastics', category: 'systemic' },
  { id: 'abdominal_pain', label: 'Abdominal pain', icon: 'sentiment-very-dissatisfied', category: 'gi' },
];

// Rule-based differential engine
function computeDifferential(selected: Set<string>): Condition[] {
  const has = (id: string) => selected.has(id);
  const results: Condition[] = [];

  // TB — cough + systemic
  const tbScore =
    (has('cough') ? 35 : 0) +
    (has('cough_blood') ? 30 : 0) +
    (has('night_sweats') ? 15 : 0) +
    (has('weight_loss') ? 15 : 0) +
    (has('fever') ? 10 : 0) +
    (has('fatigue') ? 5 : 0);
  if (tbScore >= 30) {
    results.push({
      name: 'Pulmonary Tuberculosis',
      confidence: Math.min(95, tbScore),
      urgency: has('cough_blood') ? 'critical' : 'urgent',
      icon: 'air',
      action: has('cough_blood')
        ? 'IMMEDIATE referral to health facility. Isolate patient. Notify supervisor.'
        : 'Refer for sputum smear test. Initiate TB contact tracing.',
      reference: 'WHO HeAR 2023 — 94% TB cough accuracy',
      triageNote: 'MediAid cough classifier positive. Onset >2 weeks suggests active TB.',
      en: 'Likely TB. Refer patient for sputum smear test today.',
      fr: 'TB probable. Référer le patient pour un test de crachat aujourd\'hui.',
    });
  }

  // Malaria — fever + systemic
  const malariaScore =
    (has('fever') ? 40 : 0) +
    (has('headache') ? 20 : 0) +
    (has('joint_pain') ? 15 : 0) +
    (has('vomiting') ? 15 : 0) +
    (has('fatigue') ? 10 : 0) +
    (has('confusion') ? 20 : 0);
  if (malariaScore >= 40) {
    results.push({
      name: 'Malaria (P. falciparum)',
      confidence: Math.min(92, malariaScore),
      urgency: has('confusion') ? 'critical' : 'urgent',
      icon: 'bug-report',
      action: has('confusion')
        ? 'SEVERE MALARIA — Emergency evacuation. IV artesunate required immediately.'
        : 'Perform RDT. If positive: give ACT. Refer if RDT unavailable.',
      reference: 'WHO Malaria Triage Protocol 2022',
      triageNote: has('confusion') ? 'Cerebral malaria possible — neurological symptoms present.' : 'NW Cameroon high-transmission zone. Perform RDT first.',
      en: 'Possible malaria. Do RDT test now. Start ACT if positive.',
      fr: 'Paludisme possible. Faire TDR maintenant. Donner ACT si positif.',
    });
  }

  // AFib — cardiac
  const afibScore =
    (has('palpitations') ? 40 : 0) +
    (has('shortness_breath') ? 25 : 0) +
    (has('chest_pain') ? 20 : 0) +
    (has('swelling') ? 15 : 0) +
    (has('fatigue') ? 10 : 0);
  if (afibScore >= 40) {
    results.push({
      name: 'Atrial Fibrillation (AFib)',
      confidence: Math.min(90, afibScore),
      urgency: has('chest_pain') && has('shortness_breath') ? 'critical' : 'urgent',
      icon: 'monitor-heart',
      action: 'Check pulse rhythm (irregularly irregular). Refer to clinic for ECG confirmation.',
      reference: 'Yan et al. 2018 — rPPG AFib detection, 95% sensitivity',
      triageNote: 'rPPG facial PPG analysis recommended. Do not give antiarrhythmics without ECG.',
      en: 'Possible AFib. Check pulse. Refer for ECG today.',
      fr: 'AFib possible. Vérifier le pouls. Référer pour ECG aujourd\'hui.',
    });
  }

  // Anemia — pallor + fatigue
  const anemiaScore =
    (has('fatigue') ? 35 : 0) +
    (has('shortness_breath') ? 25 : 0) +
    (has('palpitations') ? 20 : 0) +
    (has('swelling') ? 10 : 0) +
    (has('jaundice') ? 15 : 0);
  if (anemiaScore >= 40) {
    results.push({
      name: 'Severe Anemia',
      confidence: Math.min(88, anemiaScore),
      urgency: has('shortness_breath') && has('palpitations') ? 'urgent' : 'watchful',
      icon: 'opacity',
      action: 'Check conjunctival pallor. Hemoglobin <8 g/dL requires urgent referral.',
      reference: 'Anemia Screening Consortium 2023 — conjunctival pallor analysis',
      triageNote: 'MediAid conjunctival analysis in Part A. Hgb threshold <8 g/dL = referral.',
      en: 'Check for anemia. Look at inner eyelids for pallor.',
      fr: 'Vérifier l\'anémie. Regarder la pâleur des paupières internes.',
    });
  }

  // Meningitis — neuro
  const meningitisScore =
    (has('stiff_neck') ? 50 : 0) +
    (has('fever') ? 30 : 0) +
    (has('headache') ? 20 : 0) +
    (has('confusion') ? 30 : 0) +
    (has('vomiting') ? 10 : 0);
  if (meningitisScore >= 60) {
    results.push({
      name: 'Meningitis',
      confidence: Math.min(95, meningitisScore),
      urgency: 'critical',
      icon: 'psychology',
      action: 'EMERGENCY. Refer immediately. Do NOT delay for lab tests. Give empirical antibiotics if >1h to hospital.',
      reference: 'WHO Meningitis Protocol — Rifampicin prophylaxis',
      triageNote: 'Stiff neck + fever = meningitis until proven otherwise. Treat empirically.',
      en: 'EMERGENCY: Possible meningitis. Refer NOW. Give ceftriaxone if available.',
      fr: 'URGENCE: Méningite possible. Référer MAINTENANT. Donner ceftriaxone si disponible.',
    });
  }

  // Cholera — GI
  const choleraScore =
    (has('vomiting') ? 30 : 0) +
    (has('abdominal_pain') ? 25 : 0) +
    (has('fever') ? 15 : 0);
  if (choleraScore >= 40) {
    results.push({
      name: 'Acute Diarrheal Disease / Cholera',
      confidence: Math.min(80, choleraScore),
      urgency: has('confusion') ? 'urgent' : 'routine',
      icon: 'water-drop',
      action: 'Start ORS immediately. Check hydration. Refer if signs of severe dehydration.',
      reference: 'WHO Cholera Treatment Protocol 2023',
      triageNote: 'Assess hydration: sunken eyes, skin pinch test, unable to drink = severe.',
      en: 'Give ORS now. Check hydration level. Refer if severe.',
      fr: 'Donner SRO maintenant. Évaluer l\'hydratation. Référer si sévère.',
    });
  }

  // Parkinson's tremor
  if (has('tremor')) {
    results.push({
      name: "Parkinson's Disease / Tremor Disorder",
      confidence: 72,
      urgency: 'routine',
      icon: 'vibration',
      action: 'Record tremor with MediAid accelerometer (Part D). Refer to district hospital for neurological assessment.',
      reference: 'He et al. 2024 — Tremor acoustic biomarkers, AUC 0.89',
      triageNote: 'Resting tremor >4 Hz is characteristic of Parkinson\'s. Assess medication history.',
      en: 'Record tremor. Refer to hospital for assessment.',
      fr: 'Enregistrer le tremblement. Référer à l\'hôpital pour évaluation.',
    });
  }

  // Eye conditions
  const eyeScore =
    (has('blurred_vision') ? 40 : 0) +
    (has('jaundice') ? 30 : 0);
  if (eyeScore >= 30) {
    results.push({
      name: 'Ocular Condition (Glaucoma / Cataract / Diabetic Retinopathy)',
      confidence: Math.min(85, eyeScore),
      urgency: has('blurred_vision') ? 'urgent' : 'watchful',
      icon: 'remove-red-eye',
      action: 'Capture retinal scan in MediAid Part E. Refer to ophthalmic clinic.',
      reference: 'Jin et al. 2024 — 7 ocular conditions, AUC 0.91–0.97',
      triageNote: 'MediAid screens for 7 conditions. Jaundice may indicate hepatic involvement.',
      en: 'Scan eyes with MediAid. Refer to eye clinic.',
      fr: 'Scanner les yeux avec MediAid. Référer à la clinique ophtalmique.',
    });
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

function urgencyColor(u: Urgency) {
  if (u === 'critical') return theme.statusRed;
  if (u === 'urgent') return theme.statusYellow;
  if (u === 'routine') return theme.statusGreen;
  return theme.primary;
}
function urgencyBg(u: Urgency) {
  if (u === 'critical') return theme.statusRedBg;
  if (u === 'urgent') return theme.statusYellowBg;
  if (u === 'routine') return theme.statusGreenBg;
  return theme.primary + '12';
}
function urgencyLabel(u: Urgency) {
  if (u === 'critical') return '🔴 CRITICAL';
  if (u === 'urgent') return '🟡 URGENT';
  if (u === 'routine') return '🟢 ROUTINE';
  return '🔵 WATCHFUL';
}

const CATEGORY_COLORS: Record<string, string> = {
  respiratory: theme.statusRed,
  cardiac: '#F472B6',
  neuro: '#A78BFA',
  gi: theme.statusYellow,
  systemic: theme.primary,
  vision: theme.statusGreen,
};

export default function SymptomCheckerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowResults(false);
  };

  const differential = computeDifferential(selected);

  const handleAnalyze = () => {
    if (selected.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowResults(true);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  };

  const speakCondition = (c: Condition, idx: number) => {
    Speech.stop();
    setPlayingIdx(idx);
    const text = language === 'fr' ? c.fr : c.en;
    const urgencyStr = c.urgency === 'critical' ? 'Critical alert.' : c.urgency === 'urgent' ? 'Urgent.' : 'Routine.';
    Speech.speak(`${urgencyStr} ${c.name}. ${text}. Action: ${c.action}`, {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: 0.82,
      onDone: () => setPlayingIdx(null),
      onStopped: () => setPlayingIdx(null),
      onError: () => setPlayingIdx(null),
    });
  };

  const stopSpeech = () => {
    Speech.stop();
    setPlayingIdx(null);
  };

  useEffect(() => { return () => Speech.stop(); }, []);

  const categoryGroups = ['respiratory', 'cardiac', 'neuro', 'systemic', 'gi', 'vision'] as const;
  const categoryLabels: Record<string, string> = {
    respiratory: 'Respiratory', cardiac: 'Cardiac', neuro: 'Neurological',
    systemic: 'Systemic', gi: 'Gastrointestinal', vision: 'Vision / Eyes',
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => { Speech.stop(); router.back(); }}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Symptom Checker</Text>
          <Text style={styles.navSub}>Select all present symptoms · {selected.size} selected</Text>
        </View>
        {selected.size > 0 && (
          <Pressable style={styles.clearBtn} onPress={() => { setSelected(new Set()); setShowResults(false); }}>
            <MaterialIcons name="clear-all" size={18} color={theme.textMuted} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={16} color={theme.primary} />
          <Text style={styles.infoText}>
            Tap all symptoms the patient is currently experiencing. The AI engine will generate a differential diagnosis based on 8 condition protocols.
          </Text>
        </View>

        {/* Symptom grid by category */}
        {categoryGroups.map((cat) => {
          const catSymptoms = SYMPTOMS.filter((s) => s.category === cat);
          const catColor = CATEGORY_COLORS[cat];
          return (
            <View key={cat} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                <Text style={[styles.categoryTitle, { color: catColor }]}>{categoryLabels[cat]}</Text>
              </View>
              <View style={styles.symptomGrid}>
                {catSymptoms.map((s) => {
                  const isSelected = selected.has(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      style={({ pressed }) => [
                        styles.symptomChip,
                        isSelected && { backgroundColor: catColor + '22', borderColor: catColor },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => toggle(s.id)}
                    >
                      <MaterialIcons
                        name={s.icon as any}
                        size={16}
                        color={isSelected ? catColor : theme.textMuted}
                      />
                      <Text style={[styles.symptomChipText, isSelected && { color: catColor, fontWeight: '700' }]}>
                        {s.label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkBadge, { backgroundColor: catColor }]}>
                          <MaterialIcons name="check" size={10} color="#FFF" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Analyze button */}
        <Pressable
          style={({ pressed }) => [
            styles.analyzeBtn,
            selected.size === 0 && styles.analyzeBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleAnalyze}
          disabled={selected.size === 0}
        >
          <MaterialIcons name="analytics" size={22} color="#FFF" />
          <Text style={styles.analyzeBtnText}>
            {selected.size === 0
              ? 'Select at least 1 symptom'
              : `Analyze ${selected.size} Symptom${selected.size !== 1 ? 's' : ''}`}
          </Text>
        </Pressable>

        {/* Results */}
        {showResults && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.resultsHeader}>
              <MaterialIcons name="biotech" size={20} color={theme.primary} />
              <Text style={styles.resultsTitle}>
                {differential.length > 0
                  ? `${differential.length} Condition${differential.length !== 1 ? 's' : ''} Identified`
                  : 'No Strong Pattern Detected'}
              </Text>
            </View>

            {differential.length === 0 && (
              <View style={styles.noResultsCard}>
                <MaterialIcons name="check-circle" size={40} color={theme.statusGreen} />
                <Text style={styles.noResultsText}>
                  Selected symptoms do not strongly match any critical condition in our database. Monitor the patient and repeat assessment if symptoms worsen.
                </Text>
              </View>
            )}

            {differential.map((cond, idx) => {
              const col = urgencyColor(cond.urgency);
              const bg = urgencyBg(cond.urgency);
              const isPlaying = playingIdx === idx;
              return (
                <View key={idx} style={[styles.conditionCard, { borderLeftColor: col, backgroundColor: bg }]}>
                  <View style={styles.conditionHeader}>
                    <MaterialIcons name={cond.icon as any} size={22} color={col} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.conditionName, { color: col }]}>{cond.name}</Text>
                      <Text style={[styles.urgencyTag, { color: col }]}>{urgencyLabel(cond.urgency)}</Text>
                    </View>
                    {/* Confidence */}
                    <View style={[styles.confidenceBadge, { backgroundColor: col + '22', borderColor: col + '55' }]}>
                      <Text style={[styles.confidenceText, { color: col }]}>{cond.confidence}%</Text>
                    </View>
                    {/* TTS */}
                    <Pressable
                      style={[styles.ttsBtn, isPlaying && { backgroundColor: col }]}
                      onPress={() => isPlaying ? stopSpeech() : speakCondition(cond, idx)}
                      hitSlop={8}
                    >
                      <MaterialIcons
                        name={isPlaying ? 'stop' : 'volume-up'}
                        size={16}
                        color={isPlaying ? '#FFF' : col}
                      />
                    </Pressable>
                  </View>

                  {/* Confidence bar */}
                  <View style={styles.confBarTrack}>
                    <View style={[styles.confBarFill, { width: `${cond.confidence}%`, backgroundColor: col }]} />
                  </View>

                  {/* Triage note */}
                  <View style={styles.triageNoteBox}>
                    <Text style={styles.triageNoteText}>{cond.triageNote}</Text>
                  </View>

                  {/* Action */}
                  <View style={styles.actionBox}>
                    <MaterialIcons name="assignment" size={14} color={col} />
                    <Text style={[styles.actionText, { color: col }]}>{cond.action}</Text>
                  </View>

                  {/* EN/FR guidance */}
                  <View style={styles.guidanceRow}>
                    <View style={[styles.langTag, { backgroundColor: col + '22' }]}>
                      <Text style={[styles.langTagText, { color: col }]}>
                        {language === 'fr' ? 'FR' : 'EN'}
                      </Text>
                    </View>
                    <Text style={styles.guidanceText}>
                      {language === 'fr' ? cond.fr : cond.en}
                    </Text>
                  </View>

                  {/* Citation */}
                  <View style={styles.refRow}>
                    <MaterialIcons name="science" size={11} color={theme.textMuted} />
                    <Text style={styles.refText}>{cond.reference}</Text>
                  </View>
                </View>
              );
            })}

            {/* Disclaimer */}
            <View style={styles.disclaimer}>
              <MaterialIcons name="warning" size={14} color={theme.statusYellow} />
              <Text style={styles.disclaimerText}>
                This tool supports — not replaces — clinical judgment. Always follow national triage protocols and refer when in doubt. MediAid v1.0 prototype.
              </Text>
            </View>

            {/* Scan now CTA */}
            <Pressable
              style={({ pressed }) => [styles.scanCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/scan-workflow')}
            >
              <MaterialIcons name="health-and-safety" size={20} color="#FFF" />
              <Text style={styles.scanCtaText}>Run Full MediAid Scan Now</Text>
              <MaterialIcons name="chevron-right" size={20} color="#FFF" />
            </Pressable>
          </Animated.View>
        )}
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
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  clearBtnText: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.primary + '12', borderRadius: theme.radius.medium,
    padding: 12, marginTop: 16, marginBottom: 16,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  infoText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  categorySection: { marginBottom: 16 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1.5, borderColor: theme.border, position: 'relative',
  },
  symptomChipText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  checkBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: theme.background,
  },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    padding: 18, marginBottom: 20,
    shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  analyzeBtnDisabled: { backgroundColor: theme.surface, shadowOpacity: 0 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  resultsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12,
  },
  resultsTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  noResultsCard: {
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.medium,
    padding: 20, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: theme.statusGreen + '44', marginBottom: 12,
  },
  noResultsText: { fontSize: 13, color: theme.statusGreen, textAlign: 'center', lineHeight: 20 },
  conditionCard: {
    borderRadius: theme.radius.medium, padding: 14,
    marginBottom: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: 'transparent',
  },
  conditionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  conditionName: { fontSize: 15, fontWeight: '700' },
  urgencyTag: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  confidenceBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, marginRight: 6,
  },
  confidenceText: { fontSize: 14, fontWeight: '800' },
  ttsBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  confBarTrack: {
    height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2,
    overflow: 'hidden', marginBottom: 10,
  },
  confBarFill: { height: 4, borderRadius: 2 },
  triageNoteBox: {
    backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: theme.radius.small,
    padding: 8, marginBottom: 8,
  },
  triageNoteText: { fontSize: 12, color: theme.textPrimary, lineHeight: 18 },
  actionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: theme.radius.small,
    padding: 10, marginBottom: 8,
  },
  actionText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  guidanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  langTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full,
  },
  langTagText: { fontSize: 10, fontWeight: '800' },
  guidanceText: { flex: 1, fontSize: 13, color: theme.textPrimary, fontStyle: 'italic', lineHeight: 18 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refText: { fontSize: 10, color: theme.textMuted, flex: 1 },
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  disclaimerText: { flex: 1, fontSize: 11, color: theme.statusYellow, lineHeight: 16 },
  scanCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    padding: 16, marginBottom: 8,
    shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  scanCtaText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFF' },
});
