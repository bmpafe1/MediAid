
// MediAid — Vital Signs Trend Viewer (with population average overlay)
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useEffect, useState } from 'react';
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
import { useApp } from '@/contexts/AppContext';
import { getStatusForMetric, ScanResult } from '@/services/mockData';

type Status = 'red' | 'yellow' | 'green';

function statusColor(s: Status) {
  return s === 'red' ? theme.statusRed : s === 'yellow' ? theme.statusYellow : theme.statusGreen;
}

interface TrendMetric {
  key: keyof ScanResult;
  label: string;
  unit: string;
  icon: string;
  maxValue: number;
  citation?: string;
}

const TREND_METRICS: TrendMetric[] = [
  { key: 'tbRisk', label: 'TB Risk', unit: '%', icon: 'air', maxValue: 100, citation: 'HeAR — 94% accuracy' },
  { key: 'afibRisk', label: 'AFib Risk', unit: '%', icon: 'monitor-heart', maxValue: 100, citation: 'Yan et al. 2018' },
  { key: 'heartRate', label: 'Heart Rate', unit: 'BPM', icon: 'favorite', maxValue: 180 },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', icon: 'opacity', maxValue: 18 },
  { key: 'spo2', label: 'SpO₂', unit: '%', icon: 'psychology', maxValue: 100 },
  { key: 'respiratoryRate', label: 'Resp. Rate', unit: '/min', icon: 'self-improvement', maxValue: 40 },
  { key: 'tremorRisk', label: 'Tremor Risk', unit: '%', icon: 'vibration', maxValue: 100, citation: 'He et al. 2024' },
  { key: 'eyeConditions', label: 'Eye Conditions', unit: '', icon: 'remove-red-eye', maxValue: 7, citation: 'Jin et al. 2024' },
];

// Tiny sparkline using bar approach + population average line
function SparkLine({
  values, statuses, maxValue, color, populationAvg,
}: {
  values: number[];
  statuses: Status[];
  maxValue: number;
  color: string;
  populationAvg?: number;
}) {
  const max = Math.max(maxValue, ...values);
  const width = 100 / values.length;
  const anims = useRef(values.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(40, values.map((v, i) =>
      Animated.timing(anims[i], {
        toValue: Math.max(0.04, v / max),
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    )).start();
  }, []);

  const avgPct = populationAvg != null ? Math.min(1, populationAvg / max) : null;

  return (
    <View style={sparkStyles.container}>
      {/* Population average overlay */}
      {avgPct != null && (
        <View style={[sparkStyles.avgLine, { bottom: `${avgPct * 100}%` }]}>
          <View style={[sparkStyles.avgLineBar, { backgroundColor: '#FFFFFF33' }]} />
          <View style={[sparkStyles.avgDot]} />
        </View>
      )}

      {/* Threshold zone shading (top 20%) */}
      <View style={sparkStyles.dangerZone} />

      {/* Animated bars */}
      <View style={sparkStyles.barsRow}>
        {values.map((v, i) => {
          const col = statusColor(statuses[i]);
          return (
            <View key={i} style={[sparkStyles.barCol, { width: `${width}%` }]}>
              <View style={sparkStyles.barTrack}>
                <Animated.View style={[sparkStyles.barFill, {
                  height: anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: col,
                  shadowColor: col,
                  shadowOpacity: statuses[i] === 'red' ? 0.6 : 0,
                  shadowRadius: 4,
                }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Alert crossings */}
      {values.map((v, i) => statuses[i] === 'red' ? (
        <View key={`alert-${i}`} style={[
          sparkStyles.alertMarker,
          { left: `${(i / values.length) * 100 + (width / 2)}%` },
        ]}>
          <MaterialIcons name="priority-high" size={8} color={theme.statusRed} />
        </View>
      ) : null)}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  container: { height: 60, position: 'relative', marginVertical: 8 },
  barsRow: { flexDirection: 'row', height: '100%', alignItems: 'flex-end', gap: 3 },
  barCol: { height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.background, borderRadius: 3 },
  barFill: { width: '100%', borderRadius: 3, minHeight: 3 },
  dangerZone: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '20%',
    backgroundColor: theme.statusRed + '08',
  },
  avgLine: {
    position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 3,
  },
  avgLineBar: { flex: 1, height: 1, borderRadius: 1 },
  avgDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFFFFF66' },
  alertMarker: {
    position: 'absolute', top: 0, width: 12, height: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.statusRed + '22', borderRadius: 6,
    transform: [{ translateX: -6 }],
    zIndex: 5,
  },
  avgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: theme.border,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  avgBadgeText: { fontSize: 9, color: theme.textMuted, fontWeight: '600' },
});

function TrendCard({ metric, scans, populationAvg }: { metric: TrendMetric; scans: ScanResult[]; populationAvg?: number }) {
  const values = scans.map((s) => s[metric.key] as number);
  const statuses = values.map((v) => getStatusForMetric(metric.key, v));
  const latest = values[0];
  const earliest = values[values.length - 1];
  const latestStatus = statuses[0];
  const col = statusColor(latestStatus);

  const delta = latest - earliest;
  const improving =
    metric.key === 'spo2' || metric.key === 'hemoglobin' || metric.key === 'heartRate'
      ? delta > 0
      : delta < 0;
  const worsening =
    metric.key === 'spo2' || metric.key === 'hemoglobin' || metric.key === 'heartRate'
      ? delta < -2
      : delta > 5;

  return (
    <View style={[trendStyles.card, { borderLeftColor: col }]}>
      <View style={trendStyles.header}>
        <MaterialIcons name={metric.icon as any} size={20} color={col} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={trendStyles.metricLabel}>{metric.label}</Text>
          {metric.citation && (
            <Text style={trendStyles.citation}>{metric.citation}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[trendStyles.latestValue, { color: col }]}>
            {typeof latest === 'number' && !Number.isInteger(latest) ? latest.toFixed(1) : latest}{metric.unit}
          </Text>
          {scans.length > 1 && (
            <View style={[
              trendStyles.deltaBadge,
              {
                backgroundColor: worsening ? theme.statusRedBg : improving ? theme.statusGreenBg : theme.surface,
                borderColor: worsening ? theme.statusRed + '44' : improving ? theme.statusGreen + '44' : theme.border,
              },
            ]}>
              <MaterialIcons
                name={worsening ? 'trending-down' : improving ? 'trending-up' : 'trending-flat'}
                size={12}
                color={worsening ? theme.statusRed : improving ? theme.statusGreen : theme.textMuted}
              />
              <Text style={[
                trendStyles.deltaText,
                { color: worsening ? theme.statusRed : improving ? theme.statusGreen : theme.textMuted },
              ]}>
                {delta > 0 ? '+' : ''}{typeof delta === 'number' && !Number.isInteger(delta) ? delta.toFixed(1) : Math.round(delta)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Sparkline with population avg overlay */}
      <SparkLine
        values={[...values].reverse()}
        statuses={[...statuses].reverse()}
        maxValue={metric.maxValue}
        color={col}
        populationAvg={populationAvg}
      />

      {/* Population avg badge */}
      {populationAvg != null && (
        <View style={trendStyles.avgBadge}>
          <MaterialIcons name="people" size={10} color={theme.textMuted} />
          <Text style={trendStyles.avgBadgeText}>Pop. avg: {typeof populationAvg === 'number' && !Number.isInteger(populationAvg) ? populationAvg.toFixed(1) : Math.round(populationAvg)}{metric.unit}</Text>
        </View>
      )}

      {/* Scan labels */}
      <View style={trendStyles.scanLabels}>
        {scans.map((s, i) => (
          <Text key={s.id} style={[trendStyles.scanLabel, { width: `${100 / scans.length}%` }]}>
            {i === 0 ? 'Now' : `-${i}`}
          </Text>
        ))}
      </View>

      {/* Status dots */}
      <View style={trendStyles.statusDots}>
        {statuses.map((st, i) => (
          <View key={i} style={[trendStyles.statusDot, { backgroundColor: statusColor(st) }]} />
        ))}
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  metricLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  citation: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  latestValue: { fontSize: 20, fontWeight: '800' },
  deltaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: theme.radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1,
  },
  deltaText: { fontSize: 10, fontWeight: '700' },
  scanLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  scanLabel: { fontSize: 9, color: theme.textMuted, textAlign: 'center', fontWeight: '600' },
  statusDots: { flexDirection: 'row', gap: 6, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  avgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: theme.border,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  avgBadgeText: { fontSize: 9, color: theme.textMuted, fontWeight: '600' },
});

export default function VitalTrendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  // Get last 5 scans — filter by patient ID if provided
  const relevantScans = useMemo(() => {
    if (patientId) {
      const byPatient = scanHistory.filter((s) => s.patientId === patientId);
      if (byPatient.length > 0) return byPatient.slice(0, 5);
    }
    return scanHistory.slice(0, 5);
  }, [scanHistory, patientId]);

  // Population averages across ALL scans
  const populationAvgs = useMemo(() => {
    if (scanHistory.length === 0) return {};
    const avgs: Partial<Record<keyof ScanResult, number>> = {};
    for (const m of TREND_METRICS) {
      const vals = scanHistory.map((s) => s[m.key] as number).filter((v) => typeof v === 'number');
      avgs[m.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return avgs;
  }, [scanHistory]);

  const patientName = relevantScans[0]?.patientName ?? 'All Patients';

  if (relevantScans.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.navbar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.navTitle}>Vital Trends</Text>
        </View>
        <View style={styles.emptyState}>
          <MaterialIcons name="show-chart" size={64} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>No scan history yet</Text>
          <Text style={styles.emptySub}>Complete at least one scan to see vital trends.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const overallTrend = (() => {
    if (relevantScans.length < 2) return 'stable';
    const redNow = TREND_METRICS.filter((m) => getStatusForMetric(m.key, relevantScans[0][m.key] as number) === 'red').length;
    const redPrev = TREND_METRICS.filter((m) => getStatusForMetric(m.key, relevantScans[1][m.key] as number) === 'red').length;
    if (redNow < redPrev) return 'improving';
    if (redNow > redPrev) return 'worsening';
    return 'stable';
  })();

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Vital Trends</Text>
          <Text style={styles.navSub}>{patientName} · Last {relevantScans.length} scan{relevantScans.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={[
          styles.trendBadge,
          {
            backgroundColor: overallTrend === 'improving' ? theme.statusGreenBg : overallTrend === 'worsening' ? theme.statusRedBg : theme.surface,
            borderColor: overallTrend === 'improving' ? theme.statusGreen + '55' : overallTrend === 'worsening' ? theme.statusRed + '55' : theme.border,
          },
        ]}>
          <MaterialIcons
            name={overallTrend === 'improving' ? 'trending-up' : overallTrend === 'worsening' ? 'trending-down' : 'trending-flat'}
            size={14}
            color={overallTrend === 'improving' ? theme.statusGreen : overallTrend === 'worsening' ? theme.statusRed : theme.textMuted}
          />
          <Text style={[
            styles.trendBadgeText,
            { color: overallTrend === 'improving' ? theme.statusGreen : overallTrend === 'worsening' ? theme.statusRed : theme.textMuted },
          ]}>
            {overallTrend === 'improving' ? 'Improving' : overallTrend === 'worsening' ? 'Worsening' : 'Stable'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Scan timeline header */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>SCAN TIMELINE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.timelineRow}>
              {relevantScans.map((s, i) => (
                <View key={s.id} style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: s.hasRedAlert ? theme.statusRed : theme.statusGreen }]} />
                  {i < relevantScans.length - 1 && <View style={styles.timelineConnector} />}
                  <Text style={styles.timelineDate}>
                    {new Date(s.scanTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.timelineTime}>
                    {new Date(s.scanTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {s.hasRedAlert && (
                    <View style={styles.timelineRedTag}>
                      <Text style={styles.timelineRedTagText}>RED</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>8 VITAL METRICS · TREND ANALYSIS</Text>
        {TREND_METRICS.map((m) => (
          <TrendCard key={m.key as string} metric={m} scans={relevantScans} populationAvg={populationAvgs[m.key] as number | undefined} />
        ))}

        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>HOW TO READ THESE CHARTS</Text>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.statusRed }]} />
            <Text style={styles.legendText}>RED bar — metric above/below danger threshold → referral required</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.statusYellow }]} />
            <Text style={styles.legendText}>YELLOW — abnormal, monitor closely</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.statusGreen }]} />
            <Text style={styles.legendText}>GREEN — within normal clinical range</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFFFFF44' }]} />
            <Text style={styles.legendText}>White dashed line — population average across all {scanHistory.length} scans</Text>
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
  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1,
  },
  trendBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
  timelineCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  timelineTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
  timelineItem: { alignItems: 'center', minWidth: 64, position: 'relative' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 6 },
  timelineConnector: {
    position: 'absolute', top: 5, left: '50%',
    width: 52, height: 2, backgroundColor: theme.border,
  },
  timelineDate: { fontSize: 10, fontWeight: '600', color: theme.textPrimary, textAlign: 'center' },
  timelineTime: { fontSize: 9, color: theme.textMuted, textAlign: 'center', marginTop: 2 },
  timelineRedTag: {
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  timelineRedTagText: { fontSize: 8, fontWeight: '800', color: theme.statusRed },
  legendCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: theme.border, gap: 10,
  },
  legendTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 18 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  avgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: theme.border,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  avgBadgeText: { fontSize: 9, color: theme.textMuted, fontWeight: '600' },
});
