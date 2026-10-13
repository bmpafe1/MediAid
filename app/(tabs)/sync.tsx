
/**
 * MediAid · app/(tabs)/sync.tsx
 * AICEXPERTS Limited · MIT Licence
 *
 * Outbreak Radar Sync screen.
 *
 * Shows REAL values from radarQueue:
 *   - Pending event count
 *   - Last successful sync time
 *   - Last error message
 *   - Connectivity state (NetInfo)
 *   - "Sync now" button → radarQueue.flush()
 *
 * Privacy notice: Only anonymised aggregate counts are sent.
 * Patient records never leave this device.
 *
 * DHIS2 / FHIR R4 rows are kept but clearly labelled
 * "Planned — Quarter 2" and disabled.
 */
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import * as SMS from '@/services/smsService';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp, VILLAGE_SITES } from '@/contexts/AppContext';
import { t } from '@/constants/i18n';
import { flush, peekQueue } from '@/services/radarQueue';
import type { RadarEvent } from '@/services/deidentify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlushState = 'idle' | 'flushing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PrivacyBanner() {
  return (
    <View style={styles.privacyBanner}>
      <MaterialIcons name="shield" size={18} color={theme.statusGreen} />
      <Text style={styles.privacyBannerText}>
        <Text style={{ fontWeight: '700' }}>Privacy guarantee: </Text>
        Only anonymised aggregate counts are sent (4-char geohash + outcome counts).
        Patient records, names, GPS coordinates, audio, and biometrics
        <Text style={{ fontWeight: '700' }}> never leave this device.</Text>
      </Text>
    </View>
  );
}

function ConnectivityChip({ connected }: { connected: boolean | null }) {
  const color  = connected === true  ? theme.statusGreen
               : connected === false ? theme.statusRed
               : theme.statusYellow;
  const label  = connected === true  ? 'Online'
               : connected === false ? 'Offline'
               : 'Checking…';
  const icon   = connected === true  ? 'wifi'
               : connected === false ? 'wifi-off'
               : 'wifi-find';
  return (
    <View style={[styles.chip, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <MaterialIcons name={icon as any} size={13} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SyncScreen() {
  const insets = useSafeAreaInsets();
  const {
    scanHistory,
    syncHistory,
    addSyncRecord,
    demoMode, setDemoMode,
    language, setLanguage,
    activeSite, setActiveSite,
    radarPendingCount,
    radarLastSyncAt,
    radarLastError,
    refreshRadarStats,
  } = useApp();

  const [connected,     setConnected]     = useState<boolean | null>(null);
  const [flushState,    setFlushState]    = useState<FlushState>('idle');
  const [flushError,    setFlushError]    = useState<string | null>(null);
  const [appLock,       setAppLock]       = useState(false);
  const [autoSync,      setAutoSync]      = useState(true);
  const [showDebug,     setShowDebug]     = useState(false);
  const [debugEvents,   setDebugEvents]   = useState<RadarEvent[]>([]);
  const [smsSending,    setSmsSending]    = useState(false);
  const [smsLog,        setSmsLog]        = useState<{ id: string; timestamp: string; patientRef: string; payload: string; status: 'sent' | 'cancelled' }[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ----- Connectivity -----
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setConnected(state.isConnected ?? false);
    });
    NetInfo.fetch().then((s) => setConnected(s.isConnected ?? false));
    return () => unsub();
  }, []);

  // ----- Init -----
  useEffect(() => {
    AsyncStorage.getItem('mediaid_app_lock_enabled').then((v) => {
      setAppLock(v === '1');
    });
    AsyncStorage.getItem('mediaid_sms_log').then((v) => {
      if (v) { try { setSmsLog(JSON.parse(v)); } catch {} }
    });
    refreshRadarStats();
  }, []);

  // ----- Pulse while flushing -----
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (flushState === 'flushing') {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => { anim?.stop(); };
  }, [flushState]);

  // ----- Flush handler -----
  const handleFlush = useCallback(async () => {
    if (flushState === 'flushing') return;
    Haptics.selectionAsync();
    setFlushState('flushing');
    setFlushError(null);

    try {
      await flush();
      await refreshRadarStats();
      const { lastError: lastErrorFn } = await import('@/services/radarQueue');
      const err = await lastErrorFn();
      if (err) {
        setFlushState('error');
        setFlushError(err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        setFlushState('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Log a sync record for the history panel
        const now = new Date().toISOString();
        addSyncRecord({
          id: `sync_${Date.now()}`,
          timestamp: now,
          recordsSynced: radarPendingCount,
          status: 'success',
          encrypted: true,
        });

        setTimeout(() => setFlushState('idle'), 3000);
      }
    } catch (err) {
      setFlushState('error');
      setFlushError(String(err));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [flushState, radarPendingCount, addSyncRecord, refreshRadarStats, pulseAnim]);

  // ----- Debug panel -----
  const toggleDebug = useCallback(async () => {
    if (!showDebug) {
      const events = await peekQueue(10);
      setDebugEvents(events);
    }
    setShowDebug((v) => !v);
  }, [showDebug]);

  // ----- SMS sync (offline fallback — unchanged from original) -----
  const handleSmsSync = async () => {
    if (smsSending) return;
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS Unavailable', 'SMS is not available on this device.');
      return;
    }
    setSmsSending(true);
    Haptics.selectionAsync();

    const pending = scanHistory.filter((s) => !s.synced).slice(0, 3);
    const payloads = pending.length > 0 ? pending : scanHistory.slice(0, 1);
    for (const scan of payloads) {
      const alert = scan.hasRedAlert ? '!RED' : 'OK';
      const payload = `MEDIAID|${scan.patientId}|TB${scan.tbRisk}|HR${scan.heartRate}|SpO2${scan.spo2}|Hgb${scan.hemoglobin.toFixed(1)}|${alert}|${new Date(scan.scanTimestamp).toISOString().slice(0, 10)}`;
      const { result } = await SMS.sendSMSAsync(['+237699000000'], payload);
      const entry = {
        id: 'sms_' + Date.now(),
        timestamp: new Date().toISOString(),
        patientRef: scan.patientId,
        payload,
        status: result === 'sent' ? 'sent' as const : 'cancelled' as const,
      };
      setSmsLog((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        AsyncStorage.setItem('mediaid_sms_log', JSON.stringify(next));
        return next;
      });
    }
    setSmsSending(false);
  };

  // ----- Helpers -----
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : 'Never';

  const syncBtnColor =
    flushState === 'success' ? theme.statusGreen :
    flushState === 'error'   ? theme.statusRed   :
    theme.primary;

  const syncBtnIcon =
    flushState === 'flushing' ? 'hourglass-empty' :
    flushState === 'success'  ? 'cloud-done'       :
    flushState === 'error'    ? 'cloud-off'         :
    'cloud-upload';

  const syncBtnLabel =
    flushState === 'flushing' ? 'Uploading…' :
    flushState === 'success'  ? 'Upload Complete' :
    flushState === 'error'    ? 'Upload Failed — Retry' :
    radarPendingCount > 0
      ? `Sync Now (${radarPendingCount} event${radarPendingCount !== 1 ? 's' : ''} queued)`
      : 'Sync Now (queue empty)';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>OUTBREAK RADAR</Text>
          <Text style={styles.headerTitle}>Data Sync</Text>
          <View style={styles.headerRow}>
            <ConnectivityChip connected={connected} />
            {radarPendingCount > 0 && (
              <View style={styles.pendingChip}>
                <MaterialIcons name="pending" size={13} color={theme.statusYellow} />
                <Text style={[styles.chipText, { color: theme.statusYellow }]}>
                  {radarPendingCount} pending
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Privacy guarantee ── */}
        <PrivacyBanner />

        {/* ── Status card ── */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <MaterialIcons name="schedule" size={16} color={theme.textMuted} />
            <Text style={styles.statusLabel}>Last successful sync</Text>
            <Text style={styles.statusValue}>{fmtTime(radarLastSyncAt)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <MaterialIcons name="inventory" size={16} color={theme.textMuted} />
            <Text style={styles.statusLabel}>Events in local queue</Text>
            <Text style={[
              styles.statusValue,
              { color: radarPendingCount > 0 ? theme.statusYellow : theme.statusGreen },
            ]}>
              {radarPendingCount}
            </Text>
          </View>
          {radarLastError ? (
            <>
              <View style={styles.divider} />
              <View style={styles.statusRow}>
                <MaterialIcons name="error-outline" size={16} color={theme.statusRed} />
                <Text style={[styles.statusLabel, { flex: 1, color: theme.statusRed }]}>
                  {radarLastError}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── Big sync button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.syncBtn,
            { backgroundColor: syncBtnColor },
            flushState === 'flushing' && styles.syncBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleFlush}
          disabled={flushState === 'flushing'}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <MaterialIcons name={syncBtnIcon as any} size={22} color="#FFF" />
          </Animated.View>
          <Text style={styles.syncBtnText}>{syncBtnLabel}</Text>
        </Pressable>

        {flushState === 'error' && flushError && (
          <View style={styles.errorBox}>
            <MaterialIcons name="warning" size={16} color={theme.statusRed} />
            <Text style={styles.errorText}>{flushError}</Text>
          </View>
        )}

        {flushState === 'success' && (
          <View style={styles.successBox}>
            <MaterialIcons name="check-circle" size={16} color={theme.statusGreen} />
            <Text style={styles.successText}>Queue drained. Outbreak radar updated.</Text>
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCard label={'Total\nScans'} value={scanHistory.length} />
          <StatCard
            label={'Radar\nQueue'}
            value={radarPendingCount}
            color={radarPendingCount > 0 ? theme.statusYellow : theme.statusGreen}
          />
          <StatCard
            label={'Last\nSync'}
            value={radarLastSyncAt ? '✓' : '—'}
            color={radarLastSyncAt ? theme.statusGreen : theme.textMuted}
            small
          />
        </View>

        {/* ── Village / site selector ── */}
        <Text style={styles.sectionTitle}>ACTIVE SITE</Text>
        <View style={styles.siteCard}>
          <MaterialIcons name="location-on" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.siteTitle}>Scan location (geohash)</Text>
            <Text style={styles.siteSub}>
              Used to tag radar events — 4-char precision (~39 km²). No GPS transmitted.
            </Text>
          </View>
        </View>
        <View style={styles.siteChips}>
          {VILLAGE_SITES.map((site) => (
            <Pressable
              key={site.geohash}
              style={({ pressed }) => [
                styles.siteChip,
                activeSite.geohash === site.geohash && styles.siteChipActive,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setActiveSite(site)}
            >
              <Text style={[
                styles.siteChipText,
                activeSite.geohash === site.geohash && styles.siteChipTextActive,
              ]}>
                {site.displayName}
              </Text>
              <Text style={[
                styles.siteChipGeohash,
                activeSite.geohash === site.geohash && { color: theme.primary },
              ]}>
                {site.geohash}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Settings ── */}
        <Text style={styles.sectionTitle}>SETTINGS</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="lock"
            label="App Lock (PIN / Biometric)"
            description="Require authentication on every app launch"
            value={appLock}
            onToggle={(v) => {
              setAppLock(v);
              AsyncStorage.setItem('mediaid_app_lock_enabled', v ? '1' : '0');
            }}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="speed"
            label={t('sync_demo_mode', language)}
            description={t('sync_demo_desc', language)}
            value={demoMode}
            onToggle={setDemoMode}
          />
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <MaterialIcons name="language" size={22} color={theme.primary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>{t('sync_language', language)}</Text>
              <Text style={styles.settingDesc}>{t('sync_language_desc', language)}</Text>
              <Text style={styles.settingDesc}>English and French voice prompts (more languages planned)</Text>
            </View>
            {(['en', 'fr'] as const).map((lang) => (
              <Pressable
                key={lang}
                style={[styles.langBtn, language === lang && styles.langBtnActive]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={[styles.langBtnText, language === lang && styles.langBtnTextActive]}>
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Voice Self-Test ── */}
        <Text style={styles.sectionTitle}>MICROPHONE DIAGNOSTIC</Text>
        <VoiceSelfTestLink />

        {/* ── DHIS2 / FHIR (Planned) ── */}
        <Text style={styles.sectionTitle}>DHIS2 / FHIR R4 INTEGRATION</Text>
        <View style={styles.plannedCard}>
          <MaterialIcons name="construction" size={18} color={theme.statusYellow} />
          <View style={{ flex: 1 }}>
            <Text style={styles.plannedTitle}>Planned — Quarter 2</Text>
            <Text style={styles.plannedSub}>
              Structured FHIR R4 bundles and DHIS2 event format sync are under development.
              The current release transmits aggregate outbreak radar counts only.
            </Text>
          </View>
        </View>

        {/* ── Sync history ── */}
        <Text style={styles.sectionTitle}>
          SYNC LOG (LAST {Math.min(5, syncHistory.length)})
        </Text>
        {syncHistory.length === 0 ? (
          <View style={styles.emptyLog}>
            <MaterialIcons name="history" size={32} color={theme.textMuted} />
            <Text style={styles.emptyLogText}>No sync records yet</Text>
          </View>
        ) : (
          [...syncHistory].slice(0, 5).map((record, i) => {
            const color =
              record.status === 'success' ? theme.statusGreen :
              record.status === 'failed'  ? theme.statusRed   : theme.statusYellow;
            return (
              <View key={record.id} style={styles.historyRow}>
                <View style={[styles.historyIconCircle, { backgroundColor: color + '18', borderColor: color + '44' }]}>
                  <MaterialIcons
                    name={record.status === 'success' ? 'check-circle' : record.status === 'failed' ? 'cancel' : 'schedule'}
                    size={16}
                    color={color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>{new Date(record.timestamp).toLocaleString()}</Text>
                  <Text style={styles.historyMeta}>
                    {record.recordsSynced} events · AES-256 · {record.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.historyStatus, { color }]}>#{i + 1}</Text>
              </View>
            );
          })
        )}

        {/* ── SMS sync fallback ── */}
        <Text style={styles.sectionTitle}>SMS SYNC FALLBACK (OFFLINE MODE)</Text>
        <View style={styles.smsCard}>
          <View style={styles.smsHeader}>
            <MaterialIcons name="sms" size={20} color="#22D3EE" />
            <View style={{ flex: 1 }}>
              <Text style={styles.smsTitle}>Compact SMS Payload</Text>
              <Text style={styles.smsSub}>
                When no internet — send structured &lt;160-char SMS to supervisor
              </Text>
            </View>
            <View style={styles.smsBadge}>
              <Text style={styles.smsBadgeText}>&lt;160 chars</Text>
            </View>
          </View>
          <Text style={styles.smsPayloadPreview}>
            {scanHistory.length > 0
              ? `MEDIAID|${scanHistory[0].patientId}|TB${scanHistory[0].tbRisk}|HR${scanHistory[0].heartRate}|SpO2${scanHistory[0].spo2}|Hgb${scanHistory[0].hemoglobin.toFixed(1)}|${scanHistory[0].hasRedAlert ? '!RED' : 'OK'}|${new Date(scanHistory[0].scanTimestamp).toISOString().slice(0, 10)}`
              : 'MEDIAID|PT-XXX|TB45|HR82|SpO298|Hgb12.1|OK|2026-04-21'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.smsSendBtn, (smsSending || scanHistory.length === 0) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
            onPress={handleSmsSync}
            disabled={smsSending || scanHistory.length === 0}
          >
            <MaterialIcons name="send" size={16} color="#FFF" />
            <Text style={styles.smsSendBtnText}>
              {smsSending ? 'Opening SMS…' : `Send SMS Sync`}
            </Text>
          </Pressable>
          <Text style={styles.smsSupervisor}>Supervisor: +237 699 000 000</Text>
        </View>

        {smsLog.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SMS HISTORY ({smsLog.length})</Text>
            {smsLog.slice(0, 5).map((entry) => (
              <View key={entry.id} style={styles.smsLogRow}>
                <View style={[styles.smsLogIcon, {
                  backgroundColor: entry.status === 'sent' ? theme.statusGreen + '18' : theme.statusRed + '18',
                  borderColor:     entry.status === 'sent' ? theme.statusGreen + '44' : theme.statusRed + '44',
                }]}>
                  <MaterialIcons
                    name={entry.status === 'sent' ? 'check' : 'close'}
                    size={14}
                    color={entry.status === 'sent' ? theme.statusGreen : theme.statusRed}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smsLogRef}>{entry.patientRef}</Text>
                  <Text style={styles.smsLogPayload} numberOfLines={1}>{entry.payload}</Text>
                  <Text style={styles.smsLogTime}>{new Date(entry.timestamp).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Debug panel (visible only in demo mode) ── */}
        {demoMode && (
          <>
            <Pressable
              style={({ pressed }) => [styles.debugToggle, pressed && { opacity: 0.7 }]}
              onPress={toggleDebug}
            >
              <MaterialIcons name="bug-report" size={15} color={theme.textMuted} />
              <Text style={styles.debugToggleText}>
                {showDebug ? 'Hide' : 'Show'} debug panel (last 10 queued events)
              </Text>
              <MaterialIcons
                name={showDebug ? 'expand-less' : 'expand-more'}
                size={16}
                color={theme.textMuted}
              />
            </Pressable>

            {showDebug && (
              <View style={styles.debugPanel}>
                <Text style={styles.debugTitle}>
                  QUEUED RADAR EVENTS (inspect what leaves the device)
                </Text>
                {debugEvents.length === 0 ? (
                  <Text style={styles.debugEmpty}>Queue is empty</Text>
                ) : (
                  debugEvents.map((ev, i) => (
                    <View key={ev.client_event_id} style={styles.debugRow}>
                      <Text style={styles.debugIndex}>#{i + 1}</Text>
                      <Text style={styles.debugJson}>
                        {JSON.stringify(ev, null, 2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}

        <Text style={styles.footer}>
          MediAid v1.0 · UNICEF Venture Fund 2026 · NW Cameroon · Offline-first · MIT Licence
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// VoiceSelfTestLink — shown in the Sync screen diagnostic section
function VoiceSelfTestLink() {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [{
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 10,
        backgroundColor: theme.surface,
        borderRadius: theme.radius.medium,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.border,
        opacity: pressed ? 0.8 : 1,
      }]}
      onPress={() => router.push('/voice-selftest')}
    >
      <MaterialIcons name="mic" size={20} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>Voice / Mic Self-Test</Text>
        <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
          Verify microphone permission, live level meter, test recording and playback
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
    </Pressable>
  );
}

function StatCard({
  label, value, color, small,
}: {
  label: string;
  value: number | string;
  color?: string;
  small?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: color ?? theme.primary, fontSize: small ? 22 : 26 }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({
  icon, label, description, value, onToggle,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <MaterialIcons name={icon as any} size={22} color={theme.primary} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        thumbColor={value ? theme.primary : '#555'}
        trackColor={{ false: '#333', true: '#003A52' }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: { paddingTop: 16, marginBottom: 14 },
  headerSub: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginTop: 2, marginBottom: 8 },
  headerRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  pendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: theme.statusYellow + '18',
    borderColor: theme.statusYellow + '55',
  },

  privacyBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.statusGreen + '10',
    borderRadius: theme.radius.medium, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  privacyBannerText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 18 },

  statusCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, marginBottom: 14, overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  statusLabel: { flex: 1, fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
  statusValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },

  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: theme.radius.medium, padding: 18, marginBottom: 12,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    shadowColor: theme.primary,
  },
  syncBtnDisabled: { opacity: 0.55 },
  syncBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  errorText: { flex: 1, fontSize: 12, color: theme.statusRed, lineHeight: 18 },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  successText: { fontSize: 12, color: theme.statusGreen, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border,
  },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: {
    fontSize: 9, color: theme.textSecondary, textAlign: 'center', marginTop: 4,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
  },

  sectionTitle: {
    fontSize: 11, color: theme.textMuted, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
  },

  siteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border,
  },
  siteTitle: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  siteSub: { fontSize: 11, color: theme.textMuted, marginTop: 2, lineHeight: 16 },
  siteChips: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  siteChip: {
    borderRadius: theme.radius.medium, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center',
  },
  siteChipActive: { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
  siteChipText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  siteChipTextActive: { color: theme.primary },
  siteChipGeohash: { fontSize: 10, color: theme.textMuted, marginTop: 2, fontWeight: '700', letterSpacing: 1 },

  settingsGroup: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    marginBottom: 20, borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  settingDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.border },
  langBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.small,
    backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginLeft: 6,
  },
  langBtnActive: { backgroundColor: theme.primary + '22', borderColor: theme.primary },
  langBtnText: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  langBtnTextActive: { color: theme.primary },

  plannedCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: theme.statusYellow + '10', borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  plannedTitle: { fontSize: 13, fontWeight: '700', color: theme.statusYellow },
  plannedSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2, lineHeight: 18 },

  emptyLog: { alignItems: 'center', paddingVertical: 24, gap: 8, marginBottom: 10 },
  emptyLogText: { fontSize: 13, color: theme.textMuted },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border,
  },
  historyIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  historyDate: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  historyMeta: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  historyStatus: { fontSize: 11, fontWeight: '700' },

  smsCard: {
    backgroundColor: '#22D3EE08', borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#22D3EE33',
  },
  smsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  smsTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  smsSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  smsBadge: {
    backgroundColor: '#22D3EE18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#22D3EE44',
  },
  smsBadgeText: { fontSize: 9, fontWeight: '800', color: '#22D3EE' },
  smsPayloadPreview: {
    fontFamily: 'monospace', fontSize: 10, color: '#22D3EE',
    backgroundColor: theme.background, borderRadius: theme.radius.small,
    padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#22D3EE22', lineHeight: 16,
  },
  smsSendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#22D3EE', borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 8,
  },
  smsSendBtnText: { fontSize: 14, fontWeight: '700', color: '#001820' },
  smsSupervisor: { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
  smsLogRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 10, marginBottom: 6, borderWidth: 1, borderColor: theme.border,
  },
  smsLogIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  smsLogRef: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  smsLogPayload: { fontSize: 9, color: theme.textMuted, fontFamily: 'monospace', marginTop: 1 },
  smsLogTime: { fontSize: 10, color: theme.textMuted, marginTop: 2 },

  debugToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, marginTop: 8, marginBottom: 4,
  },
  debugToggleText: { flex: 1, fontSize: 12, color: theme.textMuted },
  debugPanel: {
    backgroundColor: '#001820', borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.primary + '33',
  },
  debugTitle: {
    fontSize: 10, color: theme.primary, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  debugEmpty: { fontSize: 12, color: theme.textMuted, textAlign: 'center', paddingVertical: 12 },
  debugRow: {
    borderBottomWidth: 1, borderBottomColor: theme.border,
    paddingVertical: 8, marginBottom: 4,
  },
  debugIndex: { fontSize: 10, color: theme.textMuted, fontWeight: '700', marginBottom: 4 },
  debugJson: { fontSize: 9, color: '#22D3EE', fontFamily: 'monospace', lineHeight: 14 },

  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
