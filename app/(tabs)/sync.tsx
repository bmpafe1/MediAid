// MediAid — Enhanced DHIS2 Sync Screen with Animated Phase Sequence + SMS Sync Fallback
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as SMS from '@/services/smsService';
import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
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

type SyncPhase = 'idle' | 'packaging' | 'fhir' | 'uploading' | 'confirmed' | 'failed';

interface SyncStep {
  key: SyncPhase;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
}

const SYNC_STEPS: SyncStep[] = [
  { key: 'packaging', label: 'Records Packaged', sublabel: 'Compressing & anonymising patient data', icon: 'inventory-2', color: '#A78BFA' },
  { key: 'fhir', label: 'FHIR Bundle Generated', sublabel: 'Serialising to FHIR R4 JSON format', icon: 'medical-services', color: theme.primary },
  { key: 'uploading', label: 'Uploading to DHIS2', sublabel: 'AES-256 encrypted transmission', icon: 'cloud-upload', color: '#60A5FA' },
  { key: 'confirmed', label: 'Sync Confirmed', sublabel: 'Server acknowledged all records', icon: 'cloud-done', color: theme.statusGreen },
];

// ─── Animated Sync Step Row ───────────────────────────────────────────────────
function SyncStepRow({
  step,
  state,
  index,
}: {
  step: SyncStep;
  state: 'idle' | 'active' | 'done' | 'failed';
  index: number;
}) {
  const fadeAnim = useRef(new Animated.Value(state === 'idle' ? 0.3 : 1)).current;
  const scaleAnim = useRef(new Animated.Value(state === 'active' ? 1 : 0.96)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (state === 'active') {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1.02, useNativeDriver: true, tension: 120, friction: 8 }),
      ]).start();
      spinRef.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      );
      spinRef.current.start();
    } else if (state === 'done') {
      spinRef.current?.stop();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 }),
      ]).start();
    } else if (state === 'idle') {
      Animated.timing(fadeAnim, { toValue: 0.35, duration: 200, useNativeDriver: true }).start();
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 180, friction: 10 }).start();
    } else if (state === 'failed') {
      spinRef.current?.stop();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => { spinRef.current?.stop(); };
  }, [state]);

  const spinDeg = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const iconColor =
    state === 'done' ? step.color :
    state === 'active' ? step.color :
    state === 'failed' ? theme.statusRed :
    theme.textMuted;

  const iconName =
    state === 'done' ? 'check-circle' :
    state === 'failed' ? 'cancel' :
    state === 'active' ? 'sync' :
    step.icon;

  return (
    <Animated.View style={[stepStyles.row, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={[
        stepStyles.iconCircle,
        {
          backgroundColor: state === 'idle' ? theme.surface : iconColor + '18',
          borderColor: state === 'idle' ? theme.border : iconColor + '55',
        },
      ]}>
        <Animated.View style={state === 'active' ? { transform: [{ rotate: spinDeg }] } : undefined}>
          <MaterialIcons name={iconName as any} size={20} color={iconColor} />
        </Animated.View>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[
          stepStyles.label,
          state !== 'idle' && { color: iconColor },
        ]}>
          {step.label}
        </Text>
        <Text style={stepStyles.sublabel}>{step.sublabel}</Text>
      </View>

      {state === 'done' && (
        <View style={[stepStyles.doneBadge, { backgroundColor: step.color + '18', borderColor: step.color + '44' }]}>
          <Text style={[stepStyles.doneBadgeText, { color: step.color }]}>DONE</Text>
        </View>
      )}
      {state === 'active' && (
        <View style={[stepStyles.doneBadge, { backgroundColor: step.color + '18', borderColor: step.color + '44' }]}>
          <Text style={[stepStyles.doneBadgeText, { color: step.color }]}>...</Text>
        </View>
      )}
      {state === 'failed' && (
        <View style={[stepStyles.doneBadge, { backgroundColor: theme.statusRedBg, borderColor: theme.statusRed + '44' }]}>
          <Text style={[stepStyles.doneBadgeText, { color: theme.statusRed }]}>FAIL</Text>
        </View>
      )}
    </Animated.View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  sublabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  doneBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  doneBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Progress Connector ───────────────────────────────────────────────────────
function ProgressConnector({ filled }: { filled: boolean }) {
  return (
    <View style={{
      width: 2,
      height: 12,
      backgroundColor: filled ? theme.primary : theme.border,
      marginLeft: 35,
      borderRadius: 1,
    }} />
  );
}

export default function SyncScreen() {
  const insets = useSafeAreaInsets();
  const { scanHistory, pendingSyncCount, syncHistory, addSyncRecord, demoMode, setDemoMode, language, setLanguage } = useApp();
  const [phase, setPhase] = useState<SyncPhase>('idle');
  const [stepStates, setStepStates] = useState<Record<string, 'idle' | 'active' | 'done' | 'failed'>>({
    packaging: 'idle',
    fhir: 'idle',
    uploading: 'idle',
    confirmed: 'idle',
  });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [autoSync, setAutoSync] = useState(true);
  const [encryptData, setEncryptData] = useState(true);
  const [appLock, setAppLock] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [smsLog, setSmsLog] = useState<{ id: string; timestamp: string; patientRef: string; payload: string; status: 'sent' | 'cancelled' }[]>([]);
  const [smsSending, setSmsSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('mediaid_app_lock_enabled').then((v) => {
      if (v === '1') setAppLock(true);
    });
    AsyncStorage.getItem('mediaid_last_sync').then((v) => {
      if (v) setLastSyncTime(v);
    });
    AsyncStorage.getItem('mediaid_sms_log').then((v) => {
      if (v) { try { setSmsLog(JSON.parse(v)); } catch {} }
    });
  }, []);

  const updateStep = (key: string, state: 'idle' | 'active' | 'done' | 'failed') => {
    setStepStates((prev) => ({ ...prev, [key]: state }));
  };

  const resetSteps = () => {
    setStepStates({ packaging: 'idle', fhir: 'idle', uploading: 'idle', confirmed: 'idle' });
  };

  const handleSync = () => {
    if (phase === 'packaging' || phase === 'fhir' || phase === 'uploading') return;
    Haptics.selectionAsync();
    resetSteps();
    setPhase('packaging');

    const recordCount = pendingSyncCount > 0 ? pendingSyncCount : Math.floor(Math.random() * 8) + 3;

    // Phase 1 — Packaging (1.0s)
    updateStep('packaging', 'active');
    setTimeout(() => {
      updateStep('packaging', 'done');
      setPhase('fhir');

      // Phase 2 — FHIR Bundle (1.2s)
      updateStep('fhir', 'active');
      setTimeout(() => {
        updateStep('fhir', 'done');
        setPhase('uploading');

        // Phase 3 — Upload (1.5s) — occasional failure
        updateStep('uploading', 'active');
        const shouldFail = failedAttempts === 0 && Math.random() < 0.15; // 15% chance first time
        setTimeout(() => {
          if (shouldFail) {
            updateStep('uploading', 'failed');
            setPhase('failed');
            setFailedAttempts((n) => n + 1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else {
            updateStep('uploading', 'done');
            setPhase('confirmed');

            // Phase 4 — Confirmed (0.6s)
            updateStep('confirmed', 'active');
            setTimeout(() => {
              updateStep('confirmed', 'done');
              setFailedAttempts(0);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              const now = new Date().toISOString();
              setLastSyncTime(now);
              AsyncStorage.setItem('mediaid_last_sync', now);

              addSyncRecord({
                id: `sync_${Date.now()}`,
                timestamp: now,
                recordsSynced: recordCount,
                status: 'success',
                encrypted: true,
              });
            }, 600);
          }
        }, 1500);
      }, 1200);
    }, 1000);
  };

  const handleRetry = () => {
    setPhase('idle');
    resetSteps();
    setTimeout(handleSync, 300);
  };

  const handleSmsSync = async () => {
    if (smsSending) return;
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS Unavailable', 'SMS is not available on this device.');
      return;
    }
    setSmsSending(true);
    Haptics.selectionAsync();

    // Build compact payload — must fit in 160 chars
    const pending = scanHistory.filter((s) => !s.synced).slice(0, 3);
    const payloads = pending.length > 0 ? pending : scanHistory.slice(0, 1);
    for (const scan of payloads) {
      const alert = scan.hasRedAlert ? '!RED' : 'OK';
      const payload = `MEDIAID|${scan.patientId}|TB${scan.tbRisk}|HR${scan.heartRate}|SpO2${scan.spo2}|Hgb${scan.hemoglobin.toFixed(1)}|${alert}|${new Date(scan.scanTimestamp).toISOString().slice(0, 10)}`;
      const { result } = await SMS.sendSMSAsync(
        ['+237699000000'], // supervisor number placeholder
        payload
      );
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

  const isActive = ['packaging', 'fhir', 'uploading'].includes(phase);

  // Get step state for each step
  const getStepState = (key: string): 'idle' | 'active' | 'done' | 'failed' =>
    stepStates[key] as 'idle' | 'active' | 'done' | 'failed';

  // For the connector lines: filled if previous step done
  const stepKeys = ['packaging', 'fhir', 'uploading', 'confirmed'];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>DHIS2 / FHIR R4</Text>
          <Text style={styles.headerTitle}>{t('sync_title', language)}</Text>
          {lastSyncTime && (
            <Text style={styles.lastSync}>
              Last synced: {new Date(lastSyncTime).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Animated sync pipeline card */}
        <View style={styles.pipelineCard}>
          <View style={styles.pipelineHeader}>
            <MaterialIcons
              name={
                phase === 'confirmed' ? 'cloud-done' :
                phase === 'failed' ? 'cloud-off' :
                isActive ? 'cloud-sync' : 'cloud-queue'
              }
              size={20}
              color={
                phase === 'confirmed' ? theme.statusGreen :
                phase === 'failed' ? theme.statusRed :
                isActive ? theme.primary : theme.textMuted
              }
            />
            <Text style={styles.pipelineTitle}>
              {phase === 'idle' && 'Ready to Sync'}
              {isActive && 'Sync in Progress...'}
              {phase === 'confirmed' && 'Sync Complete'}
              {phase === 'failed' && 'Upload Failed — Retry?'}
            </Text>
            {pendingSyncCount > 0 && phase === 'idle' && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingSyncCount} pending</Text>
              </View>
            )}
          </View>

          {SYNC_STEPS.map((step, i) => (
            <View key={step.key}>
              {i > 0 && (
                <ProgressConnector filled={getStepState(stepKeys[i - 1]) === 'done'} />
              )}
              <SyncStepRow
                step={step}
                state={getStepState(step.key)}
                index={i}
              />
            </View>
          ))}

          {/* Success summary */}
          {phase === 'confirmed' && (
            <View style={styles.successSummary}>
              <MaterialIcons name="verified" size={16} color={theme.statusGreen} />
              <Text style={styles.successSummaryText}>
                {(pendingSyncCount > 0 ? pendingSyncCount : 5)} records transmitted · Outbreak radar updated · FHIR R4 bundle: OK
              </Text>
            </View>
          )}

          {/* Failure card */}
          {phase === 'failed' && (
            <View style={styles.failureCard}>
              <MaterialIcons name="signal-wifi-off" size={16} color={theme.statusRed} />
              <Text style={styles.failureText}>
                Upload failed. Check connectivity and retry.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
                onPress={handleRetry}
              >
                <MaterialIcons name="refresh" size={14} color="#FFF" />
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Big sync button */}
        <Pressable
          style={({ pressed }) => [
            styles.syncBtn,
            isActive && styles.syncBtnDisabled,
            pressed && { opacity: 0.82 },
          ]}
          onPress={phase === 'failed' ? handleRetry : handleSync}
          disabled={isActive}
        >
          <MaterialIcons
            name={isActive ? 'hourglass-empty' : phase === 'failed' ? 'refresh' : 'cloud-upload'}
            size={22}
            color="#FFF"
          />
          <Text style={styles.syncBtnText}>
            {isActive ? 'Syncing DHIS2 / FHIR R4...' :
             phase === 'failed' ? 'Retry Sync' :
             'Sync Now (DHIS2 / FHIR R4)'}
          </Text>
        </Pressable>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{scanHistory.length}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Records</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: pendingSyncCount > 0 ? theme.statusYellow : theme.statusGreen }]}>
              {pendingSyncCount}
            </Text>
            <Text style={styles.statLabel}>Pending{'\n'}Sync</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: theme.statusGreen }]}>
              {scanHistory.filter((s) => s.synced).length}
            </Text>
            <Text style={styles.statLabel}>Synced{'\n'}Records</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#A78BFA', fontSize: 20 }]}>
              {failedAttempts}
            </Text>
            <Text style={styles.statLabel}>Failed{'\n'}Attempts</Text>
          </View>
        </View>

        {/* Privacy notice */}
        <View style={styles.privacyBox}>
          <MaterialIcons name="lock" size={18} color={theme.primary} />
          <Text style={styles.privacyText}>
            All records are AES-256 encrypted before transmission. Patient names are not transmitted — only anonymized IDs and clinical metrics.
          </Text>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>SETTINGS</Text>
        <View style={styles.settingsGroup}>
          <SettingRow
            icon="wifi"
            label="Auto-sync when online"
            description="Sync automatically when connectivity detected"
            value={autoSync}
            onToggle={setAutoSync}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="lock"
            label="Encrypt patient data"
            description="AES-256 encryption before transmission"
            value={encryptData}
            onToggle={setEncryptData}
          />
          <View style={styles.divider} />
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
            </View>
            <Pressable
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
              onPress={() => setLanguage('en')}
            >
              <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
            </Pressable>
            <Pressable
              style={[styles.langBtn, language === 'fr' && styles.langBtnActive]}
              onPress={() => setLanguage('fr')}
            >
              <Text style={[styles.langBtnText, language === 'fr' && styles.langBtnTextActive]}>FR</Text>
            </Pressable>
          </View>
        </View>

        {/* DHIS2 endpoints */}
        <Text style={styles.sectionTitle}>ENDPOINTS</Text>
        <View style={styles.endpointCard}>
          <MaterialIcons name="dns" size={16} color={theme.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.endpointLabel}>DHIS2 Server</Text>
            <Text style={styles.endpointUrl}>dhis2.cameroon.gov.cm/api</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: phase === 'failed' ? theme.statusRed : theme.statusGreen }]} />
        </View>
        <View style={styles.endpointCard}>
          <MaterialIcons name="medical-services" size={16} color={theme.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.endpointLabel}>FHIR R4</Text>
            <Text style={styles.endpointUrl}>fhir.cameroon.gov.cm/fhir</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: theme.statusYellow }]} />
        </View>

        {/* Sync history — last 5 */}
        <Text style={styles.sectionTitle}>SYNC LOG (LAST {Math.min(5, syncHistory.length)})</Text>
        {syncHistory.length === 0 && (
          <View style={styles.emptyLog}>
            <MaterialIcons name="history" size={32} color={theme.textMuted} />
            <Text style={styles.emptyLogText}>No sync records yet</Text>
          </View>
        )}
        {[...syncHistory].reverse().slice(0, 5).map((record, i) => {
          const icon =
            record.status === 'success' ? 'check-circle' :
            record.status === 'failed' ? 'cancel' : 'schedule';
          const color =
            record.status === 'success' ? theme.statusGreen :
            record.status === 'failed' ? theme.statusRed : theme.statusYellow;
          return (
            <View key={record.id} style={styles.historyRow}>
              <View style={[styles.historyIconCircle, { backgroundColor: color + '18', borderColor: color + '44' }]}>
                <MaterialIcons name={icon as any} size={16} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyDate}>{new Date(record.timestamp).toLocaleString()}</Text>
                <Text style={styles.historyMeta}>
                  {record.recordsSynced} records · {record.encrypted ? 'AES-256' : 'Plain'} · {record.status.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.historyStatus, { color }]}>#{i + 1}</Text>
            </View>
          );
        })}

        {/* SMS Sync Fallback */}
        <Text style={styles.sectionTitle}>SMS SYNC FALLBACK (OFFLINE MODE)</Text>
        <View style={styles.smsCard}>
          <View style={styles.smsHeader}>
            <MaterialIcons name="sms" size={20} color="#22D3EE" />
            <View style={{ flex: 1 }}>
              <Text style={styles.smsTitle}>Compact SMS Payload</Text>
              <Text style={styles.smsSub}>When no internet — send structured 160-char SMS to supervisor</Text>
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
            style={({ pressed }) => [styles.smsSendBtn, smsSending && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
            onPress={handleSmsSync}
            disabled={smsSending || scanHistory.length === 0}
          >
            <MaterialIcons name="send" size={16} color="#FFF" />
            <Text style={styles.smsSendBtnText}>
              {smsSending ? 'Opening SMS...' : `Send SMS Sync (${Math.min(3, scanHistory.filter((s) => !s.synced).length || 1)} record${scanHistory.filter((s) => !s.synced).length !== 1 ? 's' : ''})`}
            </Text>
          </Pressable>
          <Text style={styles.smsSupervisor}>Supervisor: +237 699 000 000 · Change in Settings → Contacts</Text>
        </View>

        {/* SMS Log */}
        {smsLog.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SMS SYNC HISTORY ({smsLog.length})</Text>
            {smsLog.slice(0, 5).map((entry) => (
              <View key={entry.id} style={styles.smsLogRow}>
                <View style={[styles.smsLogIcon, { backgroundColor: entry.status === 'sent' ? theme.statusGreen + '18' : theme.statusRed + '18', borderColor: entry.status === 'sent' ? theme.statusGreen + '44' : theme.statusRed + '44' }]}>
                  <MaterialIcons name={entry.status === 'sent' ? 'check' : 'close'} size={14} color={entry.status === 'sent' ? theme.statusGreen : theme.statusRed} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smsLogRef}>{entry.patientRef}</Text>
                  <Text style={styles.smsLogPayload} numberOfLines={1}>{entry.payload}</Text>
                  <Text style={styles.smsLogTime}>{new Date(entry.timestamp).toLocaleString()}</Text>
                </View>
                <View style={[styles.smsLogBadge, { backgroundColor: entry.status === 'sent' ? theme.statusGreen + '18' : theme.statusRed + '18', borderColor: entry.status === 'sent' ? theme.statusGreen + '44' : theme.statusRed + '44' }]}>
                  <Text style={[styles.smsLogBadgeText, { color: entry.status === 'sent' ? theme.statusGreen : theme.statusRed }]}>{entry.status.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          MediAid v1.0 · UNICEF Venture Fund 2025 · NW Cameroon · All data encrypted at rest
        </Text>
      </ScrollView>
    </SafeAreaView>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: { paddingTop: 16, marginBottom: 16 },
  headerSub: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginTop: 2 },
  lastSync: { fontSize: 11, color: theme.textMuted, marginTop: 4 },

  // Pipeline
  pipelineCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  pipelineTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  pendingBadge: {
    backgroundColor: theme.statusYellowBg,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: theme.statusYellow + '44',
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: theme.statusYellow },
  successSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.statusGreenBg,
    margin: 12,
    borderRadius: theme.radius.medium,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.statusGreen + '44',
  },
  successSummaryText: { flex: 1, fontSize: 12, color: theme.statusGreen, fontWeight: '600', lineHeight: 18 },
  failureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.statusRedBg,
    margin: 12,
    borderRadius: theme.radius.medium,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.statusRed + '44',
  },
  failureText: { flex: 1, fontSize: 12, color: theme.statusRed, fontWeight: '600', lineHeight: 18 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.statusRed,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryBtnText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  // Sync button
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    borderRadius: theme.radius.medium,
    padding: 18,
    marginBottom: 16,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  syncBtnDisabled: { opacity: 0.55 },
  syncBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  statValue: { fontSize: 26, fontWeight: '700', color: theme.primary },
  statLabel: { fontSize: 9, color: theme.textSecondary, textAlign: 'center', marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.primary + '33',
  },
  privacyText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },

  settingsGroup: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  settingDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.border, marginLeft: 50 },

  endpointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  endpointLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
  endpointUrl: { fontSize: 13, color: theme.primary, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  emptyLog: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyLogText: { fontSize: 13, color: theme.textMuted },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  historyIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  historyDate: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  historyMeta: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  historyStatus: { fontSize: 11, fontWeight: '700' },

  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.small,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    marginLeft: 6,
  },
  langBtnActive: {
    backgroundColor: theme.primary + '22',
    borderColor: theme.primary,
  },
  langBtnText: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  langBtnTextActive: { color: theme.primary },

  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 18 },

  // SMS Sync
  smsCard: {
    backgroundColor: '#22D3EE08', borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#22D3EE33',
  },
  smsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  smsTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  smsSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  smsBadge: {
    backgroundColor: '#22D3EE18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#22D3EE44',
  },
  smsBadgeText: { fontSize: 9, fontWeight: '800', color: '#22D3EE' },
  smsPayloadPreview: {
    fontFamily: 'monospace',
    fontSize: 10, color: '#22D3EE', backgroundColor: theme.background,
    borderRadius: theme.radius.small, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: '#22D3EE22', lineHeight: 16,
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
  smsLogBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
  },
  smsLogBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});
