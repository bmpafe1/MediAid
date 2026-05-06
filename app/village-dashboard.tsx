// MediAid — Village Health Dashboard
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

interface Village {
  name: string;
  district: string;
  population: number;
  screened: number;
  reds: number;
  yellows: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  cha: string;
  chaAvatar: string;
  conditions: string[];
  vaccinationRate: number; // 0-100%
  malariaBednetRate: number; // 0-100%
  activeOutbreak: string | null;
  lastVisit: string; // ISO date
}

const VILLAGES: Village[] = [
  {
    name: 'Baligham',
    district: 'Bamenda III',
    population: 3420,
    screened: 142,
    reds: 18,
    yellows: 35,
    riskLevel: 'High',
    cha: 'Abena Mbah',
    chaAvatar: 'A',
    conditions: ['Malaria', 'TB', 'Anemia'],
    vaccinationRate: 61,
    malariaBednetRate: 54,
    activeOutbreak: 'Malaria (Wk 12–15)',
    lastVisit: '2025-04-12',
  },
  {
    name: 'Bagam',
    district: 'Bamenda II',
    population: 2180,
    screened: 87,
    reds: 9,
    yellows: 21,
    riskLevel: 'Medium',
    cha: 'Celestine Nkemngong',
    chaAvatar: 'C',
    conditions: ['Respiratory', 'AFib'],
    vaccinationRate: 74,
    malariaBednetRate: 68,
    activeOutbreak: null,
    lastVisit: '2025-04-10',
  },
  {
    name: 'Bambui',
    district: 'Bamenda III',
    population: 4100,
    screened: 198,
    reds: 11,
    yellows: 42,
    riskLevel: 'Medium',
    cha: 'Desmond Fru',
    chaAvatar: 'D',
    conditions: ['Cholera', 'Eye conditions'],
    vaccinationRate: 82,
    malariaBednetRate: 77,
    activeOutbreak: 'Cholera watch (Wk 14)',
    lastVisit: '2025-04-14',
  },
  {
    name: 'Fundong',
    district: 'Boyo Division',
    population: 5600,
    screened: 301,
    reds: 4,
    yellows: 18,
    riskLevel: 'Low',
    cha: 'Ngwa Perpetua',
    chaAvatar: 'N',
    conditions: ['Meningitis watch'],
    vaccinationRate: 89,
    malariaBednetRate: 85,
    activeOutbreak: null,
    lastVisit: '2025-04-15',
  },
];

function riskColor(r: Village['riskLevel']) {
  if (r === 'High') return theme.statusRed;
  if (r === 'Medium') return theme.statusYellow;
  return theme.statusGreen;
}
function riskBg(r: Village['riskLevel']) {
  if (r === 'High') return theme.statusRedBg;
  if (r === 'Medium') return theme.statusYellowBg;
  return theme.statusGreenBg;
}

function CoverageBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.pct, { color }]}>{value}%</Text>
    </View>
  );
}
const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { width: 100, fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  track: { flex: 1, height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  pct: { width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

function VillageCard({ village, expanded, onToggle }: {
  village: Village;
  expanded: boolean;
  onToggle: () => void;
}) {
  const col = riskColor(village.riskLevel);
  const bg = riskBg(village.riskLevel);
  const screenedPct = Math.round((village.screened / village.population) * 100);

  return (
    <Pressable
      style={[vStyles.card, { borderLeftColor: col }]}
      onPress={onToggle}
    >
      {/* Header */}
      <View style={vStyles.header}>
        <View style={[vStyles.riskDot, { backgroundColor: col }]} />
        <View style={{ flex: 1 }}>
          <Text style={vStyles.villageName}>{village.name}</Text>
          <Text style={vStyles.district}>{village.district} · Pop. {village.population.toLocaleString()}</Text>
        </View>
        <View style={[vStyles.riskChip, { backgroundColor: col + '22', borderColor: col + '55' }]}>
          <Text style={[vStyles.riskChipText, { color: col }]}>{village.riskLevel}</Text>
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22} color={theme.textMuted}
        />
      </View>

      {/* Coverage bar */}
      <View style={vStyles.coverageRow}>
        <View style={vStyles.coverageTrack}>
          <View style={[vStyles.coverageFill, { width: `${screenedPct}%`, backgroundColor: col }]} />
        </View>
        <Text style={[vStyles.coveragePct, { color: col }]}>{screenedPct}% screened</Text>
      </View>

      {/* Stats mini row */}
      <View style={vStyles.statsRow}>
        {[
          { label: 'Screened', value: village.screened, color: theme.primary },
          { label: 'RED', value: village.reds, color: theme.statusRed },
          { label: 'WATCH', value: village.yellows, color: theme.statusYellow },
        ].map((s) => (
          <View key={s.label} style={[vStyles.statCell, { borderColor: s.color + '33' }]}>
            <Text style={[vStyles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={vStyles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Active outbreak badge */}
      {village.activeOutbreak && (
        <View style={vStyles.outbreakBadge}>
          <MaterialIcons name="warning" size={12} color={theme.statusRed} />
          <Text style={vStyles.outbreakText}>OUTBREAK: {village.activeOutbreak}</Text>
        </View>
      )}

      {/* CHA chip */}
      <View style={vStyles.chaRow}>
        <View style={[vStyles.chaAvatar, { backgroundColor: col + '22', borderColor: col + '55' }]}>
          <Text style={[vStyles.chaAvatarText, { color: col }]}>{village.chaAvatar}</Text>
        </View>
        <Text style={vStyles.chaName}>CHA: {village.cha}</Text>
        <View style={vStyles.lastVisitChip}>
          <MaterialIcons name="access-time" size={11} color={theme.textMuted} />
          <Text style={vStyles.lastVisitText}>
            {new Date(village.lastVisit).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={vStyles.expanded}>
          <View style={vStyles.expandDivider} />

          {/* Conditions */}
          <Text style={vStyles.sectionLabel}>ACTIVE CONDITIONS</Text>
          <View style={vStyles.conditionsRow}>
            {village.conditions.map((c) => (
              <View key={c} style={[vStyles.conditionChip, { backgroundColor: col + '18', borderColor: col + '44' }]}>
                <Text style={[vStyles.conditionChipText, { color: col }]}>{c}</Text>
              </View>
            ))}
          </View>

          {/* Coverage metrics */}
          <Text style={[vStyles.sectionLabel, { marginTop: 12 }]}>INTERVENTION COVERAGE</Text>
          <CoverageBar label="Vaccination" value={village.vaccinationRate} color={theme.statusGreen} />
          <CoverageBar label="Malaria bednets" value={village.malariaBednetRate} color={theme.primary} />
          <CoverageBar label="Screened" value={screenedPct} color={col} />

          {/* Population breakdown */}
          <Text style={[vStyles.sectionLabel, { marginTop: 8 }]}>POPULATION</Text>
          <View style={vStyles.popRow}>
            <View style={vStyles.popItem}>
              <Text style={vStyles.popValue}>{village.population.toLocaleString()}</Text>
              <Text style={vStyles.popLabel}>Total</Text>
            </View>
            <View style={vStyles.popItem}>
              <Text style={[vStyles.popValue, { color: theme.primary }]}>
                {Math.round(village.population * 0.42).toLocaleString()}
              </Text>
              <Text style={vStyles.popLabel}>Under 5 eligible</Text>
            </View>
            <View style={vStyles.popItem}>
              <Text style={[vStyles.popValue, { color: theme.statusYellow }]}>
                {Math.round(village.population * 0.19).toLocaleString()}
              </Text>
              <Text style={vStyles.popLabel}>Elderly</Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const vStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  villageName: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  district: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  riskChip: {
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  riskChipText: { fontSize: 10, fontWeight: '700' },
  coverageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  coverageTrack: { flex: 1, height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: '100%', borderRadius: 3 },
  coveragePct: { fontSize: 12, fontWeight: '700', width: 80, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCell: {
    flex: 1, borderRadius: theme.radius.small, borderWidth: 1,
    padding: 8, alignItems: 'center',
    backgroundColor: theme.background,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  outbreakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8,
    borderWidth: 1, borderColor: theme.statusRed + '44',
    alignSelf: 'flex-start',
  },
  outbreakText: { fontSize: 10, fontWeight: '700', color: theme.statusRed },
  chaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chaAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  chaAvatarText: { fontSize: 13, fontWeight: '800' },
  chaName: { flex: 1, fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
  lastVisitChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.border,
  },
  lastVisitText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  expanded: { marginTop: 12 },
  expandDivider: { height: 1, backgroundColor: theme.border, marginBottom: 12 },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  conditionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  conditionChip: {
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  conditionChipText: { fontSize: 11, fontWeight: '600' },
  popRow: { flexDirection: 'row', gap: 10 },
  popItem: {
    flex: 1, backgroundColor: theme.background, borderRadius: theme.radius.small,
    padding: 10, alignItems: 'center',
  },
  popValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  popLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2, textAlign: 'center' },
});

export default function VillageDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();
  const [expandedVillage, setExpandedVillage] = useState<string | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  const filtered = VILLAGES.filter((v) => selectedRisk === 'All' || v.riskLevel === selectedRisk);

  const totalScreened = VILLAGES.reduce((s, v) => s + v.screened, 0);
  const totalPop = VILLAGES.reduce((s, v) => s + v.population, 0);
  const totalReds = VILLAGES.reduce((s, v) => s + v.reds, 0);
  const coveragePct = Math.round((totalScreened / totalPop) * 100);
  const activeOutbreaks = VILLAGES.filter((v) => v.activeOutbreak).length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Village Dashboard</Text>
          <Text style={styles.navSub}>4 villages · NW Cameroon</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Field Data</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* District summary cards */}
        <Text style={styles.sectionTitle}>DISTRICT OVERVIEW</Text>
        <View style={styles.summaryGrid}>
          {[
            { label: 'Total Screened', value: totalScreened.toLocaleString(), color: theme.primary, icon: 'health-and-safety' },
            { label: 'Coverage', value: `${coveragePct}%`, color: theme.statusGreen, icon: 'pie-chart' },
            { label: 'RED Alerts', value: totalReds, color: theme.statusRed, icon: 'warning' },
            { label: 'Outbreaks', value: activeOutbreaks, color: theme.statusYellow, icon: 'coronavirus' },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCard, { borderColor: s.color + '44' }]}>
              <MaterialIcons name={s.icon as any} size={22} color={s.color} />
              <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* District coverage bar */}
        <View style={styles.districtCoverageCard}>
          <View style={styles.districtCoverageHeader}>
            <MaterialIcons name="groups" size={16} color={theme.primary} />
            <Text style={styles.districtCoverageTitle}>
              District Population Coverage
            </Text>
            <Text style={[styles.districtCoveragePct, { color: coveragePct >= 70 ? theme.statusGreen : theme.statusYellow }]}>
              {coveragePct}%
            </Text>
          </View>
          <View style={styles.bigTrack}>
            <View style={[styles.bigFill, {
              width: `${coveragePct}%`,
              backgroundColor: coveragePct >= 70 ? theme.statusGreen : coveragePct >= 40 ? theme.statusYellow : theme.statusRed,
            }]} />
          </View>
          <Text style={styles.districtCoverageTarget}>WHO target: 80% by Q3 2025</Text>
        </View>

        {/* CHA leaderboard */}
        <Text style={styles.sectionTitle}>CHA PERFORMANCE</Text>
        <View style={styles.chaLeaderboard}>
          {[...VILLAGES]
            .sort((a, b) => (b.screened / b.population) - (a.screened / a.population))
            .map((v, i) => {
              const pct = Math.round((v.screened / v.population) * 100);
              return (
                <View key={v.name} style={styles.chaRow}>
                  <View style={styles.rankBadge}>
                    <Text style={[styles.rankText, i === 0 && { color: '#FFD700' }]}>#{i + 1}</Text>
                  </View>
                  <View style={[styles.chaAvatarSmall, {
                    backgroundColor: riskColor(v.riskLevel) + '22',
                    borderColor: riskColor(v.riskLevel) + '55',
                  }]}>
                    <Text style={[styles.chaAvatarLetter, { color: riskColor(v.riskLevel) }]}>{v.chaAvatar}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chaNameText}>{v.cha}</Text>
                    <Text style={styles.chaVillage}>{v.name} · {v.screened} patients</Text>
                  </View>
                  <View style={styles.chaPctBadge}>
                    <Text style={[styles.chaPctText, { color: pct >= 10 ? theme.statusGreen : theme.statusYellow }]}>
                      {pct}%
                    </Text>
                  </View>
                </View>
              );
            })}
        </View>

        {/* Filter chips */}
        <Text style={styles.sectionTitle}>VILLAGES BY RISK</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['All', 'High', 'Medium', 'Low'] as const).map((r) => {
              const col = r === 'All' ? theme.primary : r === 'High' ? theme.statusRed : r === 'Medium' ? theme.statusYellow : theme.statusGreen;
              return (
                <Pressable
                  key={r}
                  style={[styles.filterChip, selectedRisk === r && { backgroundColor: col + '22', borderColor: col }]}
                  onPress={() => setSelectedRisk(r)}
                >
                  {r !== 'All' && <View style={[styles.chipDot, { backgroundColor: col }]} />}
                  <Text style={[styles.filterChipText, selectedRisk === r && { color: col, fontWeight: '700' }]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Village cards */}
        {filtered.map((v) => (
          <VillageCard
            key={v.name}
            village={v}
            expanded={expandedVillage === v.name}
            onToggle={() => setExpandedVillage(expandedVillage === v.name ? null : v.name)}
          />
        ))}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { borderColor: theme.primary + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(tabs)/radar')}
          >
            <MaterialIcons name="radar" size={18} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Outbreak Radar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { borderColor: theme.statusGreen + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/supervisor')}
          >
            <MaterialIcons name="admin-panel-settings" size={18} color={theme.statusGreen} />
            <Text style={[styles.actionBtnText, { color: theme.statusGreen }]}>Supervisor View</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Data from 4 CHAs across Bamenda District · DHIS2 synced · MediAid v1.0
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
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.statusGreen },
  liveText: { fontSize: 10, fontWeight: '700', color: theme.statusGreen },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  summaryCard: {
    width: '47%', backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, alignItems: 'center', gap: 6, borderWidth: 1,
  },
  summaryValue: { fontSize: 26, fontWeight: '800' },
  summaryLabel: { fontSize: 10, color: theme.textSecondary, fontWeight: '600', textAlign: 'center' },
  districtCoverageCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 4,
    borderWidth: 1, borderColor: theme.border,
  },
  districtCoverageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  districtCoverageTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  districtCoveragePct: { fontSize: 18, fontWeight: '800' },
  bigTrack: { height: 12, backgroundColor: theme.border, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  bigFill: { height: '100%', borderRadius: 6 },
  districtCoverageTarget: { fontSize: 10, color: theme.textMuted },
  chaLeaderboard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  chaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  rankBadge: { width: 28, alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '800', color: theme.textMuted },
  chaAvatarSmall: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  chaAvatarLetter: { fontSize: 14, fontWeight: '800' },
  chaNameText: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  chaVillage: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  chaPctBadge: {
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.border,
  },
  chaPctText: { fontSize: 13, fontWeight: '800' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingVertical: 12, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
