/**
 * MediAid · app/(tabs)/radar.tsx
 * AICEXPERTS Limited · MIT Licence
 *
 * Outbreak Radar screen.
 *
 * Shows REAL rows from the Supabase view outbreak_radar_7d via
 * services/radarRead.ts, with transparent labelling:
 *   - Rows where data_source != 'field' show a "SIMULATED / PROTOTYPE DATA" tag.
 *   - If all rows are non-field, the header says so.
 *   - The 4-week forecast and supply checklist are moved to an
 *     "Illustrative — not computed from data" note.
 *   - The weather widget stays but is labelled
 *     "Live weather (Open-Meteo) — not yet used in alert rules".
 *   - The climate / rainfall anomaly layer (DHIS2 Climate App, ERA-5, CHIRPS)
 *     is labelled "Planned — Quarter 2".
 *
 * Pull-to-refresh + 60-second auto-refresh while the screen is focused.
 * Loading spinner, empty state, error state with Retry.
 */
import { MaterialIcons } from '@expo/vector-icons';
import OutbreakMap from '@/components/OutbreakMap'; // .native.tsx on iOS/Android
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated, ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { fetchRadar7d, type RadarRow } from '@/services/radarRead';
import { VILLAGE_SITES } from '@/contexts/AppContext';

// ---------------------------------------------------------------------------
// Config — geohash → display name + map coordinates (configuration data, not patient data)
// ---------------------------------------------------------------------------

interface VillageConfig {
  displayName: string;
  coords:      { latitude: number; longitude: number };
  mapPosition: { top: string; left: string }; // for web fallback
}

const GEOHASH_CONFIG: Record<string, VillageConfig> = {
  s0yg: { displayName: 'Baligham', coords: { latitude: 5.897, longitude: 10.158 }, mapPosition: { top: '52%', left: '34%' } },
  s0yf: { displayName: 'Bagam',    coords: { latitude: 5.974, longitude: 10.283 }, mapPosition: { top: '38%', left: '58%' } },
  s000: { displayName: 'Lab / Demo', coords: { latitude: 5.96,  longitude: 10.16  }, mapPosition: { top: '55%', left: '45%' } },
  // Fallback for legacy rows without 4-char geohash in config
};

function villageDisplayName(geohash: string): string {
  return GEOHASH_CONFIG[geohash]?.displayName ?? `Area ${geohash}`;
}

// ---------------------------------------------------------------------------
// Alert level helpers
// ---------------------------------------------------------------------------

function alertColor(level: 'OUTBREAK' | 'ELEVATED' | 'NORMAL') {
  if (level === 'OUTBREAK') return theme.statusRed;
  if (level === 'ELEVATED') return theme.statusYellow;
  return theme.statusGreen;
}
function alertBg(level: 'OUTBREAK' | 'ELEVATED' | 'NORMAL') {
  if (level === 'OUTBREAK') return theme.statusRedBg;
  if (level === 'ELEVATED') return theme.statusYellowBg;
  return theme.statusGreenBg;
}
function alertIcon(level: 'OUTBREAK' | 'ELEVATED' | 'NORMAL') {
  if (level === 'OUTBREAK') return 'warning' as const;
  if (level === 'ELEVATED') return 'trending-up' as const;
  return 'check-circle' as const;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectivityBadge({ connected, fromCache, cacheAgeMs }: {
  connected: boolean | null;
  fromCache: boolean;
  cacheAgeMs: number | null;
}) {
  if (fromCache) {
    const ageMin = cacheAgeMs != null ? Math.round(cacheAgeMs / 60000) : null;
    return (
      <View style={[badgeStyles.badge, { backgroundColor: theme.statusYellow + '18', borderColor: theme.statusYellow + '55' }]}>
        <MaterialIcons name="wifi-off" size={12} color={theme.statusYellow} />
        <Text style={[badgeStyles.text, { color: theme.statusYellow }]}>
          {connected === false ? 'Offline · ' : ''}
          {ageMin != null ? `cached ${ageMin}m ago` : 'cached'}
        </Text>
      </View>
    );
  }
  if (connected === false) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: theme.statusYellow + '18', borderColor: theme.statusYellow + '55' }]}>
        <MaterialIcons name="wifi-off" size={12} color={theme.statusYellow} />
        <Text style={[badgeStyles.text, { color: theme.statusYellow }]}>Offline</Text>
      </View>
    );
  }
  return (
    <View style={[badgeStyles.badge, { backgroundColor: theme.statusGreen + '18', borderColor: theme.statusGreen + '55' }]}>
      <View style={badgeStyles.dot} />
      <Text style={[badgeStyles.text, { color: theme.statusGreen }]}>Live</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  text: { fontSize: 10, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.statusGreen },
});

function SimulatedTag({ dataSource }: { dataSource: string }) {
  if (dataSource === 'field') return null;
  return (
    <View style={tagStyles.tag}>
      <MaterialIcons name="science" size={10} color={theme.statusYellow} />
      <Text style={tagStyles.text}>SIMULATED / PROTOTYPE DATA</Text>
    </View>
  );
}

const tagStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusYellow + '15',
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusYellow + '44', alignSelf: 'flex-start',
  },
  text: { fontSize: 9, fontWeight: '800', color: theme.statusYellow, letterSpacing: 0.5 },
});

// ── Outbreak notification banner (real data) ─────────────────────────────────
function OutbreakBanner({ rows }: { rows: RadarRow[] }) {
  const outbreaks = rows.filter((r) => r.alert_level === 'OUTBREAK');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (outbreaks.length === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [outbreaks.length]);

  if (outbreaks.length === 0 || dismissed) return null;

  return (
    <Animated.View style={[bannerStyles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={bannerStyles.iconCircle}>
        <MaterialIcons name="warning" size={18} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bannerStyles.title}>
          {outbreaks.length} OUTBREAK{outbreaks.length > 1 ? 'S' : ''} DETECTED (LAST 7 DAYS)
        </Text>
        <Text style={bannerStyles.sub} numberOfLines={1}>
          {outbreaks.map((r) => villageDisplayName(r.village_geohash)).join(' · ')}
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
    backgroundColor: theme.statusRed, borderRadius: theme.radius.medium,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: theme.statusRed, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  dismissBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ── Real radar row card ───────────────────────────────────────────────────────
function RadarCard({ row, expanded, onToggle }: {
  row: RadarRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const col    = alertColor(row.alert_level);
  const bg     = alertBg(row.alert_level);
  const icon   = alertIcon(row.alert_level);
  const coughPct = row.total_scans > 0
    ? ((row.cough_positive / row.total_scans) * 100).toFixed(0)
    : '0';
  const lastUpdated = new Date(row.last_recorded_at);
  const minutesAgo  = Math.round((Date.now() - lastUpdated.getTime()) / 60000);
  const ageLabel    = minutesAgo < 60
    ? `${minutesAgo}m ago`
    : minutesAgo < 1440
    ? `${Math.round(minutesAgo / 60)}h ago`
    : `${Math.round(minutesAgo / 1440)}d ago`;

  return (
    <Pressable
      style={[cardStyles.card, { borderLeftColor: col, backgroundColor: bg }]}
      onPress={onToggle}
    >
      {/* Header row */}
      <View style={cardStyles.headerRow}>
        <MaterialIcons name={icon} size={22} color={col} />
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.villageName, { color: col }]}>
            {villageDisplayName(row.village_geohash)}
          </Text>
          <Text style={cardStyles.geohashSub}>
            geohash: {row.village_geohash} · updated {ageLabel}
          </Text>
        </View>
        <View style={[cardStyles.levelChip, { backgroundColor: col + '22', borderColor: col + '55' }]}>
          <Text style={[cardStyles.levelChipText, { color: col }]}>{row.alert_level}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={col} />
      </View>

      {/* Simulated tag */}
      <SimulatedTag dataSource={row.data_source} />

      {/* Stats row */}
      <View style={cardStyles.statsRow}>
        <StatPill icon="people" label="Scans" value={String(row.total_scans)} color={theme.textSecondary} />
        <StatPill icon="cancel" label="RED" value={String(row.red_count)} color={row.red_count > 0 ? theme.statusRed : theme.textMuted} />
        <StatPill icon="mic" label="Cough+" value={`${coughPct}%`} color={Number(coughPct) > 35 ? theme.statusYellow : theme.textSecondary} />
        <StatPill icon="share" label="Referral" value={String(row.referral_count)} color={theme.textSecondary} />
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={cardStyles.detail}>
          <View style={cardStyles.divider} />
          <View style={cardStyles.detailRow}>
            <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
            <Text style={cardStyles.detailText}>
              Source: <Text style={{ fontWeight: '700', color: theme.textSecondary }}>{row.data_source}</Text>
              {'  '}·{'  '}
              Green: {row.green_count}{'  '}Amber: {row.amber_count}{'  '}Red: {row.red_count}
            </Text>
          </View>
          {row.alert_level === 'OUTBREAK' && (
            <View style={cardStyles.outbreakNote}>
              <MaterialIcons name="warning" size={13} color={theme.statusRed} />
              <Text style={cardStyles.outbreakNoteText}>
                ≥2 RED-alert scans in 7 days. Supervisor escalation recommended.
              </Text>
            </View>
          )}
          {row.alert_level === 'ELEVATED' && (
            <View style={cardStyles.elevatedNote}>
              <MaterialIcons name="trending-up" size={13} color={theme.statusYellow} />
              <Text style={cardStyles.elevatedNoteText}>
                Cough-positive rate &gt;35% with fewer than 2 RED alerts. Monitor closely.
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={cardStyles.pill}>
      <MaterialIcons name={icon as any} size={13} color={color} />
      <Text style={[cardStyles.pillValue, { color }]}>{value}</Text>
      <Text style={cardStyles.pillLabel}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { borderRadius: theme.radius.medium, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  villageName: { fontSize: 16, fontWeight: '700' },
  geohashSub: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  levelChip: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  levelChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  pill: { flex: 1, backgroundColor: theme.background + '88', borderRadius: theme.radius.small, padding: 8, alignItems: 'center', gap: 3 },
  pillValue: { fontSize: 15, fontWeight: '700' },
  pillLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 10 },
  detail: {},
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 18 },
  outbreakNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8,
    backgroundColor: theme.statusRed + '10', borderRadius: theme.radius.small, padding: 8,
    borderWidth: 1, borderColor: theme.statusRed + '33',
  },
  outbreakNoteText: { flex: 1, fontSize: 11, color: theme.statusRed, lineHeight: 17 },
  elevatedNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8,
    backgroundColor: theme.statusYellow + '10', borderRadius: theme.radius.small, padding: 8,
    borderWidth: 1, borderColor: theme.statusYellow + '33',
  },
  elevatedNoteText: { flex: 1, fontSize: 11, color: theme.statusYellow, lineHeight: 17 },
});

// ── Live Weather Widget ──────────────────────────────────────────────────────
interface WeatherData {
  temperature: number; humidity: number; rainfall: number; windspeed: number;
}

function getWeatherRisk(temp: number, humidity: number, rainfall: number) {
  if (rainfall > 30 && humidity > 75) return { level: 'High' as const, reason: 'Heavy rainfall + high humidity → elevated vector-borne risk' };
  if (rainfall > 15 || humidity > 65) return { level: 'Medium' as const, reason: 'Moderate rainfall → watch for mosquito surge in 4–6 weeks' };
  return { level: 'Low' as const, reason: 'Dry conditions — lower vector-borne disease risk' };
}

function WeatherWidget({ weather, loading }: { weather: WeatherData | null; loading: boolean }) {
  const risk = weather ? getWeatherRisk(weather.temperature, weather.humidity, weather.rainfall) : null;
  const riskCol = !risk ? theme.textMuted
    : risk.level === 'High' ? theme.statusRed
    : risk.level === 'Medium' ? theme.statusYellow
    : theme.statusGreen;

  return (
    <View style={weatherStyles.card}>
      <View style={weatherStyles.headerRow}>
        <MaterialIcons name="wb-sunny" size={15} color={theme.statusYellow} />
        <Text style={weatherStyles.headerTitle}>LIVE WEATHER · BAMENDA (Open-Meteo)</Text>
        <View style={[weatherStyles.notUsed]}>
          <Text style={weatherStyles.notUsedText}>not yet used in alert rules</Text>
        </View>
      </View>
      {loading ? (
        <View style={weatherStyles.loadingRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={weatherStyles.loadingText}>Fetching weather data…</Text>
        </View>
      ) : !weather ? (
        <View style={weatherStyles.loadingRow}>
          <MaterialIcons name="wifi-off" size={18} color={theme.statusYellow} />
          <Text style={weatherStyles.loadingText}>Offline — weather unavailable</Text>
        </View>
      ) : (
        <>
          <View style={weatherStyles.metricsRow}>
            {[
              { icon: 'thermostat', value: `${weather.temperature}°C`, label: 'Temp',     color: '#FF7043' },
              { icon: 'water-drop', value: `${weather.humidity}%`,     label: 'Humidity', color: '#42A5F5' },
              { icon: 'grain',      value: `${weather.rainfall}mm`,    label: 'Rain 24h', color: '#7986CB' },
              { icon: 'air',        value: `${weather.windspeed}km/h`, label: 'Wind',     color: theme.textSecondary },
            ].map((m) => (
              <View key={m.label} style={weatherStyles.metric}>
                <MaterialIcons name={m.icon as any} size={20} color={m.color} />
                <Text style={weatherStyles.metricValue}>{m.value}</Text>
                <Text style={weatherStyles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          {risk && (
            <View style={[weatherStyles.riskRow, {
              backgroundColor: riskCol + '10', borderColor: riskCol + '44',
            }]}>
              <MaterialIcons name={risk.level === 'High' ? 'bug-report' : risk.level === 'Medium' ? 'warning' : 'check-circle'} size={15} color={riskCol} />
              <View style={{ flex: 1 }}>
                <Text style={[weatherStyles.riskLabel, { color: riskCol }]}>
                  {risk.level} epidemiological risk (illustrative — not linked to alert rules)
                </Text>
                <Text style={weatherStyles.riskReason}>{risk.reason}</Text>
              </View>
            </View>
          )}
          <Text style={weatherStyles.source}>
            Source: Open-Meteo · lat 5.96°N lon 10.16°E · Updated hourly
            {'\n'}DHIS2 Climate App / ERA-5 / CHIRPS integration: Planned — Quarter 2
          </Text>
        </>
      )}
    </View>
  );
}

const weatherStyles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderRadius: theme.radius.medium, padding: 14, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  headerTitle: { flex: 1, fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  notUsed: { backgroundColor: theme.textMuted + '18', borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: theme.textMuted + '33' },
  notUsedText: { fontSize: 8, color: theme.textMuted, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  loadingText: { fontSize: 13, color: theme.textMuted },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metric: { flex: 1, alignItems: 'center', backgroundColor: theme.background, borderRadius: theme.radius.small, padding: 8, gap: 3 },
  metricValue: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  metricLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  riskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: theme.radius.small, padding: 10, borderWidth: 1, marginBottom: 8 },
  riskLabel: { fontSize: 12, fontWeight: '700' },
  riskReason: { fontSize: 11, color: theme.textSecondary, marginTop: 2, lineHeight: 15 },
  source: { fontSize: 9, color: theme.textMuted, lineHeight: 14 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RadarScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();

  const [rows,         setRows]         = useState<RadarRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [fromCache,    setFromCache]    = useState(false);
  const [cacheAgeMs,   setCacheAgeMs]   = useState<number | null>(null);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [connected,    setConnected]    = useState<boolean | null>(null);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [weather,      setWeather]      = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connectivity ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s: NetInfoState) => setConnected(s.isConnected ?? false));
    NetInfo.fetch().then((s) => setConnected(s.isConnected ?? false));
    return () => unsub();
  }, []);

  // ── Fetch radar data ─────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const result = await fetchRadar7d();
    setRows(result.rows);
    setFromCache(result.fromCache);
    setCacheAgeMs(result.cacheAgeMs);
    setFetchError(result.error);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 60s
    intervalRef.current = setInterval(() => loadData(true), 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData]);

  // ── Weather ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=5.96&longitude=10.16&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=Africa%2FDouala'
        );
        const json = await res.json();
        const cur  = json.current;
        setWeather({
          temperature: Math.round(cur.temperature_2m),
          humidity:    Math.round(cur.relative_humidity_2m),
          rainfall:    Math.round(cur.precipitation * 10) / 10,
          windspeed:   Math.round(cur.wind_speed_10m),
        });
      } catch {
        // offline — widget handles null
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
  }, []);

  // ── Derived state ────────────────────────────────────────────────────────
  const allSimulated = rows.length > 0 && rows.every((r) => r.data_source !== 'field');
  const outbreakRows = rows.filter((r) => r.alert_level === 'OUTBREAK');

  // Build map alerts from real rows
  const mapAlerts = rows.map((r) => ({
    geohash:    r.village_geohash,
    village:    villageDisplayName(r.village_geohash),
    alertLevel: r.alert_level,
    totalScans: r.total_scans,
    redCount:   r.red_count,
    dataSource: r.data_source,
  }));

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>Northwest Region · Cameroon</Text>
            <Text style={styles.headerTitle}>Outbreak Radar</Text>
            {allSimulated && rows.length > 0 && (
              <View style={styles.allSimBanner}>
                <MaterialIcons name="science" size={12} color={theme.statusYellow} />
                <Text style={styles.allSimText}>
                  All rows are SIMULATED / PROTOTYPE DATA — not from validated field scans
                </Text>
              </View>
            )}
          </View>
          <ConnectivityBadge connected={connected} fromCache={fromCache} cacheAgeMs={cacheAgeMs} />
        </View>

        {/* ── Map ── */}
        <OutbreakMap
          alerts={mapAlerts}
          selectedVillage={expandedHash}
          onSelectVillage={(gh) => setExpandedHash(expandedHash === gh ? null : gh)}
          climateLayer={false}
        />

        {/* ── Outbreak banner ── */}
        {outbreakRows.length > 0 && <OutbreakBanner rows={rows} />}

        {/* ── Weather widget ── */}
        <WeatherWidget weather={weather} loading={weatherLoading} />

        {/* ── Climate layer note ── */}
        <View style={styles.plannedCard}>
          <MaterialIcons name="construction" size={16} color={theme.statusYellow} />
          <View style={{ flex: 1 }}>
            <Text style={styles.plannedTitle}>Rainfall / Climate Layer — Planned Quarter 2</Text>
            <Text style={styles.plannedText}>
              DHIS2 Climate App · ERA-5 reanalysis · CHIRPS rainfall anomaly → 4–6 week lag
              forecast (Bime et al. 2022). Not yet computed from real data.
            </Text>
          </View>
        </View>

        {/* ── Alert rows section ── */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.sectionTitle}>
            OUTBREAK RADAR — LAST 7 DAYS
            {fetchError && !fromCache ? ' (ERROR)' : fromCache ? ' (CACHED)' : ''}
          </Text>

          {/* ── Loading ── */}
          {loading && !refreshing && (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.centeredStateText}>Loading radar data…</Text>
            </View>
          )}

          {/* ── Error + no cache ── */}
          {!loading && fetchError && rows.length === 0 && (
            <View style={styles.errorState}>
              <MaterialIcons name="cloud-off" size={36} color={theme.statusRed} />
              <Text style={styles.errorTitle}>Could not load radar data</Text>
              <Text style={styles.errorDetail}>{fetchError}</Text>
              <Pressable
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
                onPress={() => loadData()}
              >
                <MaterialIcons name="refresh" size={18} color="#FFF" />
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* ── Error with stale cache ── */}
          {!loading && fetchError && rows.length > 0 && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="warning" size={14} color={theme.statusYellow} />
              <Text style={styles.errorBannerText}>{fetchError}</Text>
              <Pressable onPress={() => loadData(true)} hitSlop={8}>
                <MaterialIcons name="refresh" size={18} color={theme.primary} />
              </Pressable>
            </View>
          )}

          {/* ── Empty state ── */}
          {!loading && rows.length === 0 && !fetchError && (
            <View style={styles.emptyState}>
              <MaterialIcons name="radar" size={44} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>No sessions in the last 7 days</Text>
              <Text style={styles.emptyDetail}>
                Complete scans and sync them to see village-level radar data here.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.syncLink, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/(tabs)/sync')}
              >
                <MaterialIcons name="cloud-sync" size={16} color={theme.primary} />
                <Text style={styles.syncLinkText}>Go to Sync screen</Text>
              </Pressable>
            </View>
          )}

          {/* ── Real radar cards ── */}
          {rows.map((row) => (
            <RadarCard
              key={`${row.village_geohash}_${row.data_source}`}
              row={row}
              expanded={expandedHash === row.village_geohash}
              onToggle={() => setExpandedHash(expandedHash === row.village_geohash ? null : row.village_geohash)}
            />
          ))}

          {/* ── Illustrative forecast note ── */}
          {rows.length > 0 && (
            <View style={styles.illustrativeCard}>
              <MaterialIcons name="info-outline" size={15} color={theme.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.illustrativeTitle}>4-Week Forecast — Illustrative only</Text>
                <Text style={styles.illustrativeText}>
                  The case-count prediction chart and supply checklist shown in previous
                  builds were illustrative examples, not computed from real field data.
                  They have been removed pending the DHIS2 Climate App integration
                  (Quarter 2). Real alert levels above are computed server-side from
                  aggregated scan counts.
                </Text>
              </View>
            </View>
          )}

          {/* ── Legend / glossary ── */}
          <View style={styles.legendCard}>
            <Text style={styles.legendTitle}>ALERT LEVEL GLOSSARY</Text>
            {[
              { level: 'OUTBREAK' as const, desc: '≥2 RED-alert scans in 7 days from the same area' },
              { level: 'ELEVATED' as const, desc: 'Cough-positive rate >35% of total scans (with <2 red)' },
              { level: 'NORMAL'   as const, desc: 'No outbreak threshold exceeded' },
            ].map((g) => (
              <View key={g.level} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: alertColor(g.level) }]} />
                <Text style={[styles.legendLevel, { color: alertColor(g.level) }]}>{g.level}</Text>
                <Text style={styles.legendDesc}>{g.desc}</Text>
              </View>
            ))}
            <Text style={styles.legendNote}>
              Alert levels computed server-side in the outbreak_radar_7d Supabase view.
              Small-cell suppression: real field data ({'<'}5 scans) not published.
            </Text>
          </View>

          <Text style={styles.footer}>
            MediAid v1.0 · UNICEF Venture Fund 2026 · Offline-first · MIT Licence
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 16, marginBottom: 16, gap: 10,
  },
  headerSub: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, marginTop: 2 },
  allSimBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6,
    backgroundColor: theme.statusYellow + '12', borderRadius: theme.radius.small,
    padding: 6, borderWidth: 1, borderColor: theme.statusYellow + '33',
  },
  allSimText: { flex: 1, fontSize: 10, color: theme.statusYellow, lineHeight: 14, fontWeight: '600' },

  plannedCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.statusYellow + '08', borderRadius: theme.radius.medium,
    padding: 12, marginHorizontal: 16, marginBottom: 14,
    borderWidth: 1, borderColor: theme.statusYellow + '33',
  },
  plannedTitle: { fontSize: 12, fontWeight: '700', color: theme.statusYellow, marginBottom: 2 },
  plannedText: { fontSize: 11, color: theme.textMuted, lineHeight: 17 },

  sectionTitle: {
    fontSize: 11, color: theme.textMuted, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
  },

  centeredState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  centeredStateText: { fontSize: 14, color: theme.textMuted },

  errorState: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  errorDetail: { fontSize: 12, color: theme.statusRed, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  retryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusYellow + '10', borderRadius: theme.radius.medium,
    padding: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.statusYellow + '33',
  },
  errorBannerText: { flex: 1, fontSize: 11, color: theme.statusYellow, lineHeight: 17 },

  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  emptyDetail: { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },
  syncLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.medium,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 4,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  syncLinkText: { color: theme.primary, fontSize: 14, fontWeight: '700' },

  illustrativeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.border,
  },
  illustrativeTitle: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 4 },
  illustrativeText: { fontSize: 11, color: theme.textMuted, lineHeight: 17 },

  legendCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.border,
  },
  legendTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  legendLevel: { fontSize: 12, fontWeight: '800', width: 80 },
  legendDesc: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 17 },
  legendNote: { fontSize: 10, color: theme.textMuted, lineHeight: 15, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },

  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
