// MediAid — RED Alert Timeline Log
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { getStatusForMetric, ScanResult } from '@/services/mockData';

function getRedMetrics(scan: ScanResult): string[] {
  return [
    getStatusForMetric('tbRisk', scan.tbRisk) === 'red' && `TB Risk ${scan.tbRisk}%`,
    getStatusForMetric('afibRisk', scan.afibRisk) === 'red' && `AFib ${scan.afibRisk}%`,
    getStatusForMetric('heartRate', scan.heartRate) === 'red' && `HR ${scan.heartRate} BPM`,
    getStatusForMetric('hemoglobin', scan.hemoglobin) === 'red' && `Hgb ${scan.hemoglobin} g/dL`,
    getStatusForMetric('spo2', scan.spo2) === 'red' && `SpO₂ ${scan.spo2}%`,
    getStatusForMetric('respiratoryRate', scan.respiratoryRate) === 'red' && `RR ${scan.respiratoryRate}/min`,
    getStatusForMetric('tremorRisk', scan.tremorRisk) === 'red' && `Tremor ${scan.tremorRisk}%`,
    getStatusForMetric('eyeConditions', scan.eyeConditions) === 'red' && `Eye ${scan.eyeConditions} cond.`,
  ].filter(Boolean) as string[];
}

function AlertCard({ scan, index }: { scan: ScanResult; index: number }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const redMetrics = getRedMetrics(scan);
  const date = new Date(scan.scanTimestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Pressable
      style={styles.alertCard}
      onPress={() => setExpanded((v) => !v)}
    >
      {/* Timeline connector */}
      <View style={styles.timelineCol}>
        <View style={styles.timelineDot} />
        {index > 0 && <View style={styles.timelineLine} />}
      </View>

      <View style={{ flex: 1 }}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{scan.patientName}</Text>
            <Text style={styles.patientId}>{scan.patientId}</Text>
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.timeStr}>{timeStr}</Text>
            <Text style={styles.dateStr}>{dateStr}</Text>
          </View>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={18}
            color={theme.textMuted}
          />
        </View>

        {/* Red metrics pills */}
        <View style={styles.metricsRow}>
          {redMetrics.map((m) => (
            <View key={m} style={styles.metricPill}>
              <MaterialIcons name="warning" size={10} color={theme.statusRed} />
              <Text style={styles.metricPillText}>{m}</Text>
            </View>
          ))}
        </View>

        {/* Bypass + sync status */}
        <View style={styles.statusRow}>
          {scan.bypassLogged ? (
            <View style={styles.bypassBadge}>
              <MaterialIcons name="warning" size={12} color={theme.statusRed} />
              <Text style={styles.bypassBadgeText}>BYPASS LOGGED · SMS SENT</Text>
            </View>
          ) : (
            <View style={styles.escortBadge}>
              <MaterialIcons name="directions-walk" size={12} color={theme.statusGreen} />
              <Text style={styles.escortBadgeText}>Patient Escorted</Text>
            </View>
          )}
          <View style={[styles.syncBadge, { backgroundColor: scan.synced ? theme.statusGreenBg : theme.statusYellowBg, borderColor: scan.synced ? theme.statusGreen + '44' : theme.statusYellow + '44' }]}>
            <MaterialIcons name={scan.synced ? 'cloud-done' : 'cloud-queue'} size={11} color={scan.synced ? theme.statusGreen : theme.statusYellow} />
            <Text style={[styles.syncBadgeText, { color: scan.synced ? theme.statusGreen : theme.statusYellow }]}>
              {scan.synced ? 'Synced' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Expanded detail */}
        {expanded && (
          <View style={styles.expandedBox}>
            <View style={styles.expandedGrid}>
              {[
                { label: 'TB Risk', value: `${scan.tbRisk}%` },
                { label: 'AFib Risk', value: `${scan.afibRisk}%` },
                { label: 'Heart Rate', value: `${scan.heartRate} BPM` },
                { label: 'Hemoglobin', value: `${scan.hemoglobin} g/dL` },
                { label: 'SpO₂', value: `${scan.spo2}%` },
                { label: 'Resp. Rate', value: `${scan.respiratoryRate}/min` },
                { label: 'Tremor Risk', value: `${scan.tremorRisk}%` },
                { label: 'Eye Cond.', value: `${scan.eyeConditions}` },
              ].map((m) => (
                <View key={m.label} style={styles.expandedMetric}>
                  <Text style={styles.expandedMetricVal}>{m.value}</Text>
                  <Text style={styles.expandedMetricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
            {scan.bypassReason && (
              <View style={styles.bypassReason}>
                <MaterialIcons name="info" size={12} color={theme.statusRed} />
                <Text style={styles.bypassReasonText}>Bypass reason: {scan.bypassReason}</Text>
              </View>
            )}
            <Pressable
              style={styles.viewDetailBtn}
              onPress={() => router.push({ pathname: '/patient-detail', params: { scanId: scan.id } })}
            >
              <MaterialIcons name="open-in-new" size={14} color={theme.primary} />
              <Text style={styles.viewDetailText}>View Full Report</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

async function exportAlertLog(alerts: ScanResult[]) {
  const lines = [
    '=== MediAid RED Alert Log ===',
    `Exported: ${new Date().toISOString()}`,
    `Total RED alerts: ${alerts.length}`,
    `Bypassed: ${alerts.filter((a) => a.bypassLogged).length}`,
    `Escorted: ${alerts.filter((a) => !a.bypassLogged).length}`,
    '',
    ...alerts.map((s, i) => [
      `--- Alert ${i + 1} ---`,
      `Patient: ${s.patientName} (${s.patientId})`,
      `Time: ${new Date(s.scanTimestamp).toLocaleString()}`,
      `Bypass: ${s.bypassLogged ? 'YES — ' + (s.bypassReason ?? 'No reason') : 'No'}`,
      `Synced: ${s.synced ? 'Yes' : 'Pending'}`,
      `TB: ${s.tbRisk}% | AFib: ${s.afibRisk}% | HR: ${s.heartRate} | SpO₂: ${s.spo2}%`,
    ].join('\n')),
    '',
    '=== END LOG ===',
  ];
  const path = `${FileSystem.cacheDirectory}MediAid_AlertLog_${Date.now()}.txt`;
  try {
    await FileSystem.writeAsStringAsync(path, lines.join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Export Alert Log' });
    else Alert.alert('Saved', `Log saved to: ${path}`);
  } catch {
    Alert.alert('Error', 'Could not export log.');
  }
}

export default function AlertLogScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();

  const redAlerts = useMemo(
    () => scanHistory.filter((s) => s.hasRedAlert).reverse(),
    [scanHistory]
  );

  const bypassCount = redAlerts.filter((s) => s.bypassLogged).length;
  const escortCount = redAlerts.filter((s) => !s.bypassLogged).length;
  const bypassRate = redAlerts.length > 0 ? Math.round((bypassCount / redAlerts.length) * 100) : 0;
  const complianceRate = 100 - bypassRate;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>RED Alert Log</Text>
          <Text style={styles.navSub}>{redAlerts.length} alert{redAlerts.length !== 1 ? 's' : ''} recorded</Text>
        </View>
        {redAlerts.length > 0 && (
          <Pressable style={styles.exportBtn} onPress={() => exportAlertLog(redAlerts)}>
            <MaterialIcons name="share" size={16} color={theme.primary} />
            <Text style={styles.exportBtnText}>Export</Text>
          </Pressable>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: theme.statusRed + '44' }]}>
          <Text style={[styles.statValue, { color: theme.statusRed }]}>{redAlerts.length}</Text>
          <Text style={styles.statLabel}>Total{'\n'}RED Alerts</Text>
        </View>
        <View style={[styles.statCard, { borderColor: theme.statusGreen + '44' }]}>
          <Text style={[styles.statValue, { color: theme.statusGreen }]}>{escortCount}</Text>
          <Text style={styles.statLabel}>Patients{'\n'}Escorted</Text>
        </View>
        <View style={[styles.statCard, { borderColor: bypassCount > 0 ? theme.statusRed + '44' : theme.border }]}>
          <Text style={[styles.statValue, { color: bypassCount > 0 ? theme.statusRed : theme.textPrimary }]}>{bypassCount}</Text>
          <Text style={styles.statLabel}>Safety{'\n'}Bypasses</Text>
        </View>
        <View style={[styles.statCard, { borderColor: theme.statusGreen + '44' }]}>
          <Text style={[styles.statValue, { color: complianceRate >= 90 ? theme.statusGreen : theme.statusYellow }]}>
            {complianceRate}%
          </Text>
          <Text style={styles.statLabel}>Protocol{'\n'}Compliance</Text>
        </View>
      </View>

      {/* Compliance bar */}
      <View style={styles.complianceCard}>
        <View style={styles.complianceHeader}>
          <MaterialIcons
            name={complianceRate >= 90 ? 'verified' : 'warning'}
            size={16}
            color={complianceRate >= 90 ? theme.statusGreen : theme.statusYellow}
          />
          <Text style={[styles.complianceLabel, { color: complianceRate >= 90 ? theme.statusGreen : theme.statusYellow }]}>
            {complianceRate >= 90 ? 'Excellent Protocol Compliance' : 'Compliance Below Target (90%)'}
          </Text>
          <Text style={[styles.compliancePct, { color: complianceRate >= 90 ? theme.statusGreen : theme.statusYellow }]}>
            {complianceRate}%
          </Text>
        </View>
        <View style={styles.complianceTrack}>
          <View style={[styles.complianceFill, {
            width: `${complianceRate}%`,
            backgroundColor: complianceRate >= 90 ? theme.statusGreen : theme.statusYellow,
          }]} />
        </View>
        <Text style={styles.complianceSub}>UNICEF target: ≥90% patients escorted · Supervisor alerted on every bypass</Text>
      </View>

      {/* Timeline */}
      {redAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="check-circle" size={72} color={theme.statusGreen} />
          <Text style={styles.emptyTitle}>No RED Alerts</Text>
          <Text style={styles.emptySub}>No life-threatening conditions detected yet. Complete a scan with Demo Mode ON to generate a RED alert.</Text>
        </View>
      ) : (
        <FlatList
          data={redAlerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <AlertCard scan={item} index={index} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.timelineHeader}>ALERT TIMELINE (newest first)</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  navTitle: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  navSub: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 10, alignItems: 'center', borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 9, color: theme.textMuted, textAlign: 'center', fontWeight: '600', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  complianceCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    marginHorizontal: 16, marginBottom: 12, padding: 14,
    borderWidth: 1, borderColor: theme.border,
  },
  complianceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  complianceLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  compliancePct: { fontSize: 16, fontWeight: '800' },
  complianceTrack: {
    height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  complianceFill: { height: 8, borderRadius: 4 },
  complianceSub: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  timelineHeader: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
  },
  alertCard: {
    flexDirection: 'row', gap: 12, marginBottom: 12,
  },
  timelineCol: { alignItems: 'center', width: 20, paddingTop: 4 },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: theme.statusRed,
    borderWidth: 2, borderColor: theme.statusRed + '55',
    shadowColor: theme.statusRed, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
  },
  timelineLine: {
    flex: 1, width: 2, backgroundColor: theme.statusRed + '33', marginTop: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  patientName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  patientId: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  timeBlock: { alignItems: 'flex-end', marginRight: 4 },
  timeStr: { fontSize: 13, fontWeight: '700', color: theme.statusRed },
  dateStr: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metricPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  metricPillText: { fontSize: 10, fontWeight: '700', color: theme.statusRed },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bypassBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  bypassBadgeText: { fontSize: 9, fontWeight: '800', color: theme.statusRed, letterSpacing: 0.3 },
  escortBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  escortBadgeText: { fontSize: 9, fontWeight: '800', color: theme.statusGreen },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
  },
  syncBadgeText: { fontSize: 9, fontWeight: '700' },
  expandedBox: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 12, marginTop: 10, borderWidth: 1, borderColor: theme.border, gap: 10,
  },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expandedMetric: {
    backgroundColor: theme.surface, borderRadius: theme.radius.small,
    padding: 8, alignItems: 'center', minWidth: '22%',
  },
  expandedMetricVal: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  expandedMetricLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  bypassReason: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.small,
    padding: 8, borderWidth: 1, borderColor: theme.statusRed + '33',
  },
  bypassReasonText: { fontSize: 12, color: theme.statusRed, flex: 1 },
  viewDetailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primary + '15', borderRadius: theme.radius.small,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.primary + '33',
    alignSelf: 'flex-start',
  },
  viewDetailText: { fontSize: 13, fontWeight: '700', color: theme.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
});
