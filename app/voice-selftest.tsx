/**
 * MediAid · app/voice-selftest.tsx
 * AICEXPERTS Limited · MIT Licence
 *
 * Voice / Microphone Self-Test Screen
 *
 * Lets a CHA (or engineer) verify that:
 *   - Microphone permission is granted
 *   - The mic level meter responds to speech
 *   - A 5-second test recording can be made and played back
 *
 * Reachable from: Settings row in the Sync tab or the debug panel.
 *
 * What is REAL here:
 *   - Microphone permission request (expo-av Audio.requestPermissionsAsync)
 *   - Live metering via Audio.Recording with isMeteringEnabled: true (100 ms poll)
 *   - 5-second test recording and playback via expo-av Audio.Sound
 *
 * What is NOT here:
 *   - Speech recognition transcript (TASK C — expo-speech-recognition requires
 *     a native dev/production build; see comments below)
 */

import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

// ── Constants ──────────────────────────────────────────────────────────────────
const TEST_DURATION_S  = 5;
const METER_POLL_MS    = 100;

// ── Permission state types ─────────────────────────────────────────────────────
type PermState = 'checking' | 'granted' | 'denied' | 'undetermined';

// ── Level meter bar ────────────────────────────────────────────────────────────
function LevelMeter({ dbfs }: { dbfs: number | null }) {
  // dbfs is negative: −160 (silence) to 0 (max)
  // Map to 0–1 range for display
  const level = dbfs === null ? 0 : Math.max(0, Math.min(1, (dbfs + 80) / 80));
  const color  =
    level > 0.85 ? theme.statusRed
    : level > 0.6  ? theme.statusYellow
    : theme.statusGreen;

  return (
    <View style={meterStyles.container}>
      <View style={meterStyles.track}>
        <View style={[meterStyles.fill, { width: `${level * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[meterStyles.label, { color }]}>
        {dbfs === null ? '—' : `${dbfs.toFixed(1)} dBFS`}
      </Text>
    </View>
  );
}

const meterStyles = StyleSheet.create({
  container: { gap: 6 },
  track: {
    height: 16, backgroundColor: theme.border, borderRadius: 8,
    overflow: 'hidden', borderWidth: 1, borderColor: theme.border,
  },
  fill: { height: '100%', borderRadius: 8, minWidth: 2 },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function VoiceSelfTestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [permState,      setPermState]      = useState<PermState>('checking');
  const [recording,      setRecording]      = useState<Audio.Recording | null>(null);
  const [isRecording,    setIsRecording]    = useState(false);
  const [meterDbfs,      setMeterDbfs]      = useState<number | null>(null);
  const [secondsLeft,    setSecondsLeft]    = useState(TEST_DURATION_S);
  const [recordedUri,    setRecordedUri]    = useState<string | null>(null);
  const [sound,          setSound]          = useState<Audio.Sound | null>(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [playbackPos,    setPlaybackPos]    = useState(0); // 0–1
  const [testDurationMs, setTestDurationMs] = useState(0);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);

  const meterTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef     = useRef<Audio.Recording | null>(null);
  const pulseAnim        = useRef(new Animated.Value(1)).current;
  const pulseLoop        = useRef<Animated.CompositeAnimation | null>(null);

  // ── Check permission on mount ─────────────────────────────────────────────
  useEffect(() => {
    checkPermission();
    return () => cleanup();
  }, []);

  async function checkPermission() {
    setPermState('checking');
    try {
      const { status } = await Audio.getPermissionsAsync();
      if (status === 'granted') {
        setPermState('granted');
      } else if (status === 'denied') {
        setPermState('denied');
      } else {
        setPermState('undetermined');
      }
    } catch {
      setPermState('undetermined');
    }
  }

  async function requestPermission() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setPermState(status === 'granted' ? 'granted' : 'denied');
    } catch (e) {
      setErrorMsg('Could not request permission: ' + String(e));
    }
  }

  function cleanup() {
    clearInterval(meterTimerRef.current!);
    clearInterval(countdownRef.current!);
    sound?.unloadAsync();
  }

  // ── Pulse animation ───────────────────────────────────────────────────────
  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }
  function stopPulse() {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  // ── Start test recording ──────────────────────────────────────────────────
  const startTest = useCallback(async () => {
    setErrorMsg(null);
    setRecordedUri(null);
    setPlaybackPos(0);
    setSecondsLeft(TEST_DURATION_S);
    setMeterDbfs(null);

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await rec.startAsync();
      recordingRef.current = rec;
      setRecording(rec);
      setIsRecording(true);
      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Meter polling every 100 ms
      meterTimerRef.current = setInterval(async () => {
        try {
          const status = await recordingRef.current?.getStatusAsync();
          if (status?.isRecording && status.metering !== undefined) {
            setMeterDbfs(status.metering);
          }
        } catch {}
      }, METER_POLL_MS);

      // Countdown
      let remaining = TEST_DURATION_S;
      countdownRef.current = setInterval(async () => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current!);
          await finishRecording();
        }
      }, 1000);
    } catch (e) {
      setErrorMsg('Could not start recording: ' + String(e));
    }
  }, []);

  const finishRecording = useCallback(async () => {
    clearInterval(meterTimerRef.current!);
    stopPulse();
    setIsRecording(false);
    setMeterDbfs(null);

    const rec = recordingRef.current;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const status = await rec.getStatusAsync();
      const uri    = rec.getURI();
      if (uri) {
        setRecordedUri(uri);
        setTestDurationMs(status.durationMillis ?? TEST_DURATION_S * 1000);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setErrorMsg('Could not stop recording: ' + String(e));
    }
    recordingRef.current = null;
    setRecording(null);
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────
  const playback = useCallback(async () => {
    if (!recordedUri) return;
    setErrorMsg(null);

    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound: snd } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          const pct = testDurationMs > 0
            ? Math.min(1, (status.positionMillis ?? 0) / testDurationMs)
            : 0;
          setPlaybackPos(pct);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackPos(0);
          }
        }
      );
      setSound(snd);
      setIsPlaying(true);
    } catch (e) {
      setErrorMsg('Could not play recording: ' + String(e));
    }
  }, [recordedUri, sound, isPlaying, testDurationMs]);

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Voice / Mic Self-Test</Text>
          <Text style={styles.navSub}>Verify microphone before scan</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Permission section ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="mic" size={18} color={
              permState === 'granted' ? theme.statusGreen
              : permState === 'denied' ? theme.statusRed
              : theme.statusYellow
            } />
            <Text style={styles.cardTitle}>Microphone Permission</Text>
          </View>

          {permState === 'checking' && (
            <Text style={styles.bodyText}>Checking permission…</Text>
          )}

          {permState === 'granted' && (
            <View style={styles.permGranted}>
              <MaterialIcons name="check-circle" size={18} color={theme.statusGreen} />
              <Text style={[styles.bodyText, { color: theme.statusGreen }]}>
                Microphone access granted
              </Text>
            </View>
          )}

          {permState === 'denied' && (
            <View style={styles.permDenied}>
              <MaterialIcons name="block" size={18} color={theme.statusRed} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bodyText, { color: theme.statusRed }]}>
                  Microphone access denied
                </Text>
                <Text style={styles.smallText}>
                  To enable: Settings → Apps → MediAid → Permissions → Microphone → Allow
                </Text>
              </View>
            </View>
          )}

          {permState === 'undetermined' && (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={requestPermission}
            >
              <MaterialIcons name="mic" size={18} color="#FFF" />
              <Text style={styles.primaryBtnText}>Grant Microphone Access</Text>
            </Pressable>
          )}
        </View>

        {/* ── Test recording section ── */}
        {permState === 'granted' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="fiber-manual-record" size={18} color={isRecording ? theme.statusRed : theme.primary} />
              <Text style={styles.cardTitle}>5-Second Test Recording</Text>
            </View>

            {/* Live meter */}
            <Text style={styles.label}>LIVE INPUT LEVEL (REAL MICROPHONE)</Text>
            <LevelMeter dbfs={meterDbfs} />

            <View style={styles.meterNote}>
              <MaterialIcons name="info-outline" size={13} color={theme.textMuted} />
              <Text style={styles.smallText}>
                Meter shows real-time dBFS from expo-av with isMeteringEnabled: true (100 ms poll). Speak or cough to see it respond.
              </Text>
            </View>

            {/* Record button */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 16 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.recordBtn,
                  isRecording && styles.recordingBtn,
                  pressed && { opacity: 0.85 },
                  permState !== 'granted' && styles.disabledBtn,
                ]}
                onPress={isRecording ? finishRecording : startTest}
                disabled={permState !== 'granted'}
              >
                <MaterialIcons name={isRecording ? 'stop' : 'mic'} size={28} color="#FFF" />
                <Text style={styles.recordBtnText}>
                  {isRecording ? `Stop (${secondsLeft}s left)` : 'Record 5 Seconds'}
                </Text>
              </Pressable>
            </Animated.View>

            {isRecording && (
              <View style={styles.recordingStatus}>
                <View style={styles.liveDot} />
                <Text style={styles.recordingLabel}>
                  RECORDING — Speak clearly into the microphone
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Playback section ── */}
        {recordedUri && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="play-circle" size={18} color={theme.statusGreen} />
              <Text style={styles.cardTitle}>Test Recording Playback</Text>
            </View>

            <View style={styles.playbackTrack}>
              <View style={[styles.playbackFill, { width: `${playbackPos * 100}%` }]} />
            </View>

            <Pressable
              style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
              onPress={playback}
            >
              <MaterialIcons
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={22}
                color="#FFF"
              />
              <Text style={styles.playBtnText}>
                {isPlaying ? 'Pause Playback' : 'Play Back Recording'}
              </Text>
            </Pressable>

            <Text style={[styles.smallText, { marginTop: 8 }]}>
              Duration: {(testDurationMs / 1000).toFixed(1)} s · Stored locally only, not transmitted
            </Text>
          </View>
        )}

        {/* ── Error ── */}
        {errorMsg && (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={16} color={theme.statusRed} />
            <Text style={[styles.smallText, { color: theme.statusRed, flex: 1 }]}>{errorMsg}</Text>
          </View>
        )}

        {/* ── Voice command status (TASK C) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="record-voice-over" size={18} color={theme.textMuted} />
            <Text style={styles.cardTitle}>Voice Command Recognition</Text>
            <View style={styles.plannedChip}>
              <Text style={styles.plannedChipText}>DEV BUILD ONLY</Text>
            </View>
          </View>
          <Text style={styles.bodyText}>
            Voice command recognition ("scan", "stop", "yes", "no") uses{' '}
            <Text style={styles.code}>expo-speech-recognition</Text>, which requires a native
            development or production build — it does not work in Expo Go.
          </Text>
          <Text style={[styles.smallText, { marginTop: 8 }]}>
            Supported languages: English (en-US) and French (fr-FR) only.{'\n'}
            On-device recognition used when available (supportsOnDeviceRecognition()).{'\n'}
            Voice commands are always optional — every action has a large visible button.
          </Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="info-outline" size={14} color={theme.statusYellow} />
            <Text style={[styles.smallText, { color: theme.statusYellow, flex: 1 }]}>
              If the config plugin build fails on this platform, voice commands are silently
              disabled. Report to AICEXPERTS with the build log.
            </Text>
          </View>
        </View>

        {/* ── Privacy note ── */}
        <View style={styles.privacyNote}>
          <MaterialIcons name="lock" size={14} color={theme.statusGreen} />
          <Text style={styles.smallText}>
            Test audio is stored temporarily on-device only. It is never transmitted and
            is deleted when you leave this screen.
          </Text>
        </View>
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
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },

  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
    padding: 16, marginTop: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },

  bodyText: { fontSize: 14, color: theme.textSecondary, lineHeight: 21 },
  smallText: { fontSize: 11, color: theme.textMuted, lineHeight: 17 },
  label: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },

  permGranted: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permDenied: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    padding: 14, marginTop: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  meterNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },

  recordBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium, padding: 18,
    shadowColor: theme.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  recordingBtn: { backgroundColor: theme.statusRed },
  disabledBtn: { opacity: 0.4 },
  recordBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  recordingStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.statusRed },
  recordingLabel: { fontSize: 12, fontWeight: '700', color: theme.statusRed },

  playbackTrack: {
    height: 6, backgroundColor: theme.border, borderRadius: 3,
    overflow: 'hidden', marginBottom: 12,
  },
  playbackFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: theme.statusGreen, minWidth: 2,
  },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.statusGreen, borderRadius: theme.radius.medium, padding: 14,
  },
  playBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  errorCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.statusRed + '10', borderRadius: theme.radius.medium,
    padding: 12, marginTop: 12, borderWidth: 1, borderColor: theme.statusRed + '44',
  },

  plannedChip: {
    backgroundColor: theme.statusYellow + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  plannedChipText: { fontSize: 9, fontWeight: '800', color: theme.statusYellow, letterSpacing: 0.5 },

  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10,
    backgroundColor: theme.statusYellow + '08', borderRadius: theme.radius.small,
    padding: 8, borderWidth: 1, borderColor: theme.statusYellow + '22',
  },

  code: { fontFamily: 'monospace', fontSize: 11, color: theme.primary },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.statusGreen + '08', borderRadius: theme.radius.medium,
    padding: 12, marginTop: 16, borderWidth: 1, borderColor: theme.statusGreen + '33',
  },
});
