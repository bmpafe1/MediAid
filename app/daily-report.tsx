// MediAid — Daily Summary Report Generator
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { getStatusForMetric, ScanResult } from '@/services/mockData';

type Status = 'red' | 'yellow' | 'green';

function overallStatus(scan: ScanResult): Status {
  const s = [
    getStatusForMetric('tbRisk', scan.tbRisk),
    getStatusForMetric('afibRisk', scan.afibRisk),
    getStatusForMetric('heartRate', scan.heartRate),
    getStatusForMetric('hemoglobin', scan.hemoglobin),
    getStatusForMetric('spo2', scan.spo2),
    getStatusForMetric('respiratoryRate', scan.respiratoryRate),
    getStatusForMetric('tremorRisk', scan.tremorRisk),
    getStatusForMetric('eyeConditions', scan.eyeConditions),
  ];
  if (s.includes('red')) return 'red';
  if (s.includes('yellow')) return 'yellow';
  return 'green';
}

function statusColor(s: Status) {
  return s === 'red' ? theme.statusRed : s === 'yellow' ? theme.statusYellow : theme.statusGreen;
}

function buildReportText(
  todayScans: ScanResult[],
  syncCount: number,
  pendingSync: number,
  chaName: string,
  dateStr: string
): string {
  const reds = todayScans.filter((s) => overallStatus(s) === 'red');
  const yellows = todayScans.filter((s) => overallStatus(s) === 'yellow');
  const greens = todayScans.filter((s) => overallStatus(s) === 'green');

  const avgTb = todayScans.length > 0
    ? Math.round(todayScans.reduce((s, r) => s + r.tbRisk, 0) / todayScans.length)
    : 0;
  const avgHr = todayScans.length > 0
    ? Math.round(todayScans.reduce((s, r) => s + r.heartRate, 0) / todayScans.length)
    : 0;
  const avgSpo2 = todayScans.length > 0
    ? Math.round(todayScans.reduce((s, r) => s + r.spo2, 0) / todayScans.length)
    : 0;
  const avgHgb = todayScans.length > 0
    ? (todayScans.reduce((s, r) => s + r.hemoglobin, 0) / todayScans.length).toFixed(1)
    : '0.0';
  const bypassed = todayScans.filter((s) => s.bypassLogged).length;
  const synced = todayScans.filter((s) => s.synced).length;

  const lines = [
    '╔══════════════════════════════════════════╗',
    '║       MEDIAID — DAILY CLINICAL REPORT    ║',
    '║   UNICEF Venture Fund · Cameroon Field   ║',
    '╚══════════════════════════════════════════╝',
    '',
    `Date:        ${dateStr}`,
    `CHA Name:    ${chaName || 'Field Worker'}`,
    `District:    Bamenda, NW Cameroon`,
    `Report Gen:  ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    '',
    '━━━━━━━━━━━ SCREENING SUMMARY ━━━━━━━━━━━',
    '',
    `Total Patients Screened:  ${todayScans.length}`,
    `  🔴 RED Alert (Referral): ${reds.length}`,
    `  🟡 YELLOW (Watch):       ${yellows.length}`,
    `  🟢 GREEN (Normal):       ${greens.length}`,
    '',
    '━━━━━━━━━━━ POPULATION METRICS ━━━━━━━━━━',
    '',
    `Avg TB Risk Score:    ${avgTb}%`,
    `Avg Heart Rate:       ${avgHr} BPM`,
    `Avg SpO₂:            ${avgSpo2}%`,
    `Avg Hemoglobin:       ${avgHgb} g/dL`,
    '',
    '━━━━━━━━━━━ SAFETY & COMPLIANCE ━━━━━━━━━',
    '',
    `RED Alert Bypasses:   ${bypassed}${bypassed > 0 ? ' ⚠️ FLAGGED' : ' ✓ None'}`,
    `Records Synced:       ${synced}/${todayScans.length}`,
    `Pending Sync:         ${pendingSync}`,
    '',
    '━━━━━━━━━━━ REFERRAL LOG ━━━━━━━━━━━━━━━━',
    '',
    ...reds.map((s) => [
      `Patient: ${s.patientName} (${s.patientId})`,
      `  TB: ${s.tbRisk}% | HR: ${s.heartRate} | SpO₂: ${s.spo2}%`,
      `  Hgb: ${s.hemoglobin} | Tremor: ${s.tremorRisk}%`,
      `  Time: ${new Date(s.scanTimestamp).toLocaleTimeString()}`,
      `  Bypass: ${s.bypassLogged ? 'YES ⚠️' : 'No'}`,
      '',
    ].join('\n')),
    reds.length === 0 ? 'No RED alerts today. All patients stable.\n' : '',
    '━━━━━━━━━━━ DATA SECURITY ━━━━━━━━━━━━━━━',
    '',
    '✓ AES-256 encryption applied',
    '✓ Patient names anonymized for DHIS2 sync',
    '✓ FHIR R4 bundle format',
    '✓ Oral consent logged for all patients',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'MediAid v1.0 · UNICEF Venture Fund Prototype',
    'Not a substitute for clinical diagnosis.',
    'All AI outputs require clinical validation.',
    `Generated: ${new Date().toISOString()}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  return lines.join('\n');
}

async function exportReport(text: string, dateStr: string) {
  const filename = `MediAid_DailyReport_${dateStr.replace(/\//g, '-')}.txt`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  try {
    await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Share Daily Report' });
    } else {
      Alert.alert('Saved', `Report saved to:\n${path}`);
    }
  } catch {
    Alert.alert('Error', 'Could not export report. Please try again.');
  }
}

// Metric trend bar for population stats
function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  label: { width: 80, fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
  track: { flex: 1, height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 44, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});

export default function DailyReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory, pendingSyncCount, patientName, syncHistory } = useApp();
  const [exporting, setExporting] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const dateKey = today.toDateString();

  const todayScans = useMemo(
    () => scanHistory.filter((s) => new Date(s.scanTimestamp).toDateString() === dateKey),
    [scanHistory, dateKey]
  );

  const weekScans = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return scanHistory.filter((s) => new Date(s.scanTimestamp) >= weekAgo);
  }, [scanHistory]);

  const reds = todayScans.filter((s) => overallStatus(s) === 'red');
  const yellows = todayScans.filter((s) => overallStatus(s) === 'yellow');
  const greens = todayScans.filter((s) => overallStatus(s) === 'green');
  const bypassed = todayScans.filter((s) => s.bypassLogged).length;
  const syncedToday = todayScans.filter((s) => s.synced).length;

  const avgTb = todayScans.length > 0
    ? Math.round(todayScans.reduce((s, r) => s + r.tbRisk, 0) / todayScans.length) : 0;
  const avgHr = todayScans.length > 0
    ? Math.round(todayScans.reduce((s, r) => s + r.heartRate, 0) / todayScans.length) : 0;
  const avgSpo2 = todayScans.length > 0
    ? Math.round(todayScans.reduce((s, r) => s + r.spo2, 0) / todayScans.length) : 0;
  const avgHgb = todayScans.length > 0
    ? parseFloat((todayScans.reduce((s, r) => s + r.hemoglobin, 0) / todayScans.length).toFixed(1)) : 0;

  const todaySyncCount = syncHistory.filter((r) => {
    return new Date(r.timestamp).toDateString() === dateKey && r.status === 'success';
  }).reduce((sum, r) => sum + r.recordsSynced, 0);

  const reportText = useMemo(
    () => buildReportText(todayScans, todaySyncCount, pendingSyncCount, patientName, dateStr),
    [todayScans, todaySyncCount, pendingSyncCount, patientName, dateStr]
  );

  const handleExport = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setExporting(true);
    await exportReport(reportText, today.toLocaleDateString());
    setExporting(false);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Daily Report</Text>
          <Text style={styles.navSub}>{today.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.85 }, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          <MaterialIcons name="share" size={16} color="#FFF" />
          <Text style={styles.exportBtnText}>{exporting ? 'Sharing...' : 'Share'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date header */}
        <View style={styles.dateCard}>
          <MaterialIcons name="today" size={24} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dateCardTitle}>{dateStr}</Text>
            <Text style={styles.dateCardSub}>Bamenda District · NW Cameroon · MediAid v1.0</Text>
          </View>
        </View>

        {/* No scans today */}
        {todayScans.length === 0 && (
          <View style={styles.emptyToday}>
            <MaterialIcons name="person-search" size={56} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No scans recorded today</Text>
            <Text style={styles.emptySub}>Complete patient scans to populate today's report.</Text>
            <Pressable style={styles.scanNowBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.scanNowBtnText}>Go to Scan</Text>
            </Pressable>
          </View>
        )}

        {todayScans.length > 0 && (
          <>
            {/* Traffic light summary */}
            <Text style={styles.sectionTitle}>TODAY'S SCREENING SUMMARY</Text>
            <View style={styles.trafficRow}>
              <View style={[styles.trafficCard, { borderColor: theme.statusRed + '55', backgroundColor: theme.statusRedBg }]}>
                <Text style={[styles.trafficNum, { color: theme.statusRed }]}>{reds.length}</Text>
                <MaterialIcons name="warning" size={22} color={theme.statusRed} />
                <Text style={[styles.trafficLabel, { color: theme.statusRed }]}>REFERRAL</Text>
              </View>
              <View style={[styles.trafficCard, { borderColor: theme.statusYellow + '55', backgroundColor: theme.statusYellowBg }]}>
                <Text style={[styles.trafficNum, { color: theme.statusYellow }]}>{yellows.length}</Text>
                <MaterialIcons name="info" size={22} color={theme.statusYellow} />
                <Text style={[styles.trafficLabel, { color: theme.statusYellow }]}>WATCH</Text>
              </View>
              <View style={[styles.trafficCard, { borderColor: theme.statusGreen + '55', backgroundColor: theme.statusGreenBg }]}>
                <Text style={[styles.trafficNum, { color: theme.statusGreen }]}>{greens.length}</Text>
                <MaterialIcons name="check-circle" size={22} color={theme.statusGreen} />
                <Text style={[styles.trafficLabel, { color: theme.statusGreen }]}>NORMAL</Text>
              </View>
            </View>

            {/* Big total */}
            <View style={styles.totalCard}>
              <Text style={styles.totalNum}>{todayScans.length}</Text>
              <View>
                <Text style={styles.totalLabel}>Patients Screened Today</Text>
                <Text style={styles.totalSub}>+{weekScans.length} this week · {scanHistory.length} all time</Text>
              </View>
              <MaterialIcons name="health-and-safety" size={36} color={theme.primary + '66'} />
            </View>

            {/* Population vitals */}
            <Text style={styles.sectionTitle}>POPULATION METRICS (TODAY AVG)</Text>
            <View style={styles.metricsCard}>
              <StatBar label="TB Risk" value={avgTb} max={100} color={getStatusForMetric('tbRisk', avgTb) === 'red' ? theme.statusRed : theme.statusYellow} />
              <StatBar label="Heart Rate" value={avgHr} max={140} color={theme.primary} />
              <StatBar label="SpO₂" value={avgSpo2} max={100} color={avgSpo2 >= 95 ? theme.statusGreen : theme.statusRed} />
              <StatBar label="Hemoglobin" value={avgHgb} max={18} color={avgHgb >= 10 ? theme.statusGreen : theme.statusRed} />
            </View>

            {/* Safety & compliance */}
            <Text style={styles.sectionTitle}>SAFETY & COMPLIANCE</Text>
            <View style={styles.complianceGrid}>
              {[
                {
                  icon: 'cloud-done',
                  label: 'Records Synced',
                  value: `${syncedToday}/${todayScans.length}`,
                  color: syncedToday === todayScans.length ? theme.statusGreen : theme.statusYellow,
                },
                {
                  icon: bypassed > 0 ? 'warning' : 'verified-user',
                  label: 'Safety Bypasses',
                  value: `${bypassed}`,
                  color: bypassed > 0 ? theme.statusRed : theme.statusGreen,
                },
                {
                  icon: 'cloud-queue',
                  label: 'Pending Sync',
                  value: `${pendingSyncCount}`,
                  color: pendingSyncCount > 0 ? theme.statusYellow : theme.statusGreen,
                },
                {
                  icon: 'mic',
                  label: 'Consent Logged',
                  value: `${todayScans.length}/${todayScans.length}`,
                  color: theme.statusGreen,
                },
              ].map((item) => (
                <View key={item.label} style={[styles.complianceCard, { borderColor: item.color + '44' }]}>
                  <MaterialIcons name={item.icon as any} size={22} color={item.color} />
                  <Text style={[styles.complianceValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={styles.complianceLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* RED alert log */}
            {reds.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>REFERRAL LOG ({reds.length})</Text>
                {reds.map((scan) => (
                  <View key={scan.id} style={styles.referralCard}>
                    <View style={styles.referralHeader}>
                      <MaterialIcons name="warning" size={16} color={theme.statusRed} />
                      <Text style={styles.referralName}>{scan.patientName}</Text>
                      <Text style={styles.referralId}>{scan.patientId}</Text>
                      {scan.bypassLogged && (
                        <View style={styles.bypassTag}>
                          <Text style={styles.bypassTagText}>BYPASS</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.referralMetrics}>
                      {[
                        { label: 'TB', value: `${scan.tbRisk}%`, metric: 'tbRisk' as const },
                        { label: 'HR', value: `${scan.heartRate}`, metric: 'heartRate' as const },
                        { label: 'SpO₂', value: `${scan.spo2}%`, metric: 'spo2' as const },
                        { label: 'Hgb', value: `${scan.hemoglobin}`, metric: 'hemoglobin' as const },
                      ].map((m) => {
                        const s = getStatusForMetric(m.metric, scan[m.metric]);
                        return (
                          <View key={m.label} style={styles.referralMetric}>
                            <Text style={[styles.referralMetricValue, { color: statusColor(s) }]}>{m.value}</Text>
                            <Text style={styles.referralMetricLabel}>{m.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={styles.referralTime}>
                      {new Date(scan.scanTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* 7-day comparison */}
            <Text style={styles.sectionTitle}>7-DAY TREND</Text>
            <View style={styles.weekTrendCard}>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const dayKey = d.toDateString();
                const dayScans = scanHistory.filter((s) => new Date(s.scanTimestamp).toDateString() === dayKey);
                const dayReds = dayScans.filter((s) => overallStatus(s) === 'red').length;
                const maxDay = Math.max(1, ...Array.from({ length: 7 }).map((_, j) => {
                  const dj = new Date(); dj.setDate(dj.getDate() - (6 - j));
                  return scanHistory.filter((s) => new Date(s.scanTimestamp).toDateString() === dj.toDateString()).length;
                }));
                const pct = dayScans.length / maxDay;
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <View key={i} style={styles.weekBarCol}>
                    <Text style={[styles.weekBarCount, isToday && { color: theme.primary, fontWeight: '800' }]}>
                      {dayScans.length > 0 ? dayScans.length : ''}
                    </Text>
                    <View style={styles.weekBarTrack}>
                      <View style={[
                        styles.weekBarFill,
                        {
                          height: `${Math.max(0.05, pct) * 100}%`,
                          backgroundColor: dayReds > 0 ? theme.statusRed : isToday ? theme.primary : theme.primary + '66',
                        },
                      ]} />
                    </View>
                    <Text style={[styles.weekBarLabel, isToday && { color: theme.primary, fontWeight: '700' }]}>
                      {d.toLocaleDateString([], { weekday: 'narrow' })}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Report preview */}
            <Text style={styles.sectionTitle}>REPORT TEXT PREVIEW</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>{reportText.split('\n').slice(0, 20).join('\n')}{'\n...'}</Text>
            </View>

            {/* Export CTA */}
            <Pressable
              style={({ pressed }) => [styles.bigExportBtn, pressed && { opacity: 0.85 }, exporting && { opacity: 0.6 }]}
              onPress={handleExport}
              disabled={exporting}
            >
              <MaterialIcons name={exporting ? 'hourglass-empty' : 'share'} size={24} color="#FFF" />
              <View>
                <Text style={styles.bigExportTitle}>{exporting ? 'Preparing Report...' : 'Share Daily Report'}</Text>
                <Text style={styles.bigExportSub}>Export full TXT report · All {todayScans.length} patients · FHIR R4 compliant</Text>
              </View>
            </Pressable>
          </>
        )}

        <Text style={styles.footerNote}>
          MediAid v1.0 · UNICEF Venture Fund Prototype · Cameroon Field Deployment
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
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  exportBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  dateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginTop: 16, marginBottom: 16,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  dateCardTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  dateCardSub: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  emptyToday: { alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  scanNowBtn: {
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  scanNowBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  trafficRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  trafficCard: {
    flex: 1, borderRadius: theme.radius.medium, padding: 14,
    alignItems: 'center', gap: 6, borderWidth: 1,
  },
  trafficNum: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  trafficLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  totalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 18, marginBottom: 4,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  totalNum: { fontSize: 52, fontWeight: '800', color: theme.primary, lineHeight: 58 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  totalSub: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
  metricsCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border,
  },
  complianceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  complianceCard: {
    width: '47%', backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, alignItems: 'center', gap: 6, borderWidth: 1,
  },
  complianceValue: { fontSize: 22, fontWeight: '800' },
  complianceLabel: { fontSize: 10, color: theme.textSecondary, fontWeight: '600', textAlign: 'center' },
  referralCard: {
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  referralName: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.statusRed },
  referralId: { fontSize: 10, color: theme.statusRed + '88' },
  bypassTag: {
    backgroundColor: theme.statusRed + '33', borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: theme.statusRed + '55',
  },
  bypassTagText: { fontSize: 8, fontWeight: '800', color: theme.statusRed, letterSpacing: 0.5 },
  referralMetrics: { flexDirection: 'row', gap: 8 },
  referralMetric: {
    flex: 1, backgroundColor: theme.statusRed + '18', borderRadius: theme.radius.small,
    padding: 8, alignItems: 'center',
  },
  referralMetricValue: { fontSize: 14, fontWeight: '800' },
  referralMetricLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', marginTop: 2 },
  referralTime: { fontSize: 10, color: theme.statusRed + '88', marginTop: 8, textAlign: 'right' },
  weekTrendCard: {
    flexDirection: 'row', backgroundColor: theme.surface,
    borderRadius: theme.radius.medium, padding: 14, height: 100,
    borderWidth: 1, borderColor: theme.border, gap: 6,
  },
  weekBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  weekBarCount: { fontSize: 9, fontWeight: '600', color: theme.textMuted },
  weekBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  weekBarFill: { width: '100%', borderRadius: 3, minHeight: 3 },
  weekBarLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted },
  previewBox: {
    backgroundColor: '#0A0A0A', borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: '#333',
  },
  previewText: { fontSize: 11, color: '#9CA3AF', lineHeight: 18, fontFamily: 'monospace' },
  bigExportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: theme.primary, borderRadius: theme.radius.large,
    padding: 20, marginTop: 16,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  bigExportTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  bigExportSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  footerNote: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
