// Powered by OnSpace.AI — Feature 2: Non-Bypassable Safety Screen
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

const BYPASS_LOCKOUT_SECONDS = 10;

export default function SafetyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentScan, updateScanInHistory } = useApp();

  const [bypassCountdown, setBypassCountdown] = useState(BYPASS_LOCKOUT_SECONDS);
  const [bypassUnlocked, setBypassUnlocked] = useState(false);
  const [bypassConfirming, setBypassConfirming] = useState(false);
  const [escorted, setEscorted] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Prevent hardware back button (non-bypassable)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Pulse animation on alert icon
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Bypass countdown
  useEffect(() => {
    if (bypassCountdown <= 0) {
      setBypassUnlocked(true);
      return;
    }
    const t = setTimeout(() => setBypassCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [bypassCountdown]);

  const handleEscort = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEscorted(true);
    if (currentScan) {
      updateScanInHistory({ ...currentScan, bypassLogged: false });
    }
    setTimeout(() => router.back(), 1800);
  };

  const handleBypassPress = () => {
    if (!bypassUnlocked) return;
    setBypassConfirming(true);
  };

  const handleBypassConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    // Mock SMS escalation (per spec — print to console)
    console.log('[SMS SENT TO SUPERVISOR] ⚠️ BYPASS TRIGGERED. Patient: ' + (currentScan?.patientName ?? 'Unknown') + ' · Timestamp: ' + new Date().toISOString() + ' · CHA did not escort patient with RED alert.');
    alert('[MOCK] SMS SENT TO SUPERVISOR:\nCHA bypassed RED alert for ' + (currentScan?.patientName ?? 'Unknown Patient'));

    if (currentScan) {
      updateScanInHistory({ ...currentScan, bypassLogged: true, bypassReason: 'CHA override' });
    }
    router.back();
  };

  const redMetrics = currentScan ? [
    currentScan.tbRisk >= 80 && `TB Risk: ${currentScan.tbRisk}% (>80% threshold)`,
    currentScan.afibRisk >= 60 && `AFib Risk: ${currentScan.afibRisk}%`,
    (currentScan.heartRate <= 40 || currentScan.heartRate >= 130) && `Heart Rate: ${currentScan.heartRate} BPM`,
    currentScan.hemoglobin <= 8 && `Hemoglobin: ${currentScan.hemoglobin} g/dL (severe anemia)`,
    currentScan.spo2 <= 90 && `SpO₂: ${currentScan.spo2}% (critical hypoxia)`,
    currentScan.respiratoryRate >= 30 && `Respiratory Rate: ${currentScan.respiratoryRate}/min`,
  ].filter(Boolean) : [];

  if (escorted) {
    return (
      <SafeAreaView style={[styles.root, styles.rootGreen]}>
        <View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={80} color={theme.statusGreen} />
          <Text style={styles.successTitle}>Escort Logged</Text>
          <Text style={styles.successSub}>
            Timestamp recorded. Safe travels with your patient.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pulsing alert icon */}
        <Animated.View style={[styles.alertIconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <Image
            source={require('@/assets/images/alert-shield.png')}
            style={styles.alertIcon}
            contentFit="contain"
          />
        </Animated.View>

        {/* Main alert text */}
        <Text style={styles.alertTitle}>LIFE-THREATENING{'\n'}CONDITION DETECTED</Text>
        <Text style={styles.alertSubtitle}>
          YOU MUST ESCORT THIS PATIENT TO THE NEAREST CLINIC IMMEDIATELY.
        </Text>

        {/* Patient & red metrics */}
        {currentScan && (
          <View style={styles.patientCard}>
            <Text style={styles.patientLabel}>PATIENT</Text>
            <Text style={styles.patientName}>{currentScan.patientName}</Text>
            <Text style={styles.patientId}>{currentScan.patientId}</Text>
            {redMetrics.length > 0 && (
              <View style={styles.redMetrics}>
                <Text style={styles.redMetricsLabel}>RED ALERTS:</Text>
                {redMetrics.map((m, i) => (
                  <View key={i} style={styles.redMetricRow}>
                    <MaterialIcons name="warning" size={14} color={theme.statusRed} />
                    <Text style={styles.redMetricText}>{m as string}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Primary CTA — ESCORT */}
        <Pressable
          style={({ pressed }) => [styles.escortBtn, pressed && { opacity: 0.9 }]}
          onPress={handleEscort}
        >
          <MaterialIcons name="directions-walk" size={32} color="#FFF" />
          <View>
            <Text style={styles.escortBtnTitle}>I AM ESCORTING THE PATIENT</Text>
            <Text style={styles.escortBtnSub}>Logs timestamp · Closes alert</Text>
          </View>
        </Pressable>

        {/* UNICEF note */}
        <View style={styles.unicefNote}>
          <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
          <Text style={styles.unicefNoteText}>
            UNICEF Requirement: This screen cannot be dismissed without action. Supervisor will be alerted on bypass.
          </Text>
        </View>

        {/* SMS Escalation */}
        <Pressable
          style={styles.smsEscalationBtn}
          onPress={() => router.push('/sms-escalation')}
        >
          <MaterialIcons name="sms" size={16} color={theme.statusYellow} />
          <Text style={styles.smsEscalationText}>Compose Supervisor SMS</Text>
          <MaterialIcons name="chevron-right" size={16} color={theme.statusYellow} />
        </Pressable>

        {/* BYPASS — locked for 10s */}
        {!bypassConfirming ? (
          <Pressable
            style={[styles.bypassBtn, !bypassUnlocked && styles.bypassBtnLocked]}
            onPress={handleBypassPress}
            disabled={!bypassUnlocked}
          >
            <MaterialIcons
              name={bypassUnlocked ? 'lock-open' : 'lock'}
              size={16}
              color={bypassUnlocked ? theme.statusRed : theme.textMuted}
            />
            <Text style={[styles.bypassBtnText, !bypassUnlocked && { color: theme.textMuted }]}>
              {bypassUnlocked ? 'BYPASS (Supervisor will be alerted)' : `BYPASS — Locked for ${bypassCountdown}s`}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.bypassConfirmBox}>
            <Text style={styles.bypassConfirmTitle}>Confirm bypass?</Text>
            <Text style={styles.bypassConfirmSub}>Supervisor will be alerted via SMS immediately.</Text>
            <View style={styles.bypassConfirmBtns}>
              <Pressable style={styles.cancelBypassBtn} onPress={() => setBypassConfirming(false)}>
                <Text style={styles.cancelBypassText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBypassBtn} onPress={handleBypassConfirm}>
                <Text style={styles.confirmBypassText}>Confirm Bypass</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A0000' },
  rootGreen: { backgroundColor: theme.statusGreenBg },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle: { fontSize: 28, fontWeight: '800', color: theme.statusGreen, marginTop: 20, textAlign: 'center' },
  successSub: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  alertIconWrapper: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  alertIcon: { width: 140, height: 140 },
  alertTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.statusRed,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  alertSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFBBBB',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  patientCard: {
    backgroundColor: theme.statusRedBg,
    borderRadius: theme.radius.large,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.statusRed + '55',
  },
  patientLabel: { fontSize: 10, color: theme.statusRed, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  patientName: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  patientId: { fontSize: 13, color: '#FFAAAA', marginTop: 2 },
  redMetrics: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.statusRed + '33' },
  redMetricsLabel: { fontSize: 10, color: theme.statusRed, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  redMetricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  redMetricText: { fontSize: 14, color: '#FFBBBB', fontWeight: '600' },
  escortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: theme.statusGreen,
    borderRadius: theme.radius.large,
    padding: 22,
    marginBottom: 16,
    shadowColor: theme.statusGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  escortBtnTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  escortBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  unicefNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  unicefNoteText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  bypassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.medium,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.statusRed + '44',
    backgroundColor: 'transparent',
  },
  bypassBtnLocked: { borderColor: theme.border, opacity: 0.6 },
  bypassBtnText: { fontSize: 13, fontWeight: '600', color: theme.statusRed },
  bypassConfirmBox: {
    backgroundColor: theme.statusRedBg,
    borderRadius: theme.radius.large,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.statusRed + '66',
  },
  bypassConfirmTitle: { fontSize: 18, fontWeight: '700', color: theme.statusRed, textAlign: 'center' },
  bypassConfirmSub: { fontSize: 13, color: '#FFAAAA', textAlign: 'center', marginTop: 8, marginBottom: 16, lineHeight: 20 },
  bypassConfirmBtns: { flexDirection: 'row', gap: 12 },
  cancelBypassBtn: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelBypassText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  confirmBypassBtn: {
    flex: 1,
    backgroundColor: theme.statusRed,
    borderRadius: theme.radius.medium,
    padding: 14,
    alignItems: 'center',
  },
  confirmBypassText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  smsEscalationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: theme.radius.medium,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.statusYellow + '55',
    backgroundColor: theme.statusYellowBg,
    marginBottom: 12,
  },
  smsEscalationText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.statusYellow },
});
