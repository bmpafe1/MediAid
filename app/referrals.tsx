// MediAid — Referral Outcome Tracker
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

const REFERRALS_KEY = 'mediaid_referrals_v1';

type ReferralStatus = 'pending' | 'attended' | 'missed' | 'cancelled';
type ReferralPriority = 'urgent' | 'routine' | 'followup';

interface Referral {
  id: string;
  patientId: string;
  patientName: string;
  scanId?: string;
  // Referral details
  referralDate: string;  // ISO
  referralFacility: string;
  referralReason: string;
  triggerMetrics: string[]; // e.g. ['TB 84%', 'AFib 19%']
  priority: ReferralPriority;
  status: ReferralStatus;
  // Outcome (filled after visit)
  outcomeDate?: string;
  diagnosis?: string;
  treatment?: string;
  followupNotes?: string;
  // Metadata
  chaName: string;
  createdAt: string;
}

const FACILITIES = [
  'Bamenda Regional Hospital',
  'Mbingo Baptist Hospital',
  'Bafut District Hospital',
  'Santa District Hospital',
  'Fundong District Hospital',
  'Nkambe District Hospital',
];

function statusColor(s: ReferralStatus) {
  if (s === 'attended') return theme.statusGreen;
  if (s === 'missed') return theme.statusRed;
  if (s === 'cancelled') return theme.textMuted;
  return theme.statusYellow;
}
function statusBg(s: ReferralStatus) {
  if (s === 'attended') return theme.statusGreenBg;
  if (s === 'missed') return theme.statusRedBg;
  if (s === 'cancelled') return theme.surface;
  return theme.statusYellowBg;
}
function statusLabel(s: ReferralStatus) {
  if (s === 'attended') return 'ATTENDED';
  if (s === 'missed') return 'MISSED';
  if (s === 'cancelled') return 'CANCELLED';
  return 'PENDING';
}
function statusIcon(s: ReferralStatus): string {
  if (s === 'attended') return 'check-circle';
  if (s === 'missed') return 'cancel';
  if (s === 'cancelled') return 'remove-circle';
  return 'schedule';
}
function priorityColor(p: ReferralPriority) {
  if (p === 'urgent') return theme.statusRed;
  if (p === 'routine') return theme.statusGreen;
  return theme.statusYellow;
}

function generateId() {
  return 'REF-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ─── Add Referral Modal ───────────────────────────────────────────────────────
function AddReferralModal({
  visible,
  onClose,
  onSave,
  prefillPatientId,
  prefillPatientName,
  prefillMetrics,
  prefillScanId,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (r: Referral) => void;
  prefillPatientId?: string;
  prefillPatientName?: string;
  prefillMetrics?: string[];
  prefillScanId?: string;
}) {
  const [patientName, setPatientName] = useState(prefillPatientName ?? '');
  const [patientId, setPatientId] = useState(prefillPatientId ?? '');
  const [facility, setFacility] = useState(FACILITIES[0]);
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<ReferralPriority>('urgent');
  const [chaName, setChaName] = useState('Abena Mbah');

  useEffect(() => {
    if (visible) {
      setPatientName(prefillPatientName ?? '');
      setPatientId(prefillPatientId ?? '');
      setReason(prefillMetrics?.join(', ') ?? '');
    }
  }, [visible, prefillPatientId, prefillPatientName, prefillMetrics]);

  const handleSave = () => {
    if (!patientName.trim() || !reason.trim()) {
      Alert.alert('Missing Fields', 'Please fill in patient name and referral reason.');
      return;
    }
    const ref: Referral = {
      id: generateId(),
      patientId: patientId || 'PT-' + Date.now().toString(36).toUpperCase(),
      patientName: patientName.trim(),
      scanId: prefillScanId,
      referralDate: new Date().toISOString(),
      referralFacility: facility,
      referralReason: reason.trim(),
      triggerMetrics: prefillMetrics ?? [],
      priority,
      status: 'pending',
      chaName,
      createdAt: new Date().toISOString(),
    };
    onSave(ref);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>New Referral</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Patient */}
            <Text style={modalStyles.label}>Patient Name *</Text>
            <TextInput
              style={modalStyles.input}
              value={patientName}
              onChangeText={setPatientName}
              placeholder="Enter patient name"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={modalStyles.label}>Patient ID</Text>
            <TextInput
              style={modalStyles.input}
              value={patientId}
              onChangeText={setPatientId}
              placeholder="Auto-generated if blank"
              placeholderTextColor={theme.textMuted}
            />

            {/* Facility */}
            <Text style={modalStyles.label}>Referral Facility</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {FACILITIES.map((f) => (
                  <Pressable
                    key={f}
                    style={[modalStyles.chip, facility === f && { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}
                    onPress={() => setFacility(f)}
                  >
                    <Text style={[modalStyles.chipText, facility === f && { color: theme.primary, fontWeight: '700' }]}>{f}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Priority */}
            <Text style={modalStyles.label}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['urgent', 'routine', 'followup'] as const).map((p) => {
                const col = priorityColor(p);
                return (
                  <Pressable
                    key={p}
                    style={[modalStyles.priorityChip, priority === p && { backgroundColor: col + '22', borderColor: col }]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[modalStyles.priorityChipText, priority === p && { color: col, fontWeight: '700' }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Reason */}
            <Text style={modalStyles.label}>Referral Reason / Triggered Metrics *</Text>
            <TextInput
              style={[modalStyles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. TB Risk 84%, AFib 19% — suspected pulmonary TB"
              placeholderTextColor={theme.textMuted}
              multiline
            />

            {/* CHA Name */}
            <Text style={modalStyles.label}>CHA Name</Text>
            <TextInput
              style={modalStyles.input}
              value={chaName}
              onChangeText={setChaName}
              placeholder="Your name"
              placeholderTextColor={theme.textMuted}
            />
          </ScrollView>

          <View style={modalStyles.btnRow}>
            <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [modalStyles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
            >
              <MaterialIcons name="send" size={16} color="#FFF" />
              <Text style={modalStyles.saveBtnText}>Log Referral</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
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
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  chipText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  priorityChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
  },
  priorityChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
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

// ─── Outcome Modal ────────────────────────────────────────────────────────────
function OutcomeModal({
  visible,
  referral,
  onClose,
  onUpdate,
}: {
  visible: boolean;
  referral: Referral | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Referral>) => void;
}) {
  const [status, setStatus] = useState<ReferralStatus>('attended');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (referral) {
      setStatus(referral.status === 'pending' ? 'attended' : referral.status);
      setDiagnosis(referral.diagnosis ?? '');
      setTreatment(referral.treatment ?? '');
      setNotes(referral.followupNotes ?? '');
    }
  }, [referral]);

  if (!referral) return null;

  const handleSave = () => {
    onUpdate(referral.id, {
      status,
      diagnosis: diagnosis.trim() || undefined,
      treatment: treatment.trim() || undefined,
      followupNotes: notes.trim() || undefined,
      outcomeDate: new Date().toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={outcomeStyles.backdrop} onPress={onClose}>
        <Pressable style={outcomeStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={outcomeStyles.handle} />
          <Text style={outcomeStyles.title}>Record Outcome</Text>
          <Text style={outcomeStyles.sub}>{referral.patientName} · {referral.referralFacility}</Text>

          {/* Status */}
          <Text style={outcomeStyles.label}>Visit Status</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {(['attended', 'missed', 'cancelled'] as const).map((s) => {
              const col = statusColor(s);
              return (
                <Pressable
                  key={s}
                  style={[
                    outcomeStyles.statusChip,
                    status === s && { backgroundColor: col + '22', borderColor: col },
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <MaterialIcons name={statusIcon(s) as any} size={14} color={status === s ? col : theme.textMuted} />
                  <Text style={[outcomeStyles.statusChipText, status === s && { color: col, fontWeight: '700' }]}>
                    {statusLabel(s)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {status === 'attended' && (
            <>
              <Text style={outcomeStyles.label}>Confirmed Diagnosis</Text>
              <TextInput
                style={outcomeStyles.input}
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholder="e.g. Active pulmonary TB — confirmed sputum positive"
                placeholderTextColor={theme.textMuted}
                multiline
              />

              <Text style={outcomeStyles.label}>Treatment Given</Text>
              <TextInput
                style={outcomeStyles.input}
                value={treatment}
                onChangeText={setTreatment}
                placeholder="e.g. RHZE regimen initiated · 6 months"
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </>
          )}

          <Text style={outcomeStyles.label}>Follow-up Notes</Text>
          <TextInput
            style={[outcomeStyles.input, { height: 70 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional observations..."
            placeholderTextColor={theme.textMuted}
            multiline
          />

          <View style={outcomeStyles.btnRow}>
            <Pressable style={outcomeStyles.cancelBtn} onPress={onClose}>
              <Text style={outcomeStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [outcomeStyles.saveBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSave}
            >
              <MaterialIcons name="save" size={16} color="#FFF" />
              <Text style={outcomeStyles.saveBtnText}>Save Outcome</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const outcomeStyles = StyleSheet.create({
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
  title: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: theme.textMuted, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
    padding: 12, fontSize: 14, color: theme.textPrimary, marginBottom: 12,
  },
  statusChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
  },
  statusChipText: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: theme.statusGreen, borderRadius: theme.radius.medium,
    shadowColor: theme.statusGreen, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ─── Referral Card ────────────────────────────────────────────────────────────
function ReferralCard({
  referral,
  onUpdateOutcome,
}: {
  referral: Referral;
  onUpdateOutcome: (r: Referral) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const col = statusColor(referral.status);
  const priorCol = priorityColor(referral.priority);

  const daysSince = Math.floor(
    (Date.now() - new Date(referral.referralDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Pressable
      style={[cardStyles.card, { borderLeftColor: col }]}
      onPress={() => setExpanded((v) => !v)}
    >
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={[cardStyles.statusDot, { backgroundColor: col }]} />
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.patientName}>{referral.patientName}</Text>
          <Text style={cardStyles.facility} numberOfLines={1}>{referral.referralFacility}</Text>
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: statusBg(referral.status), borderColor: col + '55' }]}>
          <MaterialIcons name={statusIcon(referral.status) as any} size={12} color={col} />
          <Text style={[cardStyles.statusBadgeText, { color: col }]}>{statusLabel(referral.status)}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
      </View>

      {/* Meta row */}
      <View style={cardStyles.metaRow}>
        <View style={[cardStyles.priorityChip, { backgroundColor: priorCol + '18', borderColor: priorCol + '44' }]}>
          <Text style={[cardStyles.priorityText, { color: priorCol }]}>
            {referral.priority.toUpperCase()}
          </Text>
        </View>
        <Text style={cardStyles.metaText}>
          {new Date(referral.referralDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          {' · '}{daysSince === 0 ? 'Today' : `${daysSince}d ago`}
        </Text>
        <Text style={cardStyles.chaText}>CHA: {referral.chaName}</Text>
      </View>

      {/* Trigger metrics */}
      {referral.triggerMetrics.length > 0 && (
        <View style={cardStyles.metricsRow}>
          {referral.triggerMetrics.map((m, i) => (
            <View key={i} style={cardStyles.metricTag}>
              <Text style={cardStyles.metricTagText}>{m}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Expanded */}
      {expanded && (
        <View style={cardStyles.expanded}>
          <View style={cardStyles.expandDivider} />

          <Text style={cardStyles.sectionLabel}>REFERRAL REASON</Text>
          <Text style={cardStyles.reasonText}>{referral.referralReason}</Text>

          {referral.status === 'attended' && (
            <>
              {referral.diagnosis && (
                <>
                  <Text style={[cardStyles.sectionLabel, { marginTop: 10 }]}>CONFIRMED DIAGNOSIS</Text>
                  <View style={cardStyles.diagnosisBox}>
                    <MaterialIcons name="local-hospital" size={14} color={theme.statusGreen} />
                    <Text style={cardStyles.diagnosisText}>{referral.diagnosis}</Text>
                  </View>
                </>
              )}
              {referral.treatment && (
                <>
                  <Text style={[cardStyles.sectionLabel, { marginTop: 10 }]}>TREATMENT</Text>
                  <Text style={cardStyles.treatmentText}>{referral.treatment}</Text>
                </>
              )}
              {referral.outcomeDate && (
                <Text style={cardStyles.outcomeDateText}>
                  Outcome recorded: {new Date(referral.outcomeDate).toLocaleDateString()}
                </Text>
              )}
            </>
          )}

          {referral.followupNotes && (
            <>
              <Text style={[cardStyles.sectionLabel, { marginTop: 10 }]}>NOTES</Text>
              <Text style={cardStyles.notesText}>{referral.followupNotes}</Text>
            </>
          )}

          {referral.status === 'pending' && (
            <Pressable
              style={({ pressed }) => [cardStyles.updateBtn, pressed && { opacity: 0.85 }]}
              onPress={() => onUpdateOutcome(referral)}
            >
              <MaterialIcons name="edit" size={16} color="#FFF" />
              <Text style={cardStyles.updateBtnText}>Record Outcome</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  patientName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  facility: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priorityChip: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  priorityText: { fontSize: 9, fontWeight: '800' },
  metaText: { fontSize: 11, color: theme.textMuted, flex: 1 },
  chaText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  metricTag: {
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusRed + '33',
  },
  metricTagText: { fontSize: 10, fontWeight: '700', color: theme.statusRed },
  expanded: { marginTop: 10 },
  expandDivider: { height: 1, backgroundColor: theme.border, marginBottom: 10 },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
  },
  reasonText: { fontSize: 13, color: theme.textPrimary, lineHeight: 19 },
  diagnosisBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.small,
    padding: 10, borderWidth: 1, borderColor: theme.statusGreen + '33',
  },
  diagnosisText: { flex: 1, fontSize: 13, color: theme.statusGreen, lineHeight: 18, fontWeight: '600' },
  treatmentText: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  outcomeDateText: { fontSize: 10, color: theme.textMuted, marginTop: 6 },
  notesText: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, fontStyle: 'italic' },
  updateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.statusGreen, borderRadius: theme.radius.medium,
    paddingVertical: 12, marginTop: 12,
  },
  updateBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();
  const params = useLocalSearchParams<{
    patientId?: string;
    patientName?: string;
    scanId?: string;
    metrics?: string;
  }>();

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralStatus>('all');
  const [addVisible, setAddVisible] = useState(false);
  const [outcomeReferral, setOutcomeReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);

  const prefillMetrics = params.metrics ? params.metrics.split('|') : [];

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(REFERRALS_KEY);
      if (raw) setReferrals(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  // Auto-open add modal if launched from patient detail with prefill
  useEffect(() => {
    if (params.patientId && !loading) {
      setAddVisible(true);
    }
  }, [params.patientId, loading]);

  const save = async (list: Referral[]) => {
    setReferrals(list);
    await AsyncStorage.setItem(REFERRALS_KEY, JSON.stringify(list));
  };

  const addReferral = (r: Referral) => {
    save([r, ...referrals]);
  };

  const updateReferral = (id: string, updates: Partial<Referral>) => {
    const updated = referrals.map((r) => r.id === id ? { ...r, ...updates } : r);
    save(updated);
    setOutcomeReferral(null);
  };

  const filtered = referrals.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === 'pending').length,
    attended: referrals.filter((r) => r.status === 'attended').length,
    missed: referrals.filter((r) => r.status === 'missed').length,
    attendRate: referrals.length > 0
      ? Math.round((referrals.filter((r) => r.status === 'attended').length / referrals.filter((r) => r.status !== 'pending').length) * 100) || 0
      : 0,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <AddReferralModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSave={addReferral}
        prefillPatientId={params.patientId}
        prefillPatientName={params.patientName}
        prefillMetrics={prefillMetrics}
        prefillScanId={params.scanId}
      />
      <OutcomeModal
        visible={outcomeReferral !== null}
        referral={outcomeReferral}
        onClose={() => setOutcomeReferral(null)}
        onUpdate={updateReferral}
      />

      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Referral Tracker</Text>
          <Text style={styles.navSub}>{referrals.length} referral{referrals.length !== 1 ? 's' : ''} · NW Cameroon</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setAddVisible(true)}
        >
          <MaterialIcons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats grid */}
        <Text style={styles.sectionTitle}>REFERRAL SUMMARY</Text>
        <View style={styles.statsGrid}>
          {[
            { label: 'Total', value: stats.total, color: theme.primary, icon: 'send' },
            { label: 'Pending', value: stats.pending, color: theme.statusYellow, icon: 'schedule' },
            { label: 'Attended', value: stats.attended, color: theme.statusGreen, icon: 'check-circle' },
            { label: 'Missed', value: stats.missed, color: theme.statusRed, icon: 'cancel' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + '44' }]}>
              <MaterialIcons name={s.icon as any} size={20} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Attendance rate bar */}
        {referrals.length > 0 && (
          <View style={styles.rateCard}>
            <View style={styles.rateHeader}>
              <MaterialIcons name="trending-up" size={16} color={stats.attendRate >= 70 ? theme.statusGreen : theme.statusYellow} />
              <Text style={styles.rateTitle}>Clinic Attendance Rate</Text>
              <Text style={[styles.ratePct, {
                color: stats.attendRate >= 70 ? theme.statusGreen : stats.attendRate >= 50 ? theme.statusYellow : theme.statusRed,
              }]}>{stats.attendRate}%</Text>
            </View>
            <View style={styles.rateTrack}>
              <View style={[styles.rateFill, {
                width: `${stats.attendRate}%`,
                backgroundColor: stats.attendRate >= 70 ? theme.statusGreen : stats.attendRate >= 50 ? theme.statusYellow : theme.statusRed,
              }]} />
            </View>
            <Text style={styles.rateHint}>WHO target: ≥80% attendance for urgent referrals</Text>
          </View>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['all', 'pending', 'attended', 'missed', 'cancelled'] as const).map((f) => {
              const col = f === 'all' ? theme.primary : statusColor(f as ReferralStatus);
              return (
                <Pressable
                  key={f}
                  style={[styles.filterChip, statusFilter === f && { backgroundColor: col + '22', borderColor: col }]}
                  onPress={() => setStatusFilter(f)}
                >
                  {f !== 'all' && (
                    <MaterialIcons name={statusIcon(f as ReferralStatus) as any} size={12} color={statusFilter === f ? col : theme.textMuted} />
                  )}
                  <Text style={[styles.filterChipText, statusFilter === f && { color: col, fontWeight: '700' }]}>
                    {f === 'all' ? 'All' : statusLabel(f as ReferralStatus)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* List */}
        <Text style={styles.sectionTitle}>{filtered.length} REFERRAL{filtered.length !== 1 ? 'S' : ''}</Text>

        {filtered.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <MaterialIcons name="send" size={56} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>
              {referrals.length === 0 ? 'No referrals yet' : 'No referrals in this category'}
            </Text>
            <Text style={styles.emptySub}>
              {referrals.length === 0
                ? 'Tap "+ New" to log your first patient referral'
                : 'Switch filter to view other referrals'}
            </Text>
            {referrals.length === 0 && (
              <Pressable
                style={({ pressed }) => [styles.emptyAddBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setAddVisible(true)}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Log First Referral</Text>
              </Pressable>
            )}
          </View>
        )}

        {filtered.map((r) => (
          <ReferralCard
            key={r.id}
            referral={r}
            onUpdateOutcome={(ref) => setOutcomeReferral(ref)}
          />
        ))}

        <Text style={styles.footer}>
          All referrals stored on-device · Exportable to DHIS2 · MediAid v1.0
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
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  statsGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statCard: {
    width: '22%', backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, alignItems: 'center', gap: 5, borderWidth: 1,
    flexGrow: 1,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  rateCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 4,
    borderWidth: 1, borderColor: theme.border,
  },
  rateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  rateTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  ratePct: { fontSize: 20, fontWeight: '800' },
  rateTrack: { height: 10, backgroundColor: theme.border, borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
  rateFill: { height: '100%', borderRadius: 5 },
  rateHint: { fontSize: 10, color: theme.textMuted },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyAddBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
