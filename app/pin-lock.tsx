// MediAid — Biometric / PIN App Lock Screen
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const PIN_STORAGE_KEY = 'mediaid_app_pin_v1';
const DEFAULT_PIN = '1234';

type Mode = 'biometric' | 'pin';

const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export default function PinLockScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('biometric');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Fingerprint');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    try {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      setBiometricType(hasFace ? 'Face ID' : 'Fingerprint');
      if (hasHW && enrolled) {
        setBiometricAvailable(true);
        // Auto-trigger biometric on mount
        setTimeout(() => tryBiometric(), 400);
      } else {
        setMode('pin');
      }
    } catch {
      setMode('pin');
    }
    setChecking(false);
  };

  const tryBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MediAid',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        setMode('pin');
      }
    } catch {
      setMode('pin');
    }
  };

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key: string) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (key === '') return;
    Haptics.selectionAsync();
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      // Validate
      const stored = (await AsyncStorage.getItem(PIN_STORAGE_KEY)) ?? DEFAULT_PIN;
      if (next === stored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        shake();
        setAttempts((a) => a + 1);
        setError(attempts >= 2 ? 'Too many attempts. Try biometrics or contact supervisor.' : 'Incorrect PIN. Try again.');
        setTimeout(() => setPin(''), 500);
      }
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="health-and-safety" size={56} color={theme.primary} />
          <Text style={styles.loadingText}>Initializing secure session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <MaterialIcons name="health-and-safety" size={36} color={theme.primary} />
        </View>
        <Text style={styles.appName}>MediAid</Text>
        <Text style={styles.tagline}>UNICEF Venture Fund · Secure Clinical Tool</Text>
      </View>

      {mode === 'biometric' ? (
        <View style={styles.biometricContainer}>
          <Pressable
            style={({ pressed }) => [styles.bioBtn, pressed && { opacity: 0.8 }]}
            onPress={tryBiometric}
          >
            <MaterialIcons
              name={biometricType === 'Face ID' ? 'face' : 'fingerprint'}
              size={64}
              color={theme.primary}
            />
          </Pressable>
          <Text style={styles.bioLabel}>
            {biometricType === 'Face ID' ? 'Unlock with Face ID' : 'Unlock with Fingerprint'}
          </Text>
          <Text style={styles.bioSub}>Tap to authenticate</Text>
          <Pressable style={styles.usePinBtn} onPress={() => setMode('pin')}>
            <Text style={styles.usePinText}>Use PIN instead</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.pinContainer}>
          <Text style={styles.pinLabel}>Enter PIN</Text>
          <Text style={styles.pinHint}>Default: 1234 (Demo)</Text>

          {/* PIN dots */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length && styles.dotFilled,
                  error && styles.dotError,
                ]}
              />
            ))}
          </Animated.View>

          {error ? (
            <View style={styles.errorRow}>
              <MaterialIcons name="warning" size={14} color={theme.statusRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Numpad */}
          <View style={styles.numpad}>
            {NUMPAD.map((row, ri) => (
              <View key={ri} style={styles.numpadRow}>
                {row.map((key, ki) => (
                  <Pressable
                    key={ki}
                    style={({ pressed }) => [
                      styles.numKey,
                      key === '' && styles.numKeyEmpty,
                      key === '⌫' && styles.numKeyBack,
                      pressed && key !== '' && { backgroundColor: theme.primary + '22', borderColor: theme.primary },
                    ]}
                    onPress={() => key !== '' && handleKey(key)}
                    disabled={key === ''}
                    hitSlop={4}
                  >
                    {key === '⌫' ? (
                      <MaterialIcons name="backspace" size={22} color={theme.textSecondary} />
                    ) : (
                      <Text style={styles.numKeyText}>{key}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {biometricAvailable && (
            <Pressable style={styles.useBioBtn} onPress={() => { setMode('biometric'); setPin(''); setError(''); tryBiometric(); }}>
              <MaterialIcons name={biometricType === 'Face ID' ? 'face' : 'fingerprint'} size={18} color={theme.primary} />
              <Text style={styles.useBioText}>Use {biometricType}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Lock notice */}
      <View style={styles.footer}>
        <MaterialIcons name="lock" size={13} color={theme.textMuted} />
        <Text style={styles.footerText}>
          End-to-end encrypted · Patient data stays on-device · FHIR R4 compliant
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'space-between' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: theme.textSecondary },
  header: { alignItems: 'center', paddingTop: 40, gap: 10 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.primary + '44',
  },
  appName: { fontSize: 32, fontWeight: '900', color: theme.textPrimary, letterSpacing: 1 },
  tagline: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  biometricContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 40 },
  bioBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: theme.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.primary + '55',
    shadowColor: theme.primary, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  bioLabel: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  bioSub: { fontSize: 13, color: theme.textMuted },
  usePinBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  usePinText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  pinContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 20, width: '100%' },
  pinLabel: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  pinHint: { fontSize: 12, color: theme.textMuted },
  dotsRow: { flexDirection: 'row', gap: 20, marginVertical: 8 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border,
  },
  dotFilled: { backgroundColor: theme.primary, borderColor: theme.primary },
  dotError: { borderColor: theme.statusRed, backgroundColor: theme.statusRed + '33' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 12, color: theme.statusRed, fontWeight: '600' },
  numpad: { gap: 12, marginTop: 8, width: '100%', paddingHorizontal: 32 },
  numpadRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  numKey: {
    flex: 1, height: 64, borderRadius: theme.radius.medium,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.border,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  numKeyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  numKeyBack: { backgroundColor: theme.background },
  numKeyText: { fontSize: 24, fontWeight: '600', color: theme.textPrimary },
  useBioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  useBioText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8,
  },
  footerText: { fontSize: 11, color: theme.textMuted, textAlign: 'center', flex: 1, lineHeight: 16 },
});
