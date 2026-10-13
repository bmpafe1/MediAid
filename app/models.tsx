/**
 * MediAid · app/models.tsx
 * AICEXPERTS Limited · MIT Licence
 *
 * Models Registry Viewer — Settings page listing all registered modules,
 * their versions, status, runtime and contract.
 *
 * Read-only. Install/rollback via the programmatic API (services/modelRegistry.ts).
 *
 * Reachable from: Settings tile on the Home tab.
 */

import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import {
  listModules,
  type ModelDescriptor,
  type ModelStatus,
  type ModelRuntime,
} from '@/services/modelRegistry';

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ModelStatus, { label: string; color: string; icon: string }> = {
  simulated:     { label: 'SIMULATED',      color: theme.statusYellow, icon: 'science' },
  validated:     { label: 'VALIDATED',      color: theme.statusGreen,  icon: 'verified' },
  investigational:{ label: 'INVESTIGATIONAL', color: theme.textMuted,  icon: 'biotech' },
};

const RUNTIME_CONFIG: Record<ModelRuntime, { label: string; color: string; icon: string }> = {
  simulated: { label: 'Simulated runtime',     color: theme.statusYellow, icon: 'memory' },
  tflite:    { label: 'TFLite (not yet built)', color: theme.textMuted,   icon: 'developer-board' },
};

function StatusChip({ status }: { status: ModelStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <View style={[chipStyles.chip, { borderColor: c.color + '55', backgroundColor: c.color + '18' }]}>
      <MaterialIcons name={c.icon as any} size={11} color={c.color} />
      <Text style={[chipStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  text: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});

// ── Input/Output field summary ─────────────────────────────────────────────────

function InputSummary({ descriptor }: { descriptor: ModelDescriptor }) {
  const { input } = descriptor;
  const parts: string[] = [input.kind.toUpperCase()];
  if (input.sampleRateHz)  parts.push(`${input.sampleRateHz / 1000} kHz`);
  if (input.durationSec)   parts.push(`${input.durationSec}s`);
  if (input.channels)      parts.push(`${input.channels}ch`);
  if (input.shape)         parts.push(`[${input.shape.join('×')}]`);
  return <Text style={fieldStyles.value}>{parts.join(' · ')}</Text>;
}

function OutputFieldRow({ key: k, type, unit, min, max }: { key: string; type: string; unit?: string; min?: number; max?: number }) {
  const range = (min !== undefined && max !== undefined) ? ` [${min}–${max}${unit ? ' ' + unit : ''}]` : unit ? ` (${unit})` : '';
  return (
    <View style={fieldStyles.row}>
      <MaterialIcons name="arrow-forward" size={10} color={theme.textMuted} />
      <Text style={fieldStyles.key}>{k}</Text>
      <Text style={fieldStyles.type}>{type}{range}</Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  value: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  key:  { fontSize: 11, fontWeight: '700', color: theme.textPrimary },
  type: { fontSize: 11, color: theme.textMuted },
});

// ── Module card ────────────────────────────────────────────────────────────────

function ModuleCard({ descriptor, index }: { descriptor: ModelDescriptor; index: number }) {
  const runtimeCfg = RUNTIME_CONFIG[descriptor.runtime];
  const isInvestigational = descriptor.status === 'investigational';

  return (
    <View style={[cardStyles.card, isInvestigational && cardStyles.investigationalCard]}>
      {/* Header row */}
      <View style={cardStyles.header}>
        <View style={{ flex: 1 }}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.moduleNumber}>#{index + 1}</Text>
            <Text style={cardStyles.moduleName}>{descriptor.name}</Text>
          </View>
          <Text style={cardStyles.moduleId}>{descriptor.id}</Text>
        </View>
        <View style={cardStyles.versionBadge}>
          <Text style={cardStyles.versionText}>v{descriptor.version}</Text>
        </View>
      </View>

      {/* Status row */}
      <View style={cardStyles.statusRow}>
        <StatusChip status={descriptor.status} />
        {descriptor.funded ? (
          <View style={chipStyles.chip} >
            <MaterialIcons name="attach-money" size={11} color={theme.statusGreen} />
            <Text style={[chipStyles.text, { color: theme.statusGreen }]}>FUNDED</Text>
          </View>
        ) : (
          <View style={[chipStyles.chip, { borderColor: theme.textMuted + '44', backgroundColor: theme.textMuted + '11' }]}>
            <MaterialIcons name="money-off" size={11} color={theme.textMuted} />
            <Text style={[chipStyles.text, { color: theme.textMuted }]}>NON-FUNDED</Text>
          </View>
        )}
        <View style={[chipStyles.chip, { borderColor: runtimeCfg.color + '44', backgroundColor: runtimeCfg.color + '11' }]}>
          <MaterialIcons name={runtimeCfg.icon as any} size={11} color={runtimeCfg.color} />
          <Text style={[chipStyles.text, { color: runtimeCfg.color }]}>{descriptor.runtime.toUpperCase()}</Text>
        </View>
      </View>

      {/* Investigational warning */}
      {isInvestigational && (
        <View style={cardStyles.investigationalBanner}>
          <MaterialIcons name="info-outline" size={13} color={theme.textMuted} />
          <Text style={cardStyles.investigationalText}>
            INVESTIGATIONAL — this module's output never affects the referral colour or clinical action.
            Shown as adjunct information only.
          </Text>
        </View>
      )}

      {/* Runtime note */}
      {descriptor.runtime === 'tflite' && (
        <View style={cardStyles.tfliteBanner}>
          <MaterialIcons name="warning-amber" size={13} color={theme.statusYellow} />
          <Text style={cardStyles.tfliteText}>
            TFLite runtime planned — not yet implemented. Calling run() throws NotImplementedError.
          </Text>
        </View>
      )}

      {/* Contract section */}
      <View style={cardStyles.section}>
        <Text style={cardStyles.sectionTitle}>INPUT CONTRACT</Text>
        <InputSummary descriptor={descriptor} />
      </View>

      <View style={cardStyles.section}>
        <Text style={cardStyles.sectionTitle}>OUTPUT CONTRACT</Text>
        {descriptor.output.fields.map((f) => (
          <OutputFieldRow key={f.key} {...f} />
        ))}
      </View>

      {/* Model card link */}
      {descriptor.modelCardUrl ? (
        <View style={cardStyles.section}>
          <Text style={cardStyles.sectionTitle}>EVIDENCE</Text>
          <Text style={cardStyles.modelCardUrl} numberOfLines={1}>{descriptor.modelCardUrl}</Text>
        </View>
      ) : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 12,
  },
  investigationalCard: {
    borderColor: theme.textMuted + '44',
    backgroundColor: theme.surfaceElevated,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moduleNumber: {
    fontSize: 10, fontWeight: '800', color: theme.textMuted,
    backgroundColor: theme.background, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  moduleName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  moduleId: { fontSize: 11, color: theme.textMuted, fontFamily: 'monospace', marginTop: 2 },
  versionBadge: {
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  versionText: { fontSize: 11, fontWeight: '800', color: theme.primary },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  investigationalBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.textMuted + '10', borderRadius: theme.radius.small,
    padding: 8, marginBottom: 10, borderWidth: 1, borderColor: theme.textMuted + '33',
  },
  investigationalText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  tfliteBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.statusYellow + '10', borderRadius: theme.radius.small,
    padding: 8, marginBottom: 10, borderWidth: 1, borderColor: theme.statusYellow + '33',
  },
  tfliteText: { flex: 1, fontSize: 11, color: theme.statusYellow, lineHeight: 16 },
  section: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '77' },
  sectionTitle: {
    fontSize: 9, fontWeight: '800', color: theme.textMuted, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6,
  },
  modelCardUrl: { fontSize: 10, color: theme.primary, textDecorationLine: 'underline' },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ModelsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [modules, setModules] = useState<ModelDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listModules();
    setModules(list);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const funded    = modules.filter((m) => m.funded);
  const investig  = modules.filter((m) => m.status === 'investigational');
  const simulated = modules.filter((m) => m.status === 'simulated');

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Model Registry</Text>
          <Text style={styles.navSub}>All modules — read only</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{modules.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <MaterialIcons name="hourglass-empty" size={32} color={theme.textMuted} />
          <Text style={styles.loadingText}>Loading registry…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          {/* Summary strip */}
          <View style={styles.summaryStrip}>
            {[
              { label: 'Total',          value: modules.length, color: theme.primary },
              { label: 'Funded',         value: funded.length,  color: theme.statusGreen },
              { label: 'Simulated',      value: simulated.length, color: theme.statusYellow },
              { label: 'Investigational',value: investig.length, color: theme.textMuted },
            ].map((s) => (
              <View key={s.label} style={[styles.summaryCell, { borderColor: s.color + '44' }]}>
                <Text style={[styles.summaryNum, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.summaryLabel, { color: s.color }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Privacy + referral guard note */}
          <View style={styles.infoCard}>
            <MaterialIcons name="shield" size={14} color={theme.primary} />
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '700', color: theme.textPrimary }}>Referral guard: </Text>
              Only FUNDED / VALIDATED modules affect the clinical referral colour.
              INVESTIGATIONAL modules are shown as adjunct information and never trigger a RED alert.{'\n\n'}
              <Text style={{ fontWeight: '700', color: theme.textPrimary }}>Swap guarantee: </Text>
              Any module conforming to the same input/output contract can be installed via
              modelRegistry.install() without rebuilding the app.
            </Text>
          </View>

          {/* Module cards */}
          <Text style={styles.sectionTitle}>REGISTERED MODULES</Text>
          {modules.map((m, i) => (
            <ModuleCard key={m.id} descriptor={m} index={i} />
          ))}

          {/* API reference */}
          <View style={styles.apiCard}>
            <Text style={styles.apiTitle}>API REFERENCE (services/modelRegistry.ts)</Text>
            {[
              { fn: 'listModules()',                    desc: 'Returns all registered descriptors' },
              { fn: 'getActive(moduleId)',              desc: 'Returns active descriptor for a module' },
              { fn: 'validateContract(descriptor)',     desc: 'Returns null (ok) or error string' },
              { fn: 'install(descriptor, fileUri?)',    desc: 'Validates, copies model file, activates' },
              { fn: 'rollback(moduleId)',               desc: 'Restores previous version' },
              { fn: 'run(moduleId, input)',             desc: 'Runs module → { fields, version, status, affectsReferral }' },
            ].map((row) => (
              <View key={row.fn} style={styles.apiRow}>
                <Text style={styles.apiFn}>{row.fn}</Text>
                <Text style={styles.apiDesc}>{row.desc}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
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
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  navSub:   { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  countBadge: {
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  countText: { fontSize: 14, fontWeight: '800', color: theme.primary },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: theme.textMuted },

  summaryStrip: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 12 },
  summaryCell: {
    flex: 1, alignItems: 'center', borderRadius: theme.radius.medium,
    paddingVertical: 10, borderWidth: 1, backgroundColor: theme.surface,
  },
  summaryNum:   { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.primary + '0D', borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  infoText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 18 },

  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
  },

  apiCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, padding: 14, marginTop: 4,
  },
  apiTitle: {
    fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },
  apiRow: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: theme.border + '66' },
  apiFn:  { fontSize: 11, fontWeight: '700', color: theme.textPrimary, fontFamily: 'monospace' },
  apiDesc: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
});
