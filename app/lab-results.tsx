// MediAid — Field Lab Results Tracker
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

const LAB_KEY = 'mediaid_lab_results_v1';

type TestType = 'rdt_malaria' | 'sputum_smear' | 'hemoglobin' | 'blood_glucose' | 'urine_dipstick' | 'rdt_covid' | 'stool_ova' | 'pregnancy';
type TestResult = 'positive' | 'negative' | 'indeterminate' | 'numeric';

interface LabTest {
  id: string;
  patientId: string;
  patientName: string;
  scanId?: string;
  testType: TestType;
  testDate: string; // ISO
  result: TestResult;
  numericValue?: number;
  numericUnit?: string;
  interpretation: 'normal' | 'abnormal' | 'critical';
  notes?: string;
  chaName: string;
  facility: string;
  createdAt: string;
}

interface TestDefinition {
  type: TestType;
  label: string;
  icon: string;
  color: string;
  unit?: string;
  normalRange?: string;
  criticalThreshold?: string;
  isNumeric: boolean;
  normalMin?: number;
  normalMax?: number;
  criticalMin?: number;
  criticalMax?: number;
}

const TEST_DEFINITIONS: TestDefinition[] = [
  {
    type: 'rdt_malaria',
    label: 'RDT Malaria',
    icon: 'bug-report',
    color: '#F59E0B',
    isNumeric: false,
    normalRange: 'Negative',
    criticalThreshold: 'Positive → immediate ACT',
  },
  {
    type: 'sputum_smear',
    label: 'Sputum Smear (TB)',
    icon: 'air',
    color: theme.statusRed,
    isNumeric: false,
    normalRange: 'Negative (no AFB)',
    criticalThreshold: 'Positive → isolate + refer',
  },
  {
    type: 'hemoglobin',
    label: 'Hemoglobin (Hgb)',
    icon: 'opacity',
    color: '#EC4899',
    unit: 'g/dL',
    isNumeric: true,
    normalRange: '12–17 g/dL',
    criticalThreshold: '<7 g/dL',
    normalMin: 12,
    normalMax: 17,
    criticalMin: 7,
  },
  {
    type: 'blood_glucose',
    label: 'Blood Glucose (RBG)',
    icon: 'water-drop',
    color: '#3B82F6',
    unit: 'mmol/L',
    isNumeric: true,
    normalRange: '4.0–11.0 mmol/L',
    criticalThreshold: '<2.8 or >16.7 mmol/L',
    normalMin: 4.0,
    normalMax: 11.0,
    criticalMin: 2.8,
    criticalMax: 16.7,
  },
  {
    type: 'urine_dipstick',
    label: 'Urine Dipstick',
    icon: 'science',
    color: '#10B981',
    isNumeric: false,
    normalRange: 'Negative (protein, glucose, blood)',
    criticalThreshold: '3+ protein or blood',
  },
  {
    type: 'rdt_covid',
    label: 'RDT COVID-19',
    icon: 'coronavirus',
    color: '#6366F1',
    isNumeric: false,
    normalRange: 'Negative',
    criticalThreshold: 'Positive → isolate + notify',
  },
  {
    type: 'stool_ova',
    label: 'Stool Ova & Parasites',
    icon: 'visibility',
    color: '#78716C',
    isNumeric: false,
    normalRange: 'No ova/parasites',
    criticalThreshold: 'Positive → antiparasitic',
  },
  {
    type: 'pregnancy',
    label: 'Pregnancy Test (uHCG)',
    icon: 'pregnant-woman',
    color: '#EC4899',
    isNumeric: false,
    normalRange: 'Negative (if not pregnant)',
    criticalThreshold: 'Positive → ANC referral',
  },
];

function getTestDef(type: TestType): TestDefinition {
  return TEST_DEFINITIONS.find((t) => t.type === type) ?? TEST_DEFINITIONS[0];
}

function classifyNumeric(def: TestDefinition, value: number): 'normal' | 'abnormal' | 'critical' {
  if (!def.isNumeric) return 'normal';
  const isCriticalLow = def.criticalMin !== undefined && value < def.criticalMin;
  const isCriticalHigh = def.criticalMax !== undefined && value > def.criticalMax;
  if (isCriticalLow || isCriticalHigh) return 'critical';
  const isNormalLow = def.normalMin !== undefined && value < def.normalMin;
  const isNormalHigh = def.normalMax !== undefined && value > def.normalMax;
  if (isNormalLow || isNormalHigh) return 'abnormal';
  return 'normal';
}

function classifyQualitative(result: TestResult, type: TestType): 'normal' | 'abnormal' | 'critical' {
  if (result === 'negative') return 'normal';
  if (result === 'positive') {
    if (type === 'sputum_smear' || type === 'rdt_malaria') return 'critical';
    return 'abnormal';
  }
  if (result === 'indeterminate') return 'abnormal';
  return 'normal';
}

function interpColor(i: 'normal' | 'abnormal' | 'critical') {
  if (i === 'critical') return theme.statusRed;
  if (i === 'abnormal') return theme.statusYellow;
  return theme.statusGreen;
}
function interpBg(i: 'normal' | 'abnormal' | 'critical') {
  if (i === 'critical') return theme.statusRedBg;
  if (i === 'abnormal') return theme.statusYellowBg;
  return theme.statusGreenBg;
}
function interpLabel(i: 'normal' | 'abnormal' | 'critical') {
  if (i === 'critical') return 'CRITICAL';
  if (i === 'abnormal') return 'ABNORMAL';
  return 'NORMAL';
}

function generateId() {
  return 'LAB-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ─── Add Lab Result Modal ─────────────────────────────────────────────────────
function AddLabModal({
  visible,
  onClose,
  onSave,
  prefillPatientId,
  prefillPatientName,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (lab: LabTest) => void;
  prefillPatientId?: string;
  prefillPatientName?: string;
}) {
  const [patientName, setPatientName] = useState(prefillPatientName ?? '');
  const [patientId, setPatientId] = useState(prefillPatientId ?? '');
  const [testType, setTestType] = useState<TestType>('rdt_malaria');
  const [qualResult, setQualResult] = useState<TestResult>('negative');
  const [numericInput, setNumericInput] = useState('');
  const [notes, setNotes] = useState('');
  const [chaName, setChaName] = useState('Abena Mbah');
  const [facility, setFacility] = useState('Bamenda Regional Hospital');

  const def = getTestDef(testType);

  useEffect(() => {
    if (visible) {
      setPatientName(prefillPatientName ?? '');
      setPatientId(prefillPatientId ?? '');
    }
  }, [visible, prefillPatientId, prefillPatientName]);

  const handleSave = () => {
    if (!patientName.trim()) {
      Alert.alert('Missing Field', 'Please enter the patient name.');
      return;
    }
    let result: TestResult;
    let numericValue: number | undefined;
    let interpretation: 'normal' | 'abnormal' | 'critical';

    if (def.isNumeric) {
      const val = parseFloat(numericInput);
      if (isNaN(val)) {
        Alert.alert('Invalid Value', 'Please enter a valid numeric result.');
        return;
      }
      numericValue = val;
      result = 'numeric';
      interpretation = classifyNumeric(def, val);
    } else {
      result = qualResult;
      interpretation = classifyQualitative(result, testType);
    }

    const lab: LabTest = {
      id: generateId(),
      patientId: patientId || 'PT-' + Date.now().toString(36).toUpperCase(),
      patientName: patientName.trim(),
      testType,
      testDate: new Date().toISOString(),
      result,
      numericValue,
      numericUnit: def.unit,
      interpretation,
      notes: notes.trim() || undefined,
      chaName,
      facility,
      createdAt: new Date().toISOString(),
    };
    onSave(lab);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    // Reset
    setNumericInput('');
    setNotes('');
    setQualResult('negative');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={addModalStyles.backdrop} onPress={onClose}>
        <Pressable style={addModalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={addModalStyles.handle} />
          <Text style={addModalStyles.title}>Log Lab Result</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            {/* Patient */}
            <Text style={addModalStyles.label}>Patient Name *</Text>
            <TextInput
              style={addModalStyles.input}
              value={patientName}
              onChangeText={setPatientName}
              placeholder="Enter patient name"
              placeholderTextColor={theme.textMuted}
            />

            {/* Test type */}
            <Text style={addModalStyles.label}>Test Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TEST_DEFINITIONS.map((td) => (
                  <Pressable
                    key={td.type}
                    style={[addModalStyles.testChip, testType === td.type && { backgroundColor: td.color + '22', borderColor: td.color }]}
                    onPress={() => setTestType(td.type)}
                  >
                    <MaterialIcons name={td.icon as any} size={14} color={testType === td.type ? td.color : theme.textMuted} />
                    <Text style={[addModalStyles.testChipText, testType === td.type && { color: td.color, fontWeight: '700' }]}>
                      {td.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Normal range hint */}
            <View style={[addModalStyles.hintBox, { borderColor: def.color + '33', backgroundColor: def.color + '10' }]}>
              <MaterialIcons name="info-outline" size={14} color={def.color} />
              <View style={{ flex: 1 }}>
                <Text style={[addModalStyles.hintText, { color: def.color }]}>
                  Normal: {def.normalRange}
                </Text>
                {def.criticalThreshold && (
                  <Text style={[addModalStyles.hintText, { color: theme.statusRed }]}>
                    Critical: {def.criticalThreshold}
                  </Text>
                )}
              </View>
            </View>

            {/* Result entry */}
            {def.isNumeric ? (
              <>
                <Text style={addModalStyles.label}>Result ({def.unit})</Text>
                <TextInput
                  style={addModalStyles.input}
                  value={numericInput}
                  onChangeText={setNumericInput}
                  placeholder={`Enter value in ${def.unit}`}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
                {numericInput && !isNaN(parseFloat(numericInput)) && (
                  <View style={[addModalStyles.interpretBox, {
                    backgroundColor: interpBg(classifyNumeric(def, parseFloat(numericInput))),
                    borderColor: interpColor(classifyNumeric(def, parseFloat(numericInput))) + '44',
                  }]}>
                    <Text style={[addModalStyles.interpretText, { color: interpColor(classifyNumeric(def, parseFloat(numericInput))) }]}>
                      {interpLabel(classifyNumeric(def, parseFloat(numericInput)))} — {parseFloat(numericInput)} {def.unit}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={addModalStyles.label}>Result</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(['positive', 'negative', 'indeterminate'] as const).map((r) => {
                    const col = r === 'positive' ? theme.statusRed : r === 'negative' ? theme.statusGreen : theme.statusYellow;
                    return (
                      <Pressable
                        key={r}
                        style={[addModalStyles.resultChip, qualResult === r && { backgroundColor: col + '22', borderColor: col }]}
                        onPress={() => setQualResult(r)}
                      >
                        <Text style={[addModalStyles.resultChipText, qualResult === r && { color: col, fontWeight: '700' }]}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Notes */}
            <Text style={addModalStyles.label}>Notes (optional)</Text>
            <TextInput
              style={[addModalStyles.input, { height: 70, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. sample quality, repeat test needed"
              placeholderTextColor={theme.textMuted}
              multiline
            />

            {/* CHA */}
            <Text style={addModalStyles.label}>CHA Name</Text>
            <TextInput
              style={addModalStyles.input}
              value={chaName}
              onChangeText={setChaName}
              placeholderTextColor={theme.textMuted}
            />
          </ScrollView>

          <View style={addModalStyles.btnRow}>
            <Pressable style={addModalStyles.cancelBtn} onPress={onClose}>
              <Text style={addModalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [addModalStyles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
            >
              <MaterialIcons name="science" size={16} color="#FFF" />
              <Text style={addModalStyles.saveBtnText}>Save Result</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const addModalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    borderWidth: 1, borderColor: theme.border,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
    padding: 12, fontSize: 14, color: theme.textPrimary, marginBottom: 12,
  },
  testChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  testChipText: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: theme.radius.small, padding: 10,
    borderWidth: 1, marginBottom: 12,
  },
  hintText: { fontSize: 11, lineHeight: 17, fontWeight: '500' },
  interpretBox: {
    borderRadius: theme.radius.small, padding: 10, marginBottom: 12, borderWidth: 1,
  },
  interpretText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  resultChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
  },
  resultChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ─── Lab Result Card ──────────────────────────────────────────────────────────
function LabResultCard({ lab }: { lab: LabTest }) {
  const [expanded, setExpanded] = useState(false);
  const def = getTestDef(lab.testType);
  const interp = lab.interpretation;
  const col = interpColor(interp);
  const bg = interpBg(interp);

  const resultDisplay = lab.result === 'numeric'
    ? `${lab.numericValue} ${lab.numericUnit ?? ''}`
    : lab.result.charAt(0).toUpperCase() + lab.result.slice(1);

  const daysSince = Math.floor((Date.now() - new Date(lab.testDate).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Pressable
      style={[labCardStyles.card, { borderLeftColor: col }]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={labCardStyles.header}>
        <View style={[labCardStyles.iconCircle, { backgroundColor: def.color + '18', borderColor: def.color + '44' }]}>
          <MaterialIcons name={def.icon as any} size={18} color={def.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={labCardStyles.testLabel}>{def.label}</Text>
          <Text style={labCardStyles.patientName}>{lab.patientName}</Text>
        </View>
        <View style={[labCardStyles.resultBadge, { backgroundColor: bg, borderColor: col + '55' }]}>
          <Text style={[labCardStyles.resultText, { color: col }]}>{resultDisplay}</Text>
          <Text style={[labCardStyles.interpText, { color: col }]}>{interpLabel(interp)}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
      </View>

      <View style={labCardStyles.metaRow}>
        <MaterialIcons name="access-time" size={11} color={theme.textMuted} />
        <Text style={labCardStyles.metaText}>
          {new Date(lab.testDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          {' · '}{daysSince === 0 ? 'Today' : `${daysSince}d ago`}
        </Text>
        <Text style={labCardStyles.chaText}>CHA: {lab.chaName}</Text>
      </View>

      {interp === 'critical' && (
        <View style={labCardStyles.criticalBanner}>
          <MaterialIcons name="warning" size={12} color={theme.statusRed} />
          <Text style={labCardStyles.criticalText}>
            CRITICAL — {def.criticalThreshold ?? 'Requires immediate action'}
          </Text>
        </View>
      )}

      {expanded && (
        <View style={labCardStyles.expanded}>
          <View style={labCardStyles.divider} />
          <View style={labCardStyles.expandGrid}>
            <View style={labCardStyles.expandItem}>
              <Text style={labCardStyles.expandLabel}>FACILITY</Text>
              <Text style={labCardStyles.expandValue}>{lab.facility}</Text>
            </View>
            <View style={labCardStyles.expandItem}>
              <Text style={labCardStyles.expandLabel}>PATIENT ID</Text>
              <Text style={labCardStyles.expandValue}>{lab.patientId}</Text>
            </View>
          </View>
          <View style={labCardStyles.expandItem}>
            <Text style={labCardStyles.expandLabel}>NORMAL RANGE</Text>
            <Text style={labCardStyles.expandValue}>{def.normalRange}</Text>
          </View>
          {lab.notes && (
            <View style={labCardStyles.notesBox}>
              <Text style={labCardStyles.expandLabel}>NOTES</Text>
              <Text style={labCardStyles.notesText}>{lab.notes}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const labCardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  testLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  patientName: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  resultBadge: {
    alignItems: 'center', borderRadius: theme.radius.small,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, gap: 2,
  },
  resultText: { fontSize: 14, fontWeight: '800' },
  interpText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 11, color: theme.textMuted, flex: 1 },
  chaText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  criticalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 8,
    borderWidth: 1, borderColor: theme.statusRed + '44', alignSelf: 'flex-start',
  },
  criticalText: { fontSize: 10, fontWeight: '700', color: theme.statusRed },
  expanded: { marginTop: 10 },
  divider: { height: 1, backgroundColor: theme.border, marginBottom: 10 },
  expandGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  expandItem: { flex: 1, marginBottom: 8 },
  expandLabel: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  expandValue: { fontSize: 13, color: theme.textPrimary, fontWeight: '500' },
  notesBox: { marginTop: 4 },
  notesText: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, fontStyle: 'italic' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LabResultsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>();

  const [labs, setLabs] = useState<LabTest[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TestType | 'all'>('all');
  const [interpFilter, setInterpFilter] = useState<'all' | 'normal' | 'abnormal' | 'critical'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LAB_KEY);
      if (raw) setLabs(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (params.patientId && !loading) setAddVisible(true);
  }, [params.patientId, loading]);

  const save = async (list: LabTest[]) => {
    setLabs(list);
    await AsyncStorage.setItem(LAB_KEY, JSON.stringify(list));
  };

  const addLab = (lab: LabTest) => {
    save([lab, ...labs]);
  };

  const filtered = labs.filter((l) => {
    const typeMatch = typeFilter === 'all' || l.testType === typeFilter;
    const interpMatch = interpFilter === 'all' || l.interpretation === interpFilter;
    return typeMatch && interpMatch;
  });

  const stats = {
    total: labs.length,
    critical: labs.filter((l) => l.interpretation === 'critical').length,
    abnormal: labs.filter((l) => l.interpretation === 'abnormal').length,
    normal: labs.filter((l) => l.interpretation === 'normal').length,
    positiveRDTs: labs.filter((l) => l.testType === 'rdt_malaria' && l.result === 'positive').length,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <AddLabModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSave={addLab}
        prefillPatientId={params.patientId}
        prefillPatientName={params.patientName}
      />

      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Lab Results</Text>
          <Text style={styles.navSub}>{labs.length} test{labs.length !== 1 ? 's' : ''} · 8 test types</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setAddVisible(true)}
        >
          <MaterialIcons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Log</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <Text style={styles.sectionTitle}>LAB SUMMARY</Text>
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Tests', value: stats.total, color: theme.primary, icon: 'science' },
            { label: 'Critical', value: stats.critical, color: theme.statusRed, icon: 'warning' },
            { label: 'Abnormal', value: stats.abnormal, color: theme.statusYellow, icon: 'info' },
            { label: 'Normal', value: stats.normal, color: theme.statusGreen, icon: 'check-circle' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + '44' }]}>
              <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Malaria RDT banner */}
        {stats.positiveRDTs > 0 && (
          <View style={styles.rdtBanner}>
            <MaterialIcons name="bug-report" size={18} color={theme.statusRed} />
            <Text style={styles.rdtBannerText}>
              {stats.positiveRDTs} Positive Malaria RDT{stats.positiveRDTs !== 1 ? 's' : ''} — ACT treatment required
            </Text>
          </View>
        )}

        {/* Test type filter */}
        <Text style={styles.sectionTitle}>FILTER BY TEST</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.filterChip, typeFilter === 'all' && { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}
              onPress={() => setTypeFilter('all')}
            >
              <Text style={[styles.filterChipText, typeFilter === 'all' && { color: theme.primary, fontWeight: '700' }]}>All</Text>
            </Pressable>
            {TEST_DEFINITIONS.map((td) => (
              <Pressable
                key={td.type}
                style={[styles.filterChip, typeFilter === td.type && { backgroundColor: td.color + '22', borderColor: td.color }]}
                onPress={() => setTypeFilter(td.type)}
              >
                <MaterialIcons name={td.icon as any} size={11} color={typeFilter === td.type ? td.color : theme.textMuted} />
                <Text style={[styles.filterChipText, typeFilter === td.type && { color: td.color, fontWeight: '700' }]}>
                  {td.label.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Interpretation filter */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['all', 'normal', 'abnormal', 'critical'] as const).map((f) => {
            const col = f === 'all' ? theme.primary : interpColor(f as any);
            return (
              <Pressable
                key={f}
                style={[styles.filterChip, interpFilter === f && { backgroundColor: col + '22', borderColor: col }, { flex: 1, justifyContent: 'center' }]}
                onPress={() => setInterpFilter(f)}
              >
                <Text style={[styles.filterChipText, interpFilter === f && { color: col, fontWeight: '700' }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Results list */}
        <Text style={styles.sectionTitle}>{filtered.length} RESULT{filtered.length !== 1 ? 'S' : ''}</Text>

        {filtered.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <MaterialIcons name="science" size={56} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>
              {labs.length === 0 ? 'No lab results yet' : 'No results match this filter'}
            </Text>
            <Text style={styles.emptySub}>
              {labs.length === 0
                ? 'Tap "Log" to record your first field lab result'
                : 'Try changing the test type or interpretation filter'}
            </Text>
            {labs.length === 0 && (
              <Pressable
                style={({ pressed }) => [styles.emptyAddBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setAddVisible(true)}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Log First Result</Text>
              </Pressable>
            )}
          </View>
        )}

        {filtered.map((lab) => (
          <LabResultCard key={lab.id} lab={lab} />
        ))}

        {/* Test reference card */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>TEST REFERENCE</Text>
        <View style={styles.refCard}>
          {TEST_DEFINITIONS.map((td) => (
            <View key={td.type} style={styles.refRow}>
              <MaterialIcons name={td.icon as any} size={14} color={td.color} />
              <View style={{ flex: 1 }}>
                <Text style={styles.refLabel}>{td.label}</Text>
                <Text style={styles.refNormal}>Normal: {td.normalRange}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          All results stored on-device · Linkable to patient scans · MediAid v1.0
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
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 14,
  },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 10, alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  rdtBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 4,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  rdtBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.statusRed },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyAddBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  refCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  refRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 10, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  refLabel: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  refNormal: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
