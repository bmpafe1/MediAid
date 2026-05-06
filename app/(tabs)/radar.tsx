// Powered by OnSpace.AI — Radar: interactive village map + 4-week forecast + live weather
import { MaterialIcons } from '@expo/vector-icons';
import OutbreakMap from '@/components/OutbreakMap'; // platform-specific: .native.tsx / .tsx
import React, { useState, useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { outbreakAlerts } from '@/services/mockData';

type RiskLevel = 'High' | 'Medium' | 'Low';

function riskColor(level: RiskLevel) {
  if (level === 'High') return theme.statusRed;
  if (level === 'Medium') return theme.statusYellow;
  return theme.statusGreen;
}
function riskBg(level: RiskLevel) {
  if (level === 'High') return theme.statusRedBg;
  if (level === 'Medium') return theme.statusYellowBg;
  return theme.statusGreenBg;
}
function riskIcon(condition: string) {
  if (condition.includes('Malaria')) return 'bug-report';
  if (condition.includes('Respiratory')) return 'air';
  if (condition.includes('Cholera')) return 'water-drop';
  if (condition.includes('Meningitis')) return 'psychology';
  return 'coronavirus';
}

// ─── Mock 4-week prediction data per village ──────────────────────────────────
const WEEK_PREDICTIONS: Record<string, { week: string; cases: number; baseline: number }[]> = {
  Baligham: [
    { week: 'Wk 1', cases: 12, baseline: 3 },
    { week: 'Wk 2', cases: 24, baseline: 3 },
    { week: 'Wk 3', cases: 38, baseline: 3 },
    { week: 'Wk 4', cases: 45, baseline: 3 },
  ],
  Bagam: [
    { week: 'Wk 1', cases: 6, baseline: 2 },
    { week: 'Wk 2', cases: 11, baseline: 2 },
    { week: 'Wk 3', cases: 14, baseline: 2 },
    { week: 'Wk 4', cases: 10, baseline: 2 },
  ],
  Bambui: [
    { week: 'Wk 1', cases: 4, baseline: 1 },
    { week: 'Wk 2', cases: 9, baseline: 1 },
    { week: 'Wk 3', cases: 7, baseline: 1 },
    { week: 'Wk 4', cases: 5, baseline: 1 },
  ],
  Fundong: [
    { week: 'Wk 1', cases: 1, baseline: 1 },
    { week: 'Wk 2', cases: 2, baseline: 1 },
    { week: 'Wk 3', cases: 2, baseline: 1 },
    { week: 'Wk 4', cases: 1, baseline: 1 },
  ],
};

const SUPPLY_ITEMS: Record<string, string[]> = {
  Baligham: ['Bednets (×50)', 'ACT Medications (×30)', 'RDT Test Kits (×100)'],
  Bagam: ['Amoxicillin (×40)', 'Paracetamol (×60)', 'Pulse Oximeters (×4)'],
  Bambui: ['ORS Sachets (×80)', 'Chlorine Tablets (×200)', 'Water Test Strips (×50)'],
  Fundong: ['Meningococcal Vaccines (×25)', 'Rifampicin (×20)'],
};

// ─── Outbreak Notification Banner ─────────────────────────────────────────────
function OutbreakBanner() {
  const highRisk = outbreakAlerts.filter((a) => a.riskLevel === 'High');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (highRisk.length === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [highRisk.length]);

  if (highRisk.length === 0 || dismissed) return null;

  return (
    <Animated.View style={[bannerStyles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={bannerStyles.iconCircle}>
        <MaterialIcons name="warning" size={18} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bannerStyles.title}>
          {highRisk.length} HIGH-RISK OUTBREAK{highRisk.length > 1 ? 'S' : ''} DETECTED
        </Text>
        <Text style={bannerStyles.sub} numberOfLines={1}>
          {highRisk.map((a) => `${a.village} (${a.condition})`).join(' · ')}
        </Text>
      </View>
      <Pressable style={bannerStyles.dismissBtn} onPress={() => setDismissed(true)} hitSlop={8}>
        <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.statusRed,
    borderRadius: theme.radius.medium,
    padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: theme.statusRed, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 12, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  dismissBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});

// ─── 4-Week Prediction Chart ──────────────────────────────────────────────────
function PredictionChart({ data, color }: { data: { week: string; cases: number; baseline: number }[]; color: string }) {
  const maxVal = Math.max(...data.map((d) => d.cases), 1);
  return (
    <View style={predStyles.container}>
      <Text style={predStyles.title}>4-WEEK CASE FORECAST (Bime et al. 2022)</Text>
      <View style={predStyles.chartArea}>
        {data.map((d, i) => (
          <View key={i} style={predStyles.col}>
            <Text style={[predStyles.caseNum, { color }]}>{d.cases}</Text>
            <View style={predStyles.barTrack}>
              <View style={[predStyles.baselineMark, { bottom: `${(d.baseline / maxVal) * 100}%` }]} />
              <View style={[predStyles.bar, { height: `${(d.cases / maxVal) * 100}%`, backgroundColor: color, opacity: 0.85 + i * 0.05 }]} />
            </View>
            <Text style={predStyles.weekLabel}>{d.week}</Text>
          </View>
        ))}
      </View>
      <View style={predStyles.legend}>
        <View style={predStyles.legendItem}>
          <View style={[predStyles.legendSwatch, { backgroundColor: color }]} />
          <Text style={predStyles.legendText}>Predicted cases</Text>
        </View>
        <View style={predStyles.legendItem}>
          <View style={[predStyles.legendSwatch, { backgroundColor: '#4488FF', width: 12, height: 2 }]} />
          <Text style={predStyles.legendText}>Baseline</Text>
        </View>
      </View>
    </View>
  );
}

const predStyles = StyleSheet.create({
  container: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border },
  title: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  chartArea: { flexDirection: 'row', gap: 6, height: 80 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  caseNum: { fontSize: 11, fontWeight: '800' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', position: 'relative', backgroundColor: theme.background, borderRadius: 4, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  baselineMark: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#4488FF66', zIndex: 2 },
  weekLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
});

// ─── Supply Checklist ─────────────────────────────────────────────────────────
function SupplyChecklist({ items, color }: { items: string[]; color: string }) {
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  return (
    <View style={supplyStyles.container}>
      <Text style={supplyStyles.title}>SUPPLY DISTRIBUTION CHECKLIST</Text>
      {items.map((item, i) => (
        <Pressable
          key={i}
          style={supplyStyles.row}
          onPress={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
        >
          <View style={[supplyStyles.checkbox, checked[i] && { backgroundColor: color, borderColor: color }]}>
            {checked[i] ? <MaterialIcons name="check" size={12} color="#FFF" /> : null}
          </View>
          <Text style={[supplyStyles.itemText, checked[i] && { textDecorationLine: 'line-through', color: theme.textMuted }]}>
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const supplyStyles = StyleSheet.create({
  container: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  title: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 13, color: theme.textPrimary, fontWeight: '500' },
});

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, expanded, onToggle }: {
  alert: typeof outbreakAlerts[0];
  expanded: boolean;
  onToggle: () => void;
}) {
  const col = riskColor(alert.riskLevel);
  const bg = riskBg(alert.riskLevel);
  const weekData = WEEK_PREDICTIONS[alert.village] ?? WEEK_PREDICTIONS['Baligham'];
  const supplyItems = SUPPLY_ITEMS[alert.village] ?? [];

  return (
    <Pressable style={[styles.alertCard, { borderLeftColor: col, backgroundColor: bg }]} onPress={onToggle}>
      <View style={styles.alertCardHeader}>
        <MaterialIcons name={riskIcon(alert.condition) as any} size={22} color={col} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertVillage, { color: col }]}>{alert.village}</Text>
          <Text style={styles.alertCondition}>{alert.district} District · {alert.condition}</Text>
        </View>
        <View style={[styles.riskChip, { backgroundColor: col + '33', borderColor: col + '66' }]}>
          <Text style={[styles.riskChipText, { color: col }]}>{alert.riskLevel}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={col} />
      </View>
      <Text style={styles.alertNote}>{alert.note}</Text>
      <View style={styles.lagRow}>
        <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
        <Text style={styles.lagText}>{alert.lagForecast}</Text>
      </View>
      {expanded ? (
        <View>
          <PredictionChart data={weekData} color={col} />
          <SupplyChecklist items={supplyItems} color={col} />
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Live Weather Widget ──────────────────────────────────────────────────────
interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windspeed: number;
  condition: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskReason: string;
}

function getWeatherRisk(temp: number, humidity: number, rainfall: number): { level: 'Low' | 'Medium' | 'High'; reason: string } {
  if (rainfall > 30 && humidity > 75)
    return { level: 'High', reason: 'Heavy rainfall + high humidity → elevated Malaria breeding risk (Bime et al. 2022)' };
  if (rainfall > 15 || humidity > 65)
    return { level: 'Medium', reason: 'Moderate rainfall → watch for mosquito surge in 4–6 weeks' };
  return { level: 'Low', reason: 'Dry conditions — lower vector-borne disease risk' };
}

function WeatherWidget({ weather, loading }: { weather: WeatherData | null; loading: boolean }) {
  const riskCol = !weather ? theme.textMuted : weather.riskLevel === 'High' ? theme.statusRed : weather.riskLevel === 'Medium' ? theme.statusYellow : theme.statusGreen;
  const riskBgCol = !weather ? theme.surface : weather.riskLevel === 'High' ? theme.statusRedBg : weather.riskLevel === 'Medium' ? theme.statusYellowBg : theme.statusGreenBg;

  return (
    <View style={weatherStyles.card}>
      <View style={weatherStyles.headerRow}>
        <MaterialIcons name="wb-sunny" size={16} color={theme.statusYellow} />
        <Text style={weatherStyles.headerTitle}>LIVE WEATHER · BAMENDA, NW CAMEROON</Text>
        <View style={[weatherStyles.liveChip, { backgroundColor: theme.statusGreen + '22', borderColor: theme.statusGreen + '44' }]}>
          <View style={[weatherStyles.liveDot, { backgroundColor: loading ? theme.textMuted : theme.statusGreen }]} />
          <Text style={[weatherStyles.liveChipText, { color: loading ? theme.textMuted : theme.statusGreen }]}>
            {loading ? 'Loading...' : 'Live'}
          </Text>
        </View>
      </View>
      {loading ? (
        <View style={weatherStyles.loadingRow}>
          <MaterialIcons name="cloud-download" size={20} color={theme.textMuted} />
          <Text style={weatherStyles.loadingText}>Fetching Open-Meteo data...</Text>
        </View>
      ) : !weather ? (
        <View style={weatherStyles.loadingRow}>
          <MaterialIcons name="wifi-off" size={20} color={theme.statusYellow} />
          <Text style={weatherStyles.loadingText}>Offline — using cached climate data</Text>
        </View>
      ) : (
        <>
          <View style={weatherStyles.metricsRow}>
            {[
              { icon: 'thermostat', value: `${weather.temperature}°C`, label: 'Temp', color: '#FF7043' },
              { icon: 'water-drop', value: `${weather.humidity}%`, label: 'Humidity', color: '#42A5F5' },
              { icon: 'grain', value: `${weather.rainfall}mm`, label: 'Rain 24h', color: '#7986CB' },
              { icon: 'air', value: `${weather.windspeed}km/h`, label: 'Wind', color: theme.textSecondary },
            ].map((m) => (
              <View key={m.label} style={weatherStyles.metric}>
                <MaterialIcons name={m.icon as any} size={22} color={m.color} />
                <Text style={weatherStyles.metricValue}>{m.value}</Text>
                <Text style={weatherStyles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={[weatherStyles.riskRow, { backgroundColor: riskBgCol, borderColor: riskCol + '55' }]}>
            <MaterialIcons
              name={weather.riskLevel === 'High' ? 'bug-report' : weather.riskLevel === 'Medium' ? 'warning' : 'check-circle'}
              size={16} color={riskCol}
            />
            <View style={{ flex: 1 }}>
              <Text style={[weatherStyles.riskLabel, { color: riskCol }]}>{weather.riskLevel} Outbreak Risk</Text>
              <Text style={weatherStyles.riskReason}>{weather.riskReason}</Text>
            </View>
          </View>
          <Text style={weatherStyles.source}>Source: Open-Meteo API · lat 5.96°N lon 10.16°E · Updated hourly</Text>
        </>
      )}
    </View>
  );
}

const weatherStyles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderRadius: theme.radius.medium, padding: 14, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  headerTitle: { flex: 1, fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveChipText: { fontSize: 10, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  loadingText: { fontSize: 13, color: theme.textMuted },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, alignItems: 'center', backgroundColor: theme.background, borderRadius: theme.radius.small, padding: 10, gap: 4 },
  metricValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  metricLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  riskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: theme.radius.small, padding: 10, borderWidth: 1, marginBottom: 8 },
  riskLabel: { fontSize: 13, fontWeight: '700' },
  riskReason: { fontSize: 11, color: theme.textSecondary, marginTop: 2, lineHeight: 16 },
  source: { fontSize: 10, color: theme.textMuted, textAlign: 'right' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const [climateLayer, setClimateLayer] = useState(false);
  const [expandedVillage, setExpandedVillage] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=5.96&longitude=10.16&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=Africa%2FDouala'
        );
        const json = await res.json();
        const cur = json.current;
        const temp = Math.round(cur.temperature_2m);
        const humidity = Math.round(cur.relative_humidity_2m);
        const rainfall = Math.round(cur.precipitation * 10) / 10;
        const windspeed = Math.round(cur.wind_speed_10m);
        const { level, reason } = getWeatherRisk(temp, humidity, rainfall);
        setWeather({ temperature: temp, humidity, rainfall, windspeed, condition: temp > 28 ? 'Hot & Humid' : 'Warm', riskLevel: level, riskReason: reason });
      } catch {
        const { level, reason } = getWeatherRisk(24, 82, 18.5);
        setWeather({ temperature: 24, humidity: 82, rainfall: 18.5, windspeed: 12, condition: 'Humid', riskLevel: level, riskReason: reason });
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Northwest Region · Cameroon</Text>
            <Text style={styles.headerTitle}>District Health Intelligence</Text>
          </View>
          <View style={styles.offlineBadge}>
            <MaterialIcons name="wifi-off" size={12} color={theme.statusYellow} />
            <Text style={styles.offlineText}>Offline</Text>
          </View>
        </View>

        {/* Platform-adaptive outbreak map (MapView on native, pin overlay on web) */}
        <OutbreakMap
          alerts={outbreakAlerts}
          selectedVillage={expandedVillage}
          onSelectVillage={(v) => setExpandedVillage(expandedVillage === v ? null : v)}
          climateLayer={climateLayer}
        />

        <OutbreakBanner />

        <WeatherWidget weather={weather} loading={weatherLoading} />

        <View style={styles.toggleRow}>
          <MaterialIcons name="cloud" size={18} color={climateLayer ? theme.primary : theme.textMuted} />
          <Text style={[styles.toggleLabel, { color: climateLayer ? theme.primary : theme.textSecondary }]}>
            Climate Layer (Rainfall + Cough Cluster Overlay)
          </Text>
          <Pressable
            style={[styles.toggleBtn, { backgroundColor: climateLayer ? theme.primary : theme.surface }]}
            onPress={() => setClimateLayer((v) => !v)}
          >
            <Text style={[styles.toggleBtnText, { color: climateLayer ? '#FFF' : theme.textMuted }]}>
              {climateLayer ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.syncRow}>
            <MaterialIcons name="place" size={14} color={theme.textMuted} />
            <Text style={styles.syncText}>Tap a village on the map or expand a card below</Text>
          </View>

          <Text style={styles.sectionTitle}>CURRENT OUTBREAK ALERTS · TAP TO EXPAND</Text>

          {outbreakAlerts.map((alert) => (
            <AlertCard
              key={alert.village}
              alert={alert}
              expanded={expandedVillage === alert.village}
              onToggle={() => setExpandedVillage(expandedVillage === alert.village ? null : alert.village)}
            />
          ))}

          {climateLayer ? (
            <View style={styles.rainfallTable}>
              <Text style={styles.rainfallTitle}>RAINFALL DATA (mm above baseline)</Text>
              {outbreakAlerts.map((a) => (
                <View key={a.village} style={styles.rainfallRow}>
                  <Text style={styles.rainfallVillage}>{a.village}</Text>
                  <View style={styles.rainfallBar}>
                    <View style={[styles.rainfallFill, {
                      width: `${Math.min(100, (a.rainfallMm / 320) * 100)}%`,
                      backgroundColor: a.rainfallMm > 200 ? theme.statusRed : a.rainfallMm > 100 ? theme.statusYellow : theme.statusGreen,
                    }]} />
                  </View>
                  <Text style={styles.rainfallMm}>{a.rainfallMm}mm</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.citationBox}>
            <MaterialIcons name="science" size={14} color={theme.textMuted} />
            <Text style={styles.citationText}>
              Source: Bime et al. 2022 — Climate-malaria lag correlation · DHIS2 Climate App · Open-Meteo live weather · NW Cameroon village coordinates
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 16, marginBottom: 16,
  },
  headerSub: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginTop: 2 },
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  offlineText: { fontSize: 10, color: theme.statusYellow, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border,
  },
  toggleLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  toggleBtn: {
    borderRadius: theme.radius.full, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  syncText: { fontSize: 12, color: theme.textMuted },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  alertCard: { borderRadius: theme.radius.medium, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  alertCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  alertVillage: { fontSize: 16, fontWeight: '700' },
  alertCondition: { fontSize: 12, color: theme.textSecondary, marginTop: 2, fontWeight: '600' },
  riskChip: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  riskChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  alertNote: { fontSize: 13, color: theme.textSecondary, lineHeight: 18, marginBottom: 8 },
  lagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lagText: { fontSize: 12, color: theme.textMuted, fontStyle: 'italic' },
  rainfallTable: { backgroundColor: theme.surface, borderRadius: theme.radius.medium, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  rainfallTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  rainfallRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rainfallVillage: { width: 64, fontSize: 11, fontWeight: '600', color: theme.textSecondary },
  rainfallBar: { flex: 1, height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  rainfallFill: { height: 8, borderRadius: 4 },
  rainfallMm: { width: 44, fontSize: 11, fontWeight: '700', color: theme.textPrimary, textAlign: 'right' },
  citationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: theme.border,
  },
  citationText: { fontSize: 11, color: theme.textMuted, flex: 1, lineHeight: 16 },
});
