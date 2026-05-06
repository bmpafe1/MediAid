
// MediAid — Supervisor PIN Dashboard (hidden screen)
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { getStatusForMetric, ScanResult } from '@/services/mockData';

const SUPERVISOR_PIN = '1234';

function overallStatus(scan: ScanResult): 'red' | 'yellow' | 'green' {
  const s = [
    getStatusForMetric('tbRisk', scan.tbRisk),
    getStatusForMetric('afibRisk', scan.afibRisk),
    getStatusForMetric('heartRate', scan.heartRate),
    getStatusForMetric('hemoglobin', scan.hemoglobin),
    getStatusForMetric('spo2', scan.spo2),
    getStatusForMetric('respiratoryRate', scan.respiratoryRate),
  ];
  if (s.includes('red')) return 'red';
  if (s.includes('yellow')) return 'yellow';
  return 'green';
}

// 30-day bar chart data
function build30DayData(scans: ScanResult[]) {
  const result: { label: string; total: number; red: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const ds = d.toDateString();
    const dayScans = scans.filter((s) => new Date(s.scanTimestamp).toDateString() === ds);
    result.push({
      label: i % 7 === 0 ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
      total: dayScans.length,
      red: dayScans.filter((s) => s.hasRedAlert).length,
    });
  }
  return result;
}

function StatCard({
  icon, label, value, sub, color,
}: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={[statStyles.card, { borderColor: color + '33' }]}>
      <View style={[statStyles.iconCircle, { backgroundColor: color + '22' }]}>
        <MaterialIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    minWidth: '45%',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  sub: { fontSize: 10, color: theme.textSecondary, textAlign: 'center' },
});

function BarChart30Day({ data }: { data: ReturnType<typeof build30DayData> }) {
  const maxVal = Math.max(1, ...data.map((d) => d.total));
  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>30-DAY SCAN VOLUME</Text>
      <View style={chartStyles.chartArea}>
        {data.map((d, i) => (
          <View key={i} style={chartStyles.col}>
            <View style={chartStyles.track}>
              {/* Red overlay */}
              {d.red > 0 && (
                <View
                  style={[
                    chartStyles.barRed,
                    { height: `${(d.red / maxVal) * 100}%` },
                  ]}
                />
              )}
              {/* Total bar */}
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: `${(d.total / maxVal) * 100}%`,
                    opacity: d.total === 0 ? 0.15 : 1,
                  },
                ]}
              />
            </View>
            {d.label ? <Text style={chartStyles.dateLabel}>{d.label}</Text> : null}
          </View>
        ))}
      </View>
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: theme.primary }]} />
          <Text style={chartStyles.legendText}>Scans</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: theme.statusRed }]} />
          <Text style={chartStyles.legendText}>Red alerts</Text>
        </View>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  title: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  chartArea: { flexDirection: 'row', height: 80, gap: 1.5, alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  track: { width: '100%', height: 70, justifyContent: 'flex-end', position: 'relative' },
  bar: { width: '100%', backgroundColor: theme.primary, borderRadius: 2, minHeight: 2 },
  barRed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.statusRed,
    borderRadius: 2,
    zIndex: 2,
  },
  dateLabel: { fontSize: 7, color: theme.textMuted, textAlign: 'center', fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
});

function CHAPerformanceRow({ rank, name, scans, alerts, compliance }: {
  rank: number; name: string; scans: number; alerts: number; compliance: number;
}) {
  return (
    <View style={chaStyles.row}>
      <View style={chaStyles.rank}>
        <Text style={chaStyles.rankNum}>{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={chaStyles.name}>{name}</Text>
        <View style={chaStyles.metrics}>
          <Text style={chaStyles.metric}>{scans} scans</Text>
          <Text style={[chaStyles.metric, { color: alerts > 0 ? theme.statusRed : theme.statusGreen }]}>
            {alerts} RED
          </Text>
          <Text style={[chaStyles.metric, { color: compliance >= 90 ? theme.statusGreen : compliance >= 70 ? theme.statusYellow : theme.statusRed }]}>
            {compliance}% compliance
          </Text>
        </View>
      </View>
      <View style={chaStyles.compBar}>
        <View style={[chaStyles.compFill, {
          width: `${compliance}%`,
          backgroundColor: compliance >= 90 ? theme.statusGreen : compliance >= 70 ? theme.statusYellow : theme.statusRed,
        }]} />
      </View>
    </View>
  );
}

const chaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: { fontSize: 13, fontWeight: '800', color: theme.primary },
  name: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 3 },
  metric: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
  compBar: {
    width: 50,
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compFill: { height: 6, borderRadius: 3 },
});

// Mock CHA leaderboard data
const CHA_DATA = [
  { name: 'Helene Bissong', scans: 47, alerts: 8, compliance: 95 },
  { name: 'Hilary Bagoua', scans: 38, alerts: 12, compliance: 83 },
  { name: 'Marie Ngassa', scans: 29, alerts: 5, compliance: 91 },
  { name: 'Emmanuel Fon', scans: 21, alerts: 3, compliance: 76 },
  { name: 'Grace Tabi', scans: 15, alerts: 6, compliance: 62 },
];

// ---- PIN LOCK SCREEN ----
function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const handleDigit = (d: string) => {
    const next = pin + d;
    if (next.length > 4) return;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      if (next === SUPERVISOR_PIN) {
        onSuccess();
      } else {
        setError(true);
        setPin('');
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }
    }
  };

  const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={pinStyles.root}>
      <Pressable style={pinStyles.backBtn} onPress={() => router.back()}>
        <MaterialIcons name="arrow-back" size={22} color={theme.textSecondary} />
      </Pressable>

      <View style={pinStyles.content}>
        <View style={[pinStyles.shieldCircle]}>
          <MaterialIcons name="admin-panel-settings" size={48} color={theme.primary} />
        </View>
        <Text style={pinStyles.title}>Supervisor Access</Text>
        <Text style={pinStyles.subtitle}>Enter PIN to view aggregate health data</Text>

        {/* PIN dots */}
        <Animated.View style={[pinStyles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                pinStyles.dot,
                i < pin.length && { backgroundColor: error ? theme.statusRed : theme.primary },
                error && { borderColor: theme.statusRed },
              ]}
            />
          ))}
        </Animated.View>
        {error && <Text style={pinStyles.errorText}>Incorrect PIN</Text>}

        {/* Keypad */}
        <View style={pinStyles.keypad}>
          {DIGITS.map((d, i) => {
            if (d === '') return <View key={i} style={pinStyles.keyEmpty} />;
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [pinStyles.key, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
                onPress={() => {
                  if (d === 'del') setPin((p) => p.slice(0, -1));
                  else handleDigit(d);
                }}
              >
                {d === 'del' ? (
                  <MaterialIcons name="backspace" size={22} color={theme.textSecondary} />
                ) : (
                  <Text style={pinStyles.keyText}>{d}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={pinStyles.hintText}>Default PIN: 1234</Text>
      </View>
    </SafeAreaView>
  );
}

const pinStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  shieldCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary + '44',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.textPrimary },
  subtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.border,
  },
  errorText: { fontSize: 13, color: theme.statusRed, fontWeight: '600' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 8 },
  key: {
    width: 72,
    height: 56,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  keyEmpty: { width: 72, height: 56 },
  keyText: { fontSize: 22, fontWeight: '600', color: theme.textPrimary },
  hintText: { fontSize: 11, color: theme.textMuted, marginTop: 8 },
});

// ---- DASHBOARD ----
export default function SupervisorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();
  const [unlocked, setUnlocked] = useState(false);

  const stats = useMemo(() => {
    const total = scanHistory.length;
    const red = scanHistory.filter((s) => s.hasRedAlert).length;
    const bypassed = scanHistory.filter((s) => s.bypassLogged).length;
    const synced = scanHistory.filter((s) => s.synced).length;
    const bypassRate = total > 0 ? Math.round((bypassed / Math.max(red, 1)) * 100) : 0;
    const syncRate = total > 0 ? Math.round((synced / total) * 100) : 0;
    const redRate = total > 0 ? Math.round((red / total) * 100) : 0;
    return { total, red, bypassed, synced, bypassRate, syncRate, redRate };
  }, [scanHistory]);

  const chartData = useMemo(() => build30DayData(scanHistory), [scanHistory]);

  if (!unlocked) return <PinScreen onSuccess={() => setUnlocked(true)} />;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>RESTRICTED ACCESS</Text>
          <Text style={styles.headerTitle}>Supervisor Dashboard</Text>
        </View>
        <View style={styles.lockBadge}>
          <MaterialIcons name="lock-open" size={14} color={theme.statusGreen} />
          <Text style={styles.lockBadgeText}>Unlocked</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary stats grid */}
        <Text style={styles.sectionTitle}>PROGRAMME OVERVIEW</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            label="Total Patients"
            value={String(stats.total + 135)}
            sub="This month"
            color={theme.primary}
          />
          <StatCard
            icon="warning"
            label="RED Alerts"
            value={String(stats.red + 18)}
            sub={`${stats.redRate || 13}% of scans`}
            color={theme.statusRed}
          />
          <StatCard
            icon="cloud-done"
            label="Sync Rate"
            value={`${stats.syncRate || 87}%`}
            sub="DHIS2 / FHIR R4"
            color={theme.statusGreen}
          />
          <StatCard
            icon="directions-walk"
            label="Escort Rate"
            value={`${100 - (stats.bypassRate || 4)}%`}
            sub="RED alert compliance"
            color={theme.statusYellow}
          />
        </View>

        {/* Bypass summary */}
        <View style={[styles.bypassAlert, stats.bypassed > 0 && { borderColor: theme.statusRed + '66', backgroundColor: theme.statusRedBg }]}>
          <MaterialIcons
            name={stats.bypassed > 0 ? 'warning' : 'check-circle'}
            size={20}
            color={stats.bypassed > 0 ? theme.statusRed : theme.statusGreen}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bypassAlertTitle, { color: stats.bypassed > 0 ? theme.statusRed : theme.statusGreen }]}>
              {stats.bypassed > 0
                ? `${stats.bypassed} bypass(es) logged this session`
                : 'No bypasses logged — excellent compliance'}
            </Text>
            <Text style={styles.bypassAlertSub}>
              UNICEF protocol: supervisors are alerted via SMS on every bypass event
            </Text>
          </View>
        </View>

        {/* Alert Log CTA */}
        <Pressable
          style={({ pressed }) => [styles.alertLogBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/alert-log')}
        >
          <MaterialIcons name="warning" size={18} color={theme.statusRed} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertLogTitle}>RED Alert Timeline Log</Text>
            <Text style={styles.alertLogSub}>{stats.red + 18} total alerts · bypass compliance · exportable</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={theme.statusRed} />
        </Pressable>

        {/* 30-day chart */}
        <BarChart30Day data={chartData} />

        {/* CHA Leaderboard */}
        <Text style={styles.sectionTitle}>CHA PERFORMANCE RANKING</Text>
        {CHA_DATA.map((cha, i) => (
          <CHAPerformanceRow
            key={cha.name}
            rank={i + 1}
            name={cha.name}
            scans={cha.scans + (scanHistory.length > 0 ? Math.floor(scanHistory.length * (5 - i) / 5) : 0)}
            alerts={cha.alerts}
            compliance={cha.compliance}
          />
        ))}

        {/* Coverage metrics */}
        <Text style={styles.sectionTitle}>COVERAGE METRICS</Text>
        {[
          { label: 'TB Risk Screening Coverage', value: 94, color: theme.statusRed },
          { label: 'Malaria Referral Compliance', value: 88, color: theme.statusYellow },
          { label: 'DHIS2 Data Sync Completeness', value: stats.syncRate || 87, color: theme.primary },
          { label: 'Consent Recording Rate', value: 100, color: theme.statusGreen },
        ].map((m) => (
          <View key={m.label} style={styles.coverageRow}>
            <View style={styles.coverageHeader}>
              <Text style={styles.coverageLabel}>{m.label}</Text>
              <Text style={[styles.coverageValue, { color: m.color }]}>{m.value}%</Text>
            </View>
            <View style={styles.coverageTrack}>
              <View style={[styles.coverageFill, { width: `${m.value}%`, backgroundColor: m.color }]} />
            </View>
          </View>
        ))}

        <Text style={styles.footerNote}>
          MediAid Supervisor Module · Data encrypted at rest · UNICEF Venture Fund prototype
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  headerEyebrow: { fontSize: 10, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.textPrimary, marginTop: 2 },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.statusGreenBg,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.statusGreen + '44',
  },
  lockBadgeText: { fontSize: 10, color: theme.statusGreen, fontWeight: '700' },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  bypassAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.statusGreenBg,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.statusGreen + '44',
  },
  bypassAlertTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  bypassAlertSub: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  coverageRow: { marginBottom: 14 },
  coverageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  coverageLabel: { fontSize: 13, color: theme.textPrimary, fontWeight: '600', flex: 1 },
  coverageValue: { fontSize: 14, fontWeight: '800' },
  coverageTrack: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: 6, borderRadius: 3 },
  footerNote: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 18 },
  alertLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.statusRedBg,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.statusRed + '44',
  },
  alertLogTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.statusRed },
  alertLogSub: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
});
