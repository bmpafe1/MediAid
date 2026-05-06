// MediAid — SMS Escalation Composer
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import * as SMS from 'expo-sms';
import {
  Alert,
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
import { getStatusForMetric } from '@/services/mockData';

const CLINICS = [
  { name: 'Bamenda Regional Hospital', distance: '4.2 km', phone: '+237 233 36 12 90', coords: '5.9597°N, 10.1456°E' },
  { name: 'Mbingo Baptist Hospital', distance: '22 km', phone: '+237 233 36 35 00', coords: '6.0841°N, 10.0278°E' },
  { name: 'Balikumbat District Hospital', distance: '17 km', phone: '+237 233 38 10 05', coords: '5.8943°N, 10.3211°E' },
];

const SUPERVISORS = [
  { name: 'Dr. Amina Foudja', role: 'District Health Officer', phone: '+237 699 11 22 33' },
  { name: 'Nurse Théodore Mbah', role: 'CHA Supervisor', phone: '+237 677 44 55 66' },
];

function buildSMSText(
  patientName: string,
  patientId: string,
  redMetrics: string[],
  clinic: typeof CLINICS[0],
  gpsCoords: string,
  note: string
): string {
  const lines = [
    '🚨 MEDIAID RED ALERT — ACTION REQUIRED',
    `Patient: ${patientName} (${patientId})`,
    `Time: ${new Date().toLocaleString()}`,
    `GPS: ${gpsCoords}`,
    '',
    'RED METRICS:',
    ...redMetrics.map((m) => `• ${m}`),
    '',
    `REFERRAL → ${clinic.name}`,
    `Distance: ${clinic.distance} | Tel: ${clinic.phone}`,
    '',
    note ? `Note: ${note}` : '',
    '',
    'Sent via MediAid v1.0 · UNICEF Venture Fund',
  ].filter((l) => l !== undefined);
  return lines.join('\n');
}

export default function SMSEscalationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentScan } = useApp();
  const [selectedClinic, setSelectedClinic] = useState(0);
  const [selectedSupervisor, setSelectedSupervisor] = useState(0);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  // Mock GPS
  const gpsCoords = '5.9612°N, 10.1503°E (±15m)';

  const redMetrics = useMemo(() => {
    if (!currentScan) return ['No active scan'];
    return [
      getStatusForMetric('tbRisk', currentScan.tbRisk) === 'red' && `TB Risk: ${currentScan.tbRisk}%`,
      getStatusForMetric('afibRisk', currentScan.afibRisk) === 'red' && `AFib Risk: ${currentScan.afibRisk}%`,
      getStatusForMetric('heartRate', currentScan.heartRate) === 'red' && `Heart Rate: ${currentScan.heartRate} BPM`,
      getStatusForMetric('hemoglobin', currentScan.hemoglobin) === 'red' && `Hemoglobin: ${currentScan.hemoglobin} g/dL`,
      getStatusForMetric('spo2', currentScan.spo2) === 'red' && `SpO₂: ${currentScan.spo2}%`,
      getStatusForMetric('respiratoryRate', currentScan.respiratoryRate) === 'red' && `Resp. Rate: ${currentScan.respiratoryRate}/min`,
      getStatusForMetric('tremorRisk', currentScan.tremorRisk) === 'red' && `Tremor Risk: ${currentScan.tremorRisk}%`,
    ].filter(Boolean) as string[];
  }, [currentScan]);

  const smsText = buildSMSText(
    currentScan?.patientName ?? 'Unknown Patient',
    currentScan?.patientId ?? 'N/A',
    redMetrics,
    CLINICS[selectedClinic],
    gpsCoords,
    note
  );

  const handleSend = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const supervisor = SUPERVISORS[selectedSupervisor];

    // Try native SMS first
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      const { result } = await SMS.sendSMSAsync(
        [supervisor.phone],
        smsText
      );
      if (result === 'sent' || result === 'unknown') {
        setSent(true);
        Alert.alert(
          'SMS Sent',
          `Supervisor ${supervisor.name} has been notified via native SMS.`,
          [{ text: 'Done', onPress: () => router.back() }]
        );
      } else if (result === 'cancelled') {
        // User cancelled — don't mark sent
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      // Fallback: mock send (no SMS hardware — emulator/web)
      setSent(true);
      Alert.alert(
        '[Demo] SMS Composed',
        `SMS unavailable on this device. In production, this sends to ${supervisor.phone}.\n\nMessage logged for DHIS2 sync.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>SMS Escalation</Text>
          <Text style={styles.navSub}>Supervisor notification composer</Text>
        </View>
        <View style={styles.urgentBadge}>
          <MaterialIcons name="warning" size={12} color={theme.statusRed} />
          <Text style={styles.urgentBadgeText}>URGENT</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient summary */}
        {currentScan && (
          <View style={styles.patientBanner}>
            <MaterialIcons name="person" size={18} color={theme.statusRed} />
            <View style={{ flex: 1 }}>
              <Text style={styles.patientBannerName}>{currentScan.patientName}</Text>
              <Text style={styles.patientBannerId}>{currentScan.patientId} · {redMetrics.length} RED metric{redMetrics.length !== 1 ? 's' : ''}</Text>
            </View>
            <MaterialIcons name="warning" size={20} color={theme.statusRed} />
          </View>
        )}

        {/* GPS */}
        <View style={styles.gpsCard}>
          <MaterialIcons name="location-on" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsTitle}>Device GPS Location</Text>
            <Text style={styles.gpsCoords}>{gpsCoords}</Text>
          </View>
          <View style={[styles.gpsBadge]}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsBadgeText}>Live</Text>
          </View>
        </View>

        {/* Red metrics */}
        <Text style={styles.sectionTitle}>RED METRICS TO REPORT</Text>
        <View style={styles.redMetricsBox}>
          {redMetrics.map((m) => (
            <View key={m} style={styles.redMetricRow}>
              <MaterialIcons name="warning" size={14} color={theme.statusRed} />
              <Text style={styles.redMetricText}>{m}</Text>
            </View>
          ))}
        </View>

        {/* Select supervisor */}
        <Text style={styles.sectionTitle}>NOTIFY SUPERVISOR</Text>
        <View style={styles.supervisorGrid}>
          {SUPERVISORS.map((s, i) => (
            <Pressable
              key={s.name}
              style={[styles.supervisorCard, selectedSupervisor === i && styles.supervisorCardActive]}
              onPress={() => setSelectedSupervisor(i)}
            >
              <View style={[styles.supervisorAvatar, selectedSupervisor === i && { backgroundColor: theme.primary + '33' }]}>
                <MaterialIcons name="person" size={22} color={selectedSupervisor === i ? theme.primary : theme.textMuted} />
              </View>
              <Text style={[styles.supervisorName, selectedSupervisor === i && { color: theme.primary }]}>{s.name}</Text>
              <Text style={styles.supervisorRole}>{s.role}</Text>
              <Text style={[styles.supervisorPhone, selectedSupervisor === i && { color: theme.primary }]}>{s.phone}</Text>
              {selectedSupervisor === i && (
                <View style={styles.selectedCheck}>
                  <MaterialIcons name="check-circle" size={16} color={theme.primary} />
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Select nearest clinic */}
        <Text style={styles.sectionTitle}>REFERRAL CLINIC</Text>
        {CLINICS.map((c, i) => (
          <Pressable
            key={c.name}
            style={[styles.clinicCard, selectedClinic === i && styles.clinicCardActive]}
            onPress={() => setSelectedClinic(i)}
          >
            <MaterialIcons
              name="local-hospital"
              size={20}
              color={selectedClinic === i ? theme.statusGreen : theme.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.clinicName, selectedClinic === i && { color: theme.statusGreen }]}>{c.name}</Text>
              <Text style={styles.clinicMeta}>{c.distance} · {c.phone}</Text>
              <Text style={styles.clinicCoords}>{c.coords}</Text>
            </View>
            {selectedClinic === i && (
              <MaterialIcons name="check-circle" size={20} color={theme.statusGreen} />
            )}
          </Pressable>
        ))}

        {/* Optional note */}
        <Text style={styles.sectionTitle}>ADDITIONAL NOTE (OPTIONAL)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Patient refused escort / road blocked / other..."
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* SMS preview */}
        <Text style={styles.sectionTitle}>SMS PREVIEW</Text>
        <View style={styles.smsPreview}>
          <View style={styles.smsPreviewHeader}>
            <MaterialIcons name="sms" size={14} color={theme.textMuted} />
            <Text style={styles.smsPreviewLabel}>To: {SUPERVISORS[selectedSupervisor].phone}</Text>
          </View>
          <Text style={styles.smsPreviewText}>{smsText}</Text>
          <Text style={styles.smsCharCount}>{smsText.length} characters</Text>
        </View>

        {/* Send button */}
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            pressed && { opacity: 0.85 },
            sent && { backgroundColor: theme.statusGreen },
          ]}
          onPress={handleSend}
          disabled={sent}
        >
          <MaterialIcons name={sent ? 'check-circle' : 'send'} size={22} color="#FFF" />
          <Text style={styles.sendBtnText}>
            {sent ? 'SMS Sent' : 'Send SMS to Supervisor'}
          </Text>
        </Pressable>

        <Text style={styles.mockNote}>
          Opens the device native SMS composer. In production, integrates with UNICEF mHealth Gateway and Cameroon Telecom API for guaranteed delivery.
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
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.statusRed + '55',
  },
  urgentBadgeText: { fontSize: 10, fontWeight: '800', color: theme.statusRed, letterSpacing: 1 },
  patientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.statusRed + '55',
  },
  patientBannerName: { fontSize: 15, fontWeight: '700', color: theme.statusRed },
  patientBannerId: { fontSize: 11, color: theme.statusRed + 'AA', marginTop: 2 },
  gpsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  gpsTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  gpsCoords: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginTop: 2 },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gpsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.statusGreen },
  gpsBadgeText: { fontSize: 11, fontWeight: '700', color: theme.statusGreen },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  redMetricsBox: {
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.medium,
    padding: 14, gap: 8,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  redMetricRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redMetricText: { fontSize: 13, fontWeight: '600', color: theme.statusRed },
  supervisorGrid: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  supervisorCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: theme.border,
  },
  supervisorCardActive: {
    borderColor: theme.primary, backgroundColor: theme.primary + '0E',
  },
  supervisorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.background,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  supervisorName: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  supervisorRole: { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
  supervisorPhone: { fontSize: 11, color: theme.textSecondary, fontWeight: '600', marginTop: 4 },
  selectedCheck: { position: 'absolute', top: 8, right: 8 },
  clinicCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: theme.border,
  },
  clinicCardActive: { borderColor: theme.statusGreen, backgroundColor: theme.statusGreenBg },
  clinicName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  clinicMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  clinicCoords: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  noteInput: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, fontSize: 14, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.border, minHeight: 80,
  },
  smsPreview: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border,
  },
  smsPreviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  smsPreviewLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  smsPreviewText: {
    fontSize: 12, color: theme.textPrimary, lineHeight: 18,
    fontFamily: 'monospace',
  },
  smsCharCount: { fontSize: 10, color: theme.textMuted, textAlign: 'right', marginTop: 8 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: theme.statusRed, borderRadius: theme.radius.medium,
    padding: 18, marginTop: 20,
    shadowColor: theme.statusRed, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  mockNote: {
    fontSize: 11, color: theme.textMuted, textAlign: 'center',
    marginTop: 12, lineHeight: 17,
  },
});
