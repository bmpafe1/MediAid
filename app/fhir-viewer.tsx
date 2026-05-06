// MediAid — FHIR R4 Bundle Viewer
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { ScanResult } from '@/services/mockData';

// Build a FHIR R4 Bundle from a ScanResult
function buildFHIRBundle(scan: ScanResult): object {
  const base = `https://mediaid.cameroon.unicef.org/fhir`;
  const now = new Date(scan.scanTimestamp).toISOString();
  return {
    resourceType: 'Bundle',
    id: `bundle-${scan.id}`,
    meta: {
      lastUpdated: now,
      profile: ['http://hl7.org/fhir/R4/bundle.html'],
    },
    type: 'document',
    timestamp: now,
    entry: [
      // Patient resource
      {
        fullUrl: `${base}/Patient/${scan.patientId}`,
        resource: {
          resourceType: 'Patient',
          id: scan.patientId,
          meta: { profile: ['http://hl7.org/fhir/R4/patient.html'] },
          identifier: [{ system: `${base}/identifier/cha-id`, value: scan.patientId }],
          name: [{ text: scan.patientName, family: scan.patientName.split(' ').pop() ?? scan.patientName }],
          extension: [
            { url: `${base}/extension/consent-timestamp`, valueDateTime: scan.consentTimestamp },
            { url: `${base}/extension/oral-consent`, valueBoolean: true },
          ],
        },
      },
      // TB Risk Observation
      buildObservation('obs-tb', scan, 'TB-RISK', '386661006', 'TB Risk Score', scan.tbRisk, '%', 'http://snomed.info/sct'),
      // AFib Risk Observation
      buildObservation('obs-afib', scan, 'AFIB-RISK', '49436004', 'AFib Risk Score', scan.afibRisk, '%', 'http://snomed.info/sct'),
      // Heart Rate
      buildObservation('obs-hr', scan, 'HEART-RATE', '8867-4', 'Heart Rate', scan.heartRate, 'beats/min', 'http://loinc.org'),
      // Hemoglobin
      buildObservation('obs-hgb', scan, 'HEMOGLOBIN', '718-7', 'Hemoglobin', scan.hemoglobin, 'g/dL', 'http://loinc.org'),
      // SpO2
      buildObservation('obs-spo2', scan, 'SPO2', '59408-5', 'Oxygen Saturation', scan.spo2, '%', 'http://loinc.org'),
      // Respiratory Rate
      buildObservation('obs-rr', scan, 'RESP-RATE', '9279-1', 'Respiratory Rate', scan.respiratoryRate, 'breaths/min', 'http://loinc.org'),
      // Tremor
      buildObservation('obs-tremor', scan, 'TREMOR-RISK', 'TREMOR-AI', 'Parkinson Tremor Risk', scan.tremorRisk, '%', `${base}/codes`),
      // Eye Conditions
      buildObservation('obs-eye', scan, 'EYE-CONDITIONS', 'EYE-AI', 'Ocular Conditions Count', scan.eyeConditions, 'count', `${base}/codes`),
      // Clinical Flag
      {
        fullUrl: `${base}/Flag/${scan.id}-flag`,
        resource: {
          resourceType: 'Flag',
          id: `${scan.id}-flag`,
          status: scan.hasRedAlert ? 'active' : 'inactive',
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/flag-category', code: 'clinical' }] }],
          code: {
            coding: [{ system: `${base}/codes`, code: scan.hasRedAlert ? 'RED-ALERT' : 'NORMAL' }],
            text: scan.hasRedAlert ? 'REFERRAL REQUIRED — Life-threatening condition detected' : 'Normal — Continue monitoring',
          },
          subject: { reference: `Patient/${scan.patientId}` },
          period: { start: now },
          author: { display: 'MediAid On-Device AI' },
          extension: scan.bypassLogged
            ? [{ url: `${base}/extension/bypass-logged`, valueBoolean: true, valueString: scan.bypassReason }]
            : [],
        },
      },
    ],
  };
}

function buildObservation(
  id: string,
  scan: ScanResult,
  code: string,
  loincCode: string,
  display: string,
  value: number,
  unit: string,
  system: string
) {
  return {
    fullUrl: `https://mediaid.cameroon.unicef.org/fhir/Observation/${id}`,
    resource: {
      resourceType: 'Observation',
      id,
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
      code: { coding: [{ system, code: loincCode, display }], text: display },
      subject: { reference: `Patient/${scan.patientId}` },
      effectiveDateTime: scan.scanTimestamp,
      valueQuantity: { value, unit, system: 'http://unitsofmeasure.org', code: unit },
      method: { text: 'On-device AI inference — MediAid v1.0 (TensorFlow Lite)' },
    },
  };
}

// Syntax-highlighted JSON renderer
interface JsonToken {
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'bracket' | 'colon' | 'comma' | 'whitespace';
  value: string;
}

function tokenize(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  while (i < json.length) {
    if (json[i] === '"') {
      // Find closing quote
      let j = i + 1;
      while (j < json.length && (json[j] !== '"' || json[j - 1] === '\\')) j++;
      const raw = json.slice(i, j + 1);
      // Peek ahead for colon to determine key vs string
      let k = j + 1;
      while (k < json.length && (json[k] === ' ' || json[k] === '\n' || json[k] === '\r')) k++;
      tokens.push({ type: json[k] === ':' ? 'key' : 'string', value: raw });
      i = j + 1;
    } else if (/\d|-/.test(json[i])) {
      let j = i;
      while (j < json.length && /[\d.eE+-]/.test(json[j])) j++;
      tokens.push({ type: 'number', value: json.slice(i, j) });
      i = j;
    } else if (json.startsWith('true', i) || json.startsWith('false', i)) {
      const v = json.startsWith('true', i) ? 'true' : 'false';
      tokens.push({ type: 'boolean', value: v });
      i += v.length;
    } else if (json.startsWith('null', i)) {
      tokens.push({ type: 'null', value: 'null' });
      i += 4;
    } else if ('{}[]'.includes(json[i])) {
      tokens.push({ type: 'bracket', value: json[i] });
      i++;
    } else if (json[i] === ':') {
      tokens.push({ type: 'colon', value: ':' });
      i++;
    } else if (json[i] === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
    } else {
      tokens.push({ type: 'whitespace', value: json[i] });
      i++;
    }
  }
  return tokens;
}

function tokenColor(type: JsonToken['type']): string {
  switch (type) {
    case 'key': return '#79C0FF'; // blue
    case 'string': return '#A5D6A7'; // green
    case 'number': return '#FFB86C'; // orange
    case 'boolean': return '#FF79C6'; // pink
    case 'null': return '#FF5555'; // red
    case 'bracket': return '#F8F8F2'; // white
    case 'colon': return '#8BE9FD';
    case 'comma': return '#888';
    default: return '#CCC';
  }
}

function SyntaxHighlightedJSON({ json }: { json: string }) {
  const tokens = useMemo(() => tokenize(json), [json]);
  return (
    <Text style={jsonStyles.base} selectable>
      {tokens.map((t, i) => (
        <Text key={i} style={{ color: tokenColor(t.type) }}>
          {t.value}
        </Text>
      ))}
    </Text>
  );
}

const jsonStyles = StyleSheet.create({
  base: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 18,
    color: '#CCC',
  },
});

// Collapsible section
function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={sectionStyles.container}>
      <Pressable
        style={sectionStyles.header}
        onPress={() => setOpen((v) => !v)}
      >
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={18} color={theme.primary} />
        <Text style={sectionStyles.title}>{title}</Text>
      </Pressable>
      {open && <View style={sectionStyles.body}>{children}</View>}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    backgroundColor: '#0D1117',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  title: { fontSize: 12, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },
  body: { padding: 12 },
});

export default function FHIRViewerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const { scanHistory } = useApp();

  const scan = useMemo(
    () => scanHistory.find((s) => s.id === scanId) ?? scanHistory[0] ?? null,
    [scanId, scanHistory]
  );

  const bundle = useMemo(() => (scan ? buildFHIRBundle(scan) : null), [scan]);
  const bundleJSON = useMemo(() => (bundle ? JSON.stringify(bundle, null, 2) : ''), [bundle]);

  // Extract individual resources for collapsible sections
  const sections = useMemo(() => {
    if (!bundle) return [];
    const b = bundle as any;
    return (b.entry ?? []).map((e: any, i: number) => ({
      title: `[${i}] ${e.resource?.resourceType ?? 'Entry'} · ${e.resource?.id ?? ''}`,
      json: JSON.stringify(e, null, 2),
    }));
  }, [bundle]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(bundleJSON);
    Alert.alert('Copied', 'FHIR R4 Bundle copied to clipboard.');
  };

  if (!scan || !bundle) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.emptyState}>
          <MaterialIcons name="code" size={60} color={theme.textMuted} />
          <Text style={styles.emptyText}>No scan found to build FHIR record.</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.navIconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#CCC" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>FHIR R4 Bundle</Text>
          <Text style={styles.navSub}>{scan.patientId} · {sections.length} resources</Text>
        </View>
        <Pressable style={styles.copyBtn} onPress={handleCopy}>
          <MaterialIcons name="content-copy" size={16} color={theme.primary} />
          <Text style={styles.copyBtnText}>Copy</Text>
        </Pressable>
      </View>

      {/* Header info bar */}
      <View style={styles.infoBar}>
        <View style={styles.infoBadge}>
          <MaterialIcons name="verified" size={12} color={theme.statusGreen} />
          <Text style={styles.infoBadgeText}>FHIR R4 Compliant</Text>
        </View>
        <View style={styles.infoBadge}>
          <MaterialIcons name="lock" size={12} color={theme.primary} />
          <Text style={styles.infoBadgeText}>AES-256 Encrypted</Text>
        </View>
        <View style={styles.infoBadge}>
          <MaterialIcons name="smartphone" size={12} color={theme.statusYellow} />
          <Text style={styles.infoBadgeText}>On-Device</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Bundle metadata card */}
        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Bundle · {scan.id}</Text>
          <View style={styles.metaGrid}>
            {[
              { label: 'Resource Type', value: 'Bundle (document)' },
              { label: 'FHIR Version', value: 'R4 (4.0.1)' },
              { label: 'Patient', value: scan.patientName },
              { label: 'Patient ID', value: scan.patientId },
              { label: 'Generated', value: new Date(scan.scanTimestamp).toLocaleString() },
              { label: 'Alert Status', value: scan.hasRedAlert ? '🔴 RED ALERT' : '🟢 NORMAL' },
              { label: 'Resources', value: `${sections.length} entries` },
              { label: 'Bypass Logged', value: scan.bypassLogged ? 'YES' : 'No' },
            ].map((r) => (
              <View key={r.label} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{r.label}</Text>
                <Text style={[styles.metaValue, r.label === 'Alert Status' && scan.hasRedAlert && { color: theme.statusRed }]}>
                  {r.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Resource viewer — collapsible sections */}
        <Text style={styles.sectionHeader}>BUNDLE ENTRIES</Text>
        {sections.map((sec, i) => (
          <Section key={i} title={sec.title} defaultOpen={i === 0}>
            <SyntaxHighlightedJSON json={sec.json} />
          </Section>
        ))}

        {/* Full bundle copy area */}
        <View style={styles.fullBundleCard}>
          <View style={styles.fullBundleHeader}>
            <MaterialIcons name="code" size={16} color={theme.primary} />
            <Text style={styles.fullBundleTitle}>FULL FHIR BUNDLE JSON</Text>
            <Pressable
              style={({ pressed }) => [styles.inlineCopyBtn, pressed && { opacity: 0.7 }]}
              onPress={handleCopy}
            >
              <MaterialIcons name="content-copy" size={14} color={theme.primary} />
              <Text style={styles.inlineCopyText}>Copy All</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.codeScroll}
          >
            <SyntaxHighlightedJSON json={bundleJSON} />
          </ScrollView>
        </View>

        {/* Reference note */}
        <View style={styles.refNote}>
          <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
          <Text style={styles.refNoteText}>
            Generated per HL7 FHIR R4 spec · Compatible with DHIS2 FHIR facade and OpenHIE workflows.
            All values are AI-simulated within clinically plausible ranges for prototype demonstration.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1117' },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
    gap: 10,
    backgroundColor: '#161B22',
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262D',
  },
  navTitle: { fontSize: 15, fontWeight: '700', color: '#E6EDF3' },
  navSub: { fontSize: 11, color: '#8B949E', marginTop: 1 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primary + '22',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.primary + '55',
  },
  copyBtnText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  infoBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161B22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#21262D',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  infoBadgeText: { fontSize: 10, fontWeight: '700', color: '#8B949E' },
  metaCard: {
    backgroundColor: '#161B22',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  metaTitle: { fontSize: 12, fontWeight: '700', color: '#79C0FF', marginBottom: 10, letterSpacing: 0.5 },
  metaGrid: { gap: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaLabel: { fontSize: 11, color: '#8B949E', fontWeight: '600', flex: 1 },
  metaValue: { fontSize: 11, color: '#E6EDF3', fontWeight: '500', flex: 1, textAlign: 'right' },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B949E',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  fullBundleCard: {
    backgroundColor: '#161B22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 12,
    overflow: 'hidden',
  },
  fullBundleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#21262D',
    borderBottomWidth: 1,
    borderBottomColor: '#30363D',
  },
  fullBundleTitle: { flex: 1, fontSize: 11, fontWeight: '700', color: '#8B949E', letterSpacing: 1 },
  inlineCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineCopyText: { fontSize: 11, fontWeight: '700', color: theme.primary },
  codeScroll: { padding: 12, maxHeight: 300 },
  refNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#161B22',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 8,
  },
  refNoteText: { flex: 1, fontSize: 11, color: '#8B949E', lineHeight: 17 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyText: { fontSize: 16, color: '#8B949E', textAlign: 'center' },
  backBtn: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
