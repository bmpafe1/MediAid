// Powered by OnSpace.AI — Patient History Screen
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useMemo } from 'react';
import {
  FlatList,
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
import { t } from '@/constants/i18n';
import { ScanResult, getStatusForMetric } from '@/services/mockData';

// --- 30-Day Heatmap ---
function buildHeatmap(scans: ScanResult[]) {
  const days: { date: string; label: string; count: number; hasRed: boolean }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toDateString();
    const dayScans = scans.filter((s) => new Date(s.scanTimestamp).toDateString() === dateStr);
    days.push({
      date: dateStr,
      label: d.toLocaleDateString([], { weekday: 'narrow' }),
      count: dayScans.length,
      hasRed: dayScans.some((s) => s.hasRedAlert),
    });
  }
  return days;
}

function HeatmapCell({ day }: { day: ReturnType<typeof buildHeatmap>[0] }) {
  const bg =
    day.count === 0
      ? theme.surface
      : day.hasRed
      ? theme.statusRed + (day.count >= 3 ? 'EE' : day.count === 2 ? 'AA' : '66')
      : theme.primary + (day.count >= 3 ? 'EE' : day.count === 2 ? 'AA' : '55');
  return (
    <View style={[heatStyles.cell, { backgroundColor: bg }]}>
      {day.count > 0 && (
        <Text style={heatStyles.cellNum}>{day.count}</Text>
      )}
    </View>
  );
}

function CaseHeatmap({ scans, lang }: { scans: ScanResult[]; lang: 'en' | 'fr' }) {
  const days = useMemo(() => buildHeatmap(scans), [scans]);
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <View style={heatStyles.container}>
      <View style={heatStyles.headerRow}>
        <Text style={heatStyles.title}>{lang === 'fr' ? 'Activité 30 Jours' : '30-Day Activity'}</Text>
        <View style={heatStyles.legend}>
          <View style={[heatStyles.legendDot, { backgroundColor: theme.primary + '66' }]} />
          <Text style={heatStyles.legendLabel}>Scan</Text>
          <View style={[heatStyles.legendDot, { backgroundColor: theme.statusRed + '88' }]} />
          <Text style={heatStyles.legendLabel}>Alert</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={heatStyles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={heatStyles.week}>
              {week.map((day, di) => (
                <HeatmapCell key={`${wi}-${di}`} day={day} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={heatStyles.sub}>
        {lang === 'fr' ? `${scans.length} patients enregistrés ce mois` : `${scans.length} patients recorded this month`}
      </Text>
    </View>
  );
}

const heatStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, letterSpacing: 0.5 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600', marginRight: 6 },
  grid: { flexDirection: 'row', gap: 3 },
  week: { gap: 3 },
  cell: {
    width: 18,
    height: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cellNum: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  sub: { fontSize: 10, color: theme.textMuted, marginTop: 8, textAlign: 'right' },
});

type Filter = 'all' | 'red' | 'yellow' | 'green';

function overallStatus(scan: ScanResult): 'red' | 'yellow' | 'green' {
  const statuses = [
    getStatusForMetric('tbRisk', scan.tbRisk),
    getStatusForMetric('afibRisk', scan.afibRisk),
    getStatusForMetric('heartRate', scan.heartRate),
    getStatusForMetric('hemoglobin', scan.hemoglobin),
    getStatusForMetric('spo2', scan.spo2),
    getStatusForMetric('respiratoryRate', scan.respiratoryRate),
  ];
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}

function statusColor(s: 'red' | 'yellow' | 'green') {
  if (s === 'red') return theme.statusRed;
  if (s === 'yellow') return theme.statusYellow;
  return theme.statusGreen;
}
function statusBg(s: 'red' | 'yellow' | 'green') {
  if (s === 'red') return theme.statusRedBg;
  if (s === 'yellow') return theme.statusYellowBg;
  return theme.statusGreenBg;
}

function PatientCard({ scan, lang, onPress }: { scan: ScanResult; lang: 'en' | 'fr'; onPress: () => void }) {
  const status = overallStatus(scan);
  const col = statusColor(status);
  const bg = statusBg(status);
  const date = new Date(scan.scanTimestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: col },
        pressed && { opacity: 0.88 },
      ]}
      onPress={onPress}
    >
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: bg, borderColor: col + '55' }]}>
        <MaterialIcons
          name={status === 'red' ? 'warning' : status === 'yellow' ? 'info' : 'check-circle'}
          size={18}
          color={col}
        />
        <Text style={[styles.statusBadgeText, { color: col }]}>
          {status === 'red' ? t('status_referral', lang) : status === 'yellow' ? t('status_watch', lang) : t('status_normal', lang)}
        </Text>
      </View>

      {/* Patient info */}
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName}>{scan.patientName}</Text>
          <Text style={styles.patientId}>{scan.patientId}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeStr}>{timeStr}</Text>
          <Text style={styles.dateStr}>{dateStr}</Text>
        </View>
      </View>

      {/* Mini metrics */}
      <View style={styles.metricsRow}>
        {([
          { label: t('metric_tb', lang), value: `${scan.tbRisk}%`, metric: 'tbRisk' as keyof ScanResult },
          { label: t('metric_hr', lang), value: `${scan.heartRate}`, metric: 'heartRate' as keyof ScanResult },
          { label: t('metric_spo2', lang), value: `${scan.spo2}%`, metric: 'spo2' as keyof ScanResult },
          { label: t('metric_hgb', lang), value: `${scan.hemoglobin}`, metric: 'hemoglobin' as keyof ScanResult },
          { label: t('metric_rr', lang), value: `${scan.respiratoryRate}`, metric: 'respiratoryRate' as keyof ScanResult },
        ] as { label: string; value: string; metric: keyof ScanResult }[]).map((m) => {
          const s = getStatusForMetric(m.metric, scan[m.metric] as number);
          return (
            <View key={m.label} style={styles.miniMetric}>
              <Text style={[styles.miniVal, { color: statusColor(s) }]}>{m.value}</Text>
              <Text style={styles.miniLabel}>{m.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Sync status + bypass indicator */}
      <View style={styles.cardFooter}>
        <View style={styles.footerTag}>
          <MaterialIcons
            name={scan.synced ? 'cloud-done' : 'cloud-queue'}
            size={12}
            color={scan.synced ? theme.statusGreen : theme.statusYellow}
          />
          <Text style={[styles.footerTagText, { color: scan.synced ? theme.statusGreen : theme.statusYellow }]}>
            {scan.synced ? 'Synced' : 'Pending sync'}
          </Text>
        </View>
        {scan.bypassLogged && (
          <View style={styles.footerTag}>
            <MaterialIcons name="warning" size={12} color={theme.statusRed} />
            <Text style={[styles.footerTagText, { color: theme.statusRed }]}>Bypass logged</Text>
          </View>
        )}
        <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory, setCurrentScan, language } = useApp();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const FILTERS: { id: Filter; label: string; icon: string }[] = [
    { id: 'all', label: t('history_filter_all', language), icon: 'list' },
    { id: 'red', label: t('history_filter_red', language), icon: 'warning' },
    { id: 'yellow', label: t('history_filter_yellow', language), icon: 'info' },
    { id: 'green', label: t('history_filter_green', language), icon: 'check-circle' },
  ];

  const filtered = useMemo(() => {
    let result = [...scanHistory];
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.patientName.toLowerCase().includes(q) ||
          s.patientId.toLowerCase().includes(q)
      );
    }
    if (filter !== 'all') {
      result = result.filter((s) => overallStatus(s) === filter);
    }
    return result;
  }, [scanHistory, query, filter]);

  // Stats
  const redCount = scanHistory.filter((s) => overallStatus(s) === 'red').length;
  const yellowCount = scanHistory.filter((s) => overallStatus(s) === 'yellow').length;
  const greenCount = scanHistory.filter((s) => overallStatus(s) === 'green').length;

  const handleCardPress = (scan: ScanResult) => {
    setCurrentScan(scan);
    router.push({ pathname: '/patient-detail', params: { scanId: scan.id } });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('history_title', language)}</Text>
          <Text style={styles.headerSub}>{scanHistory.length} {language === 'fr' ? 'patients enregistrés' : 'patients recorded'}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/daily-report')}
        >
          <MaterialIcons name="summarize" size={14} color={theme.statusGreen} />
          <Text style={styles.reportBtnText}>Daily Report</Text>
        </Pressable>
      </View>

      {/* 30-Day Heatmap */}
      <CaseHeatmap scans={scanHistory} lang={language} />

      {/* Summary pills */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryPill, { backgroundColor: theme.statusRedBg, borderColor: theme.statusRed + '55' }]}>
          <MaterialIcons name="warning" size={14} color={theme.statusRed} />
          <Text style={[styles.summaryNum, { color: theme.statusRed }]}>{redCount}</Text>
          <Text style={[styles.summaryLabel, { color: theme.statusRed }]}>{language === 'fr' ? 'Rouge' : 'Red'}</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: theme.statusYellowBg, borderColor: theme.statusYellow + '55' }]}>
          <MaterialIcons name="info" size={14} color={theme.statusYellow} />
          <Text style={[styles.summaryNum, { color: theme.statusYellow }]}>{yellowCount}</Text>
          <Text style={[styles.summaryLabel, { color: theme.statusYellow }]}>{language === 'fr' ? 'Jaune' : 'Yellow'}</Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: theme.statusGreenBg, borderColor: theme.statusGreen + '55' }]}>
          <MaterialIcons name="check-circle" size={14} color={theme.statusGreen} />
          <Text style={[styles.summaryNum, { color: theme.statusGreen }]}>{greenCount}</Text>
          <Text style={[styles.summaryLabel, { color: theme.statusGreen }]}>{language === 'fr' ? 'Vert' : 'Green'}</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('history_search', language)}
          placeholderTextColor={theme.textMuted}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            style={[
              styles.filterChip,
              filter === f.id && {
                backgroundColor: f.id === 'red' ? theme.statusRedBg : f.id === 'yellow' ? theme.statusYellowBg : f.id === 'green' ? theme.statusGreenBg : theme.primary + '22',
                borderColor: f.id === 'red' ? theme.statusRed : f.id === 'yellow' ? theme.statusYellow : f.id === 'green' ? theme.statusGreen : theme.primary,
              },
            ]}
            onPress={() => setFilter(f.id)}
          >
            <MaterialIcons
              name={f.icon as any}
              size={14}
              color={
                filter === f.id
                  ? f.id === 'red' ? theme.statusRed : f.id === 'yellow' ? theme.statusYellow : f.id === 'green' ? theme.statusGreen : theme.primary
                  : theme.textMuted
              }
            />
            <Text
              style={[
                styles.filterChipText,
                filter === f.id && {
                  color: f.id === 'red' ? theme.statusRed : f.id === 'yellow' ? theme.statusYellow : f.id === 'green' ? theme.statusGreen : theme.primary,
                },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {scanHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="person-search" size={64} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>{t('history_empty', language)}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={64} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>{t('history_no_results', language)}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PatientCard
              scan={item}
              lang={language}
              onPress={() => handleCardPress(item)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 16, paddingTop: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  reportBtnText: { fontSize: 11, fontWeight: '700', color: theme.statusGreen },
  headerTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary },
  headerSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  summaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  summaryNum: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.textPrimary },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 10,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  patientName: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  patientId: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  timeBlock: { alignItems: 'flex-end' },
  timeStr: { fontSize: 15, fontWeight: '700', color: theme.primary },
  dateStr: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  miniMetric: {
    flex: 1,
    backgroundColor: theme.background,
    borderRadius: theme.radius.small,
    paddingVertical: 6,
    alignItems: 'center',
  },
  miniVal: { fontSize: 14, fontWeight: '700' },
  miniLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.background,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  footerTagText: { fontSize: 10, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyTitle: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
});
