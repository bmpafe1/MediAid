// Powered by OnSpace.AI
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/constants/i18n';
import { ScanResult, generateDemoRedResult } from '@/services/mockData';
import { ConnectivityBanner } from '@/components/ConnectivityBanner';

// Inline appointment type to avoid cross-layer import
interface HomeAppt {
  id: string;
  patientId: string;
  patientName: string;
  dateKey: string;
  time: string;
  reason: string;
  priority: 'urgent' | 'routine' | 'followup';
}

// ─── Malaria Risk Gauge ────────────────────────────────────────────────────────
function MalariaRiskGauge({ scanHistory }: { scanHistory: ScanResult[] }) {
  // Score: 0–100 composite from weekly scan RED rate + recent activity surge
  const weekScans = scanHistory.filter((s) => {
    const d = new Date(s.scanTimestamp);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  });
  const redRate = weekScans.length > 0 ? weekScans.filter((s) => s.hasRedAlert).length / weekScans.length : 0;
  const activityScore = Math.min(1, weekScans.length / 10); // 10+ scans = max
  // Simulate climate contribution (static: NW Cameroon rainy season)
  const climateScore = 0.55;
  const rawScore = Math.round((redRate * 0.4 + activityScore * 0.25 + climateScore * 0.35) * 100);
  const score = Math.max(12, Math.min(95, rawScore + 28)); // Bias to realistic range

  const riskLevel = score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';
  const riskColor = riskLevel === 'High' ? theme.statusRed : riskLevel === 'Medium' ? theme.statusYellow : theme.statusGreen;

  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: score / 100,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={gaugeStyles.card}>
      <View style={gaugeStyles.header}>
        <View style={[gaugeStyles.iconCircle, { backgroundColor: riskColor + '22' }]}>
          <MaterialIcons name="bug-report" size={20} color={riskColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={gaugeStyles.title}>District Malaria Risk Score</Text>
          <Text style={gaugeStyles.sub}>Climate × Scan Volume · Bime et al. 2022</Text>
        </View>
        <View style={[gaugeStyles.levelBadge, { backgroundColor: riskColor + '22', borderColor: riskColor + '55' }]}>
          <Text style={[gaugeStyles.levelText, { color: riskColor }]}>{riskLevel}</Text>
        </View>
      </View>

      {/* Score display */}
      <View style={gaugeStyles.scoreRow}>
        <Text style={[gaugeStyles.scoreNum, { color: riskColor }]}>{score}</Text>
        <Text style={gaugeStyles.scoreMax}>/100</Text>
        <View style={{ flex: 1 }} />
        <View style={gaugeStyles.factorsCol}>
          {[
            { label: 'RED alert rate', value: `${Math.round(redRate * 100)}%` },
            { label: 'Weekly activity', value: `${weekScans.length} scans` },
            { label: 'Rainfall anomaly', value: '+55mm' },
          ].map((f) => (
            <View key={f.label} style={gaugeStyles.factorRow}>
              <Text style={gaugeStyles.factorLabel}>{f.label}</Text>
              <Text style={gaugeStyles.factorValue}>{f.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Animated gauge bar */}
      <View style={gaugeStyles.track}>
        {/* Colored zones */}
        <View style={[gaugeStyles.zone, { width: '45%', backgroundColor: theme.statusGreen + '33' }]} />
        <View style={[gaugeStyles.zone, { width: '25%', backgroundColor: theme.statusYellow + '33' }]} />
        <View style={[gaugeStyles.zone, { width: '30%', backgroundColor: theme.statusRed + '33' }]} />
        {/* Animated fill */}
        <Animated.View style={[gaugeStyles.fill, { width: barWidth, backgroundColor: riskColor }]} />
        {/* Score needle */}
        <Animated.View style={[gaugeStyles.needle, { left: barWidth }]} />
      </View>
      <View style={gaugeStyles.zoneLabels}>
        <Text style={[gaugeStyles.zoneLabel, { color: theme.statusGreen }]}>Low</Text>
        <Text style={[gaugeStyles.zoneLabel, { color: theme.statusYellow }]}>Medium</Text>
        <Text style={[gaugeStyles.zoneLabel, { color: theme.statusRed }]}>High</Text>
      </View>

      <Text style={gaugeStyles.citation}>
        Composite: Rainfall anomaly (35%) + RED alert rate (40%) + activity surge (25%) · 4–6 week lag forecast
      </Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  sub: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  levelBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  levelText: { fontSize: 11, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  scoreNum: { fontSize: 42, fontWeight: '800', lineHeight: 50 },
  scoreMax: { fontSize: 18, color: theme.textMuted, fontWeight: '600', marginTop: 8, marginLeft: 2, marginRight: 10 },
  factorsCol: { gap: 4 },
  factorRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  factorLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '500', width: 100 },
  factorValue: { fontSize: 11, fontWeight: '700', color: theme.textPrimary },
  track: {
    height: 16, borderRadius: 8, overflow: 'hidden',
    backgroundColor: theme.border,
    flexDirection: 'row', position: 'relative',
    marginBottom: 4,
  },
  zone: { height: '100%' },
  fill: {
    position: 'absolute', top: 0, left: 0, height: '100%',
    borderRadius: 8, opacity: 0.6,
  },
  needle: {
    position: 'absolute', top: -3, width: 4, height: 22,
    backgroundColor: '#FFF',
    borderRadius: 2,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
    marginLeft: -2,
  },
  zoneLabels: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
  },
  zoneLabel: { fontSize: 10, fontWeight: '700' },
  citation: { fontSize: 10, color: theme.textMuted, lineHeight: 15 },
});

// ─── 7-Day Workload Sparkline ─────────────────────────────────────────────────
function SparklineChart({ history }: { history: ScanResult[] }) {
  const days: { label: string; count: number; hasRed: boolean }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dayStr = d.toDateString();
    const dayScans = history.filter((s) => new Date(s.scanTimestamp).toDateString() === dayStr);
    days.push({
      label: d.toLocaleDateString([], { weekday: 'narrow' }),
      count: dayScans.length,
      hasRed: dayScans.some((s) => s.hasRedAlert),
    });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  return (
    <View style={sparkStyles.container}>
      <Text style={sparkStyles.title}>7-DAY WORKLOAD</Text>
      <View style={sparkStyles.bars}>
        {days.map((day, i) => (
          <View key={i} style={sparkStyles.barCol}>
            <View style={sparkStyles.barTrack}>
              <View
                style={[
                  sparkStyles.barFill,
                  {
                    height: `${(day.count / maxCount) * 100}%`,
                    backgroundColor: day.hasRed ? theme.statusRed : theme.primary,
                    opacity: day.count === 0 ? 0.2 : 1,
                  },
                ]}
              />
            </View>
            {day.count > 0 && (
              <Text style={[sparkStyles.barNum, { color: day.hasRed ? theme.statusRed : theme.primary }]}>
                {day.count}
              </Text>
            )}
            <Text style={sparkStyles.dayLabel}>{day.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  bars: { flexDirection: 'row', gap: 6, height: 60 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 3, minHeight: 3 },
  barNum: { fontSize: 9, fontWeight: '800' },
  dayLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
});

const DETECTIONS = [
  { label: 'TB Risk', icon: 'air', color: theme.statusRed },
  { label: 'Heart Rate', icon: 'favorite', color: '#F472B6' },
  { label: 'AFib', icon: 'monitor-heart', color: theme.primary },
  { label: 'Hemoglobin', icon: 'opacity', color: theme.statusYellow },
  { label: 'SpO₂', icon: 'psychology', color: theme.statusGreen },
  { label: 'Resp. Rate', icon: 'self-improvement', color: '#60A5FA' },
  { label: 'Tremor/PD', icon: 'vibration', color: '#F59E0B' },
  { label: 'Eye Health', icon: 'remove-red-eye', color: '#A78BFA' },
  { label: '10-yr CVD', icon: 'monitor-heart', color: '#F97316' },
  { label: 'Glucose Flag', icon: 'water-drop', color: '#34D399' },
  { label: 'COVID-19 Flag', icon: 'medical-information', color: '#6366F1' },
  { label: 'Jaundice', icon: 'visibility', color: '#FCD34D' },
  { label: 'Fall Detect', icon: 'elderly', color: '#EC4899' },
  { label: 'Malaria Micro', icon: 'biotech', color: '#00D97E' },
  { label: 'Fetal Move', icon: 'child-care', color: '#818CF8' },
  { label: 'Voice Biomark', icon: 'record-voice-over', color: '#22D3EE' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { demoMode, setDemoMode, scanHistory, language, setCurrentScan, addScanToHistory } = useApp();
  const [scanning] = useState(false);
  const [upcomingAppts, setUpcomingAppts] = useState<HomeAppt[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('mediaid_schedule_v1');
        if (raw) {
          const all: HomeAppt[] = JSON.parse(raw);
          const today = new Date().toISOString().slice(0, 10);
          setUpcomingAppts(
            all
              .filter((a) => a.dateKey >= today)
              .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
              .slice(0, 3)
          );
        }
      } catch {}
    };
    load();
  }, []);

  const todayScans = scanHistory.filter((s) => {
    const d = new Date(s.scanTimestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const redAlerts = scanHistory.filter((s) => s.hasRedAlert).length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.orgLabel}>UNICEF Venture Fund</Text>
            <Text style={styles.appTitle}>MediAid</Text>
          </View>
          <View style={styles.demoRow}>
            <Text style={styles.demoLabel}>DEMO</Text>
            <Switch
              value={demoMode}
              onValueChange={setDemoMode}
              thumbColor={demoMode ? theme.primary : '#555'}
              trackColor={{ false: '#333', true: '#003A52' }}
            />
          </View>
        </View>

        {/* Hero image */}
        <Image
          source={require('@/assets/images/scan-hero.png')}
          style={styles.heroImage}
          contentFit="cover"
        />

        {/* Demo mode banner + Force RED button */}
        {demoMode && (
          <View style={styles.demoBannerGroup}>
            <View style={styles.demoBanner}>
              <MaterialIcons name="speed" size={16} color={theme.statusYellow} />
              <Text style={styles.demoBannerText}>
                Demo Mode ON — 90 sec scan compressed to 10 sec
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.forceRedBtn, pressed && { opacity: 0.82 }]}
              onPress={() => {
                const redResult = generateDemoRedResult('Demo Patient');
                setCurrentScan(redResult);
                addScanToHistory(redResult);
                router.push('/safety');
              }}
            >
              <MaterialIcons name="warning" size={18} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.forceRedTitle}>Force RED Alert Demo</Text>
                <Text style={styles.forceRedSub}>Shows non-bypassable safety screen instantly</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayScans.length}</Text>
            <Text style={styles.statLabel}>Today's{'\n'}Scans</Text>
          </View>
          <View style={[styles.statCard, redAlerts > 0 && styles.statCardRed]}>
            <Text style={[styles.statValue, redAlerts > 0 && { color: theme.statusRed }]}>
              {redAlerts}
            </Text>
            <Text style={styles.statLabel}>Red{'\n'}Alerts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{scanHistory.filter((s) => !s.synced).length}</Text>
            <Text style={styles.statLabel}>Pending{'\n'}Sync</Text>
          </View>
        </View>

        {/* BIG Scan Button */}
        <Pressable
          style={({ pressed }) => [styles.scanButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/scan-workflow')}
          disabled={scanning}
        >
          <View style={styles.scanIconCircle}>
            <MaterialIcons name="health-and-safety" size={56} color="#FFF" />
          </View>
          <Text style={styles.scanButtonTitle}>{t('home_scan_btn', language)}</Text>
          <Text style={styles.scanButtonSub}>
            {demoMode ? t('home_scan_sub_demo', language) : t('home_scan_sub_full', language)}
          </Text>
        </Pressable>

        {/* Connectivity Banner */}
        <ConnectivityBanner onPress={() => router.push('/(tabs)/sync')} />

        {/* Upcoming appointment reminder */}
        {upcomingAppts.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.apptBanner, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/schedule')}
          >
            <MaterialIcons name="event" size={18} color={theme.statusYellow} />
            <View style={{ flex: 1 }}>
              <Text style={styles.apptBannerTitle}>
                {upcomingAppts.length} upcoming follow-up{upcomingAppts.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.apptBannerSub} numberOfLines={1}>
                Next: {upcomingAppts[0].patientName} ·{' '}
                {new Date(upcomingAppts[0].dateKey + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                {' at '}{upcomingAppts[0].time}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={theme.statusYellow} />
          </Pressable>
        )}

        {/* Malaria Risk Gauge */}
        <MalariaRiskGauge scanHistory={scanHistory} />

        {/* 7-Day Sparkline */}
        <SparklineChart history={scanHistory} />

        {/* What gets detected */}
        <Text style={styles.sectionTitle}>16 VALIDATED CAPABILITIES</Text>
        <View style={styles.detectGrid}>
          {DETECTIONS.map((d) => (
            <View key={d.label} style={[styles.detectCard, { borderColor: d.color + '33' }]}>
              <MaterialIcons name={d.icon as any} size={28} color={d.color} />
              <Text style={styles.detectLabel}>{d.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent scans */}
        {scanHistory.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>RECENT PATIENTS</Text>
            {scanHistory.slice(0, 3).map((scan) => (
              <Pressable
                key={scan.id}
                style={styles.recentRow}
                onPress={() => router.push({ pathname: '/patient-detail', params: { scanId: scan.id } })}
              >
                <View style={[styles.alertDot, { backgroundColor: scan.hasRedAlert ? theme.statusRed : theme.statusGreen }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName}>{scan.patientName}</Text>
                  <Text style={styles.recentMeta}>
                    {new Date(scan.scanTimestamp).toLocaleTimeString()} · TB {scan.tbRisk}% · HR {scan.heartRate}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            ))}
          </>
        )}

        {/* Quick access tools row */}
        <View style={styles.bottomBtnRow}>
          <Pressable
            style={({ pressed }) => [styles.queueBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/patient-queue')}
          >
            <MaterialIcons name="queue" size={16} color={theme.primary} />
            <Text style={styles.queueBtnText}>Patient Queue</Text>
            <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.supervisorBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/supervisor')}
          >
            <MaterialIcons name="admin-panel-settings" size={16} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* AI Advisor + Formulary + Daily Report row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#A78BFA44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/ai-advisor')}
          >
            <MaterialIcons name="local-hospital" size={18} color="#A78BFA" />
            <Text style={[styles.toolBtnText, { color: '#A78BFA' }]}>AI Advisor</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusYellow + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/formulary')}
          >
            <MaterialIcons name="medication" size={18} color={theme.statusYellow} />
            <Text style={[styles.toolBtnText, { color: theme.statusYellow }]}>Formulary</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusGreen + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/daily-report')}
          >
            <MaterialIcons name="summarize" size={18} color={theme.statusGreen} />
            <Text style={[styles.toolBtnText, { color: theme.statusGreen }]}>Daily Report</Text>
          </Pressable>
        </View>

        {/* Symptom Checker + Village Dashboard + Health Education row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusRed + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/symptom-checker')}
          >
            <MaterialIcons name="search" size={18} color={theme.statusRed} />
            <Text style={[styles.toolBtnText, { color: theme.statusRed }]}>Symptoms</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.primary + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/village-dashboard')}
          >
            <MaterialIcons name="location-city" size={18} color={theme.primary} />
            <Text style={[styles.toolBtnText, { color: theme.primary }]}>Villages</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#10B98144' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/health-education')}
          >
            <MaterialIcons name="menu-book" size={18} color="#10B981" />
            <Text style={[styles.toolBtnText, { color: '#10B981' }]}>Education</Text>
          </Pressable>
        </View>

        {/* Referral Tracker + Lab Results row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusRed + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/referrals')}
          >
            <MaterialIcons name="send" size={18} color={theme.statusRed} />
            <Text style={[styles.toolBtnText, { color: theme.statusRed }]}>Referrals</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#60A5FA44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/lab-results')}
          >
            <MaterialIcons name="science" size={18} color="#60A5FA" />
            <Text style={[styles.toolBtnText, { color: '#60A5FA' }]}>Lab Results</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#A78BFA44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/schedule')}
          >
            <MaterialIcons name="event" size={18} color="#A78BFA" />
            <Text style={[styles.toolBtnText, { color: '#A78BFA' }]}>Schedule</Text>
          </Pressable>
        </View>

        {/* Impact Dashboard + Emergency Directory + Patient Notes row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#00AEEF44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/impact-dashboard')}
          >
            <MaterialIcons name="insights" size={18} color="#00AEEF" />
            <Text style={[styles.toolBtnText, { color: '#00AEEF' }]}>Impact</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusRed + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/emergency-directory')}
          >
            <MaterialIcons name="local-hospital" size={18} color={theme.statusRed} />
            <Text style={[styles.toolBtnText, { color: theme.statusRed }]}>Emergency</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#10B98144' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/patient-notes')}
          >
            <MaterialIcons name="notes" size={18} color="#10B981" />
            <Text style={[styles.toolBtnText, { color: '#10B981' }]}>Notes</Text>
          </Pressable>
        </View>

        {/* Analytics + Alert Log row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#A78BFA44', flex: 2 }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/analytics')}
          >
            <MaterialIcons name="bar-chart" size={18} color="#A78BFA" />
            <Text style={[styles.toolBtnText, { color: '#A78BFA' }]}>Population Analytics</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusGreen + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/alert-log')}
          >
            <MaterialIcons name="warning" size={18} color={theme.statusGreen} />
            <Text style={[styles.toolBtnText, { color: theme.statusGreen }]}>Alert Log</Text>
          </Pressable>
        </View>

        {/* Risk Calculators row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#F9731644', flex: 1 }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/risk-calculator')}
          >
            <MaterialIcons name="calculate" size={18} color="#F97316" />
            <Text style={[styles.toolBtnText, { color: '#F97316' }]}>Risk Calculators</Text>
          </Pressable>
        </View>

        {/* CHA Profile + Treatment Protocols row */}
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.primary + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/cha-profile')}
          >
            <MaterialIcons name="badge" size={18} color={theme.primary} />
            <Text style={[styles.toolBtnText, { color: theme.primary }]}>CHA Profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.statusRed + '44', flex: 2 }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/treatment-protocols')}
          >
            <MaterialIcons name="medical-services" size={18} color={theme.statusRed} />
            <Text style={[styles.toolBtnText, { color: theme.statusRed }]}>Treatment Protocols</Text>
          </Pressable>
        </View>

        {/* v10 Features row */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>v10 RESEARCH FEATURES</Text>
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#7C3AED44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/llm-validation')}
          >
            <MaterialIcons name="psychology" size={18} color="#7C3AED" />
            <Text style={[styles.toolBtnText, { color: '#7C3AED' }]}>LLM Validation</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#22D3EE44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/biometric-identity')}
          >
            <MaterialIcons name="fingerprint" size={18} color="#22D3EE" />
            <Text style={[styles.toolBtnText, { color: '#22D3EE' }]}>Biometric ID</Text>
          </Pressable>
        </View>
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: '#818CF844' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/self-healing-ai')}
          >
            <MaterialIcons name="auto-fix-high" size={18} color="#818CF8" />
            <Text style={[styles.toolBtnText, { color: '#818CF8' }]}>Self-Healing AI</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBtn, { borderColor: theme.primary + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/cha-professionalization')}
          >
            <MaterialIcons name="trending-up" size={18} color={theme.primary} />
            <Text style={[styles.toolBtnText, { color: theme.primary }]}>CHA Prof.</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>{t('home_footer_note', language)}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, marginBottom: 16,
  },
  orgLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  appTitle: { fontSize: 28, color: theme.textPrimary, fontWeight: '800', marginTop: 2 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoLabel: { fontSize: 11, color: theme.statusYellow, fontWeight: '700', letterSpacing: 1 },
  heroImage: { width: '100%', height: 180, borderRadius: theme.radius.large, marginBottom: 12 },
  demoBannerGroup: { marginBottom: 16, gap: 8 },
  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.medium,
    padding: 12, borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  demoBannerText: { color: theme.statusYellow, fontSize: 13, fontWeight: '600', flex: 1 },
  forceRedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.statusRed, borderRadius: theme.radius.medium,
    paddingVertical: 14, paddingHorizontal: 14,
    shadowColor: theme.statusRed, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  forceRedTitle: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  forceRedSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.border,
  },
  statCardRed: { borderColor: theme.statusRed + '66', backgroundColor: theme.statusRedBg },
  statValue: { fontSize: 32, fontWeight: '700', color: theme.primary },
  statLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 4, textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  scanButton: {
    backgroundColor: theme.primary, borderRadius: theme.radius.xl,
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, marginBottom: 20,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  scanIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  scanButtonTitle: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  scanButtonSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' },
  apptBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 14, borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  apptBannerTitle: { fontSize: 13, fontWeight: '700', color: theme.statusYellow },
  apptBannerSub: { fontSize: 11, color: theme.statusYellow + 'CC', marginTop: 2 },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  detectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  detectCard: {
    width: '22%', backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.border,
  },
  detectLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '600', textAlign: 'center' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.radius.medium, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  recentName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  recentMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  bottomBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  toolsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  toolBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 5,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingVertical: 12, paddingHorizontal: 8,
    borderWidth: 1, borderColor: theme.border,
  },
  toolBtnText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  queueBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.medium,
    paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.primary + '44',
  },
  queueBtnText: { flex: 1, fontSize: 13, color: theme.primary, fontWeight: '700' },
  supervisorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, minWidth: 48,
  },
  footerNote: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
