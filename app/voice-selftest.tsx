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
 *   - expo-speech-recognition voice commands are available (requires native build)
 *
 * Reachable from: Sync tab "Microphone Diagnostic" row.
 *
 * WHAT IS REAL:
 *   - Microphone permission request (expo-av Audio.requestPermissionsAsync)
 *   - Live metering via Audio.Recording with isMeteringEnabled: true (100 ms poll)
 *   - 5-second test recording and playback via expo-av Audio.Sound
 *   - expo-speech-recognition state check (available / unavailable / permission denied)
 *   - If native build: live transcript of spoken words during the recognition test
 *
 * WHAT REQUIRES A NATIVE BUILD:
 *   - expo-speech-recognition does NOT work in Expo Go.
 *     The screen gracefully degrades: metering and playback work in all environments;
 *     voice command recognition shows "DEV BUILD ONLY" when unavailable.
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
import {
  isVoiceCommandAvailable,
  supportsOnDevice,
  startVoiceCommandSession,
  type RecognitionState,
  type VoiceCommand,
  type VoiceCommandSession,
} from '@/services/voiceCommands';
import { useApp } from '@/contexts/AppContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const TEST_DURATION_S = 5;
const METER_POLL_MS   = 100;

// ── Permission state types ─────────────────────────────────────────────────────
type PermState = 'checking' | 'granted' | 'denied' | 'undetermined';

// ── Level meter bar ────────────────────────────────────────────────────────────
function LevelMeter({ dbfs }: { dbfs: number | null }) {
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

// ── Recognition state chip ─────────────────────────────────────────────────────
function RecognitionStateChip({ state }: { state: RecognitionState | 'checking' | 'not_checked' }) {
  const config: Record<string, { label: string; color: string; icon: string }> = {
    unavailable:       { label: 'Unavailable (Expo Go / not installed)', color: theme.textMuted,    icon: 'mic-off' },
    idle:              { label: 'Idle — ready',                          color: theme.statusGreen,  icon: 'mic-none' },
    listening:         { label: 'Listening (on-device)',                 color: theme.statusGreen,  icon: 'mic' },
    online:            { label: 'Listening (online recognition)',        color: theme.statusYellow, icon: 'cloud' },
    permission_denied: { label: 'Permission denied',                     color: theme.statusRed,    icon: 'block' },
    error:             { label: 'Recognition error',                     color: theme.statusRed,    icon: 'error-outline' },
    checking:          { label: 'Checking…',                             color: theme.textMuted,    icon: 'hourglass-empty' },
    not_checked:       { label: 'Not checked yet',                       color: theme.textMuted,    icon: 'help-outline' },
  };
  const c = config[state] ?? config['not_checked'];
  return (
    <View style={[chipStyles.chip, { backgroundColor: c.color + '18', borderColor: c.color + '55' }]}>
      <MaterialIcons name={c.icon as any} size={14} color={c.color} />
      <Text style={[chipStyles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: theme.radius.full, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  text: { fontSize: 11, fontWeight: '700', flex: 1 },
});

// ── Main screen ────────────────────────────────────────────────────────────────
export default function VoiceSelfTestScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();
  const lang = language === 'fr' ? 'fr-FR' : 'en-US';

  // Microphone / recording state
  const [permState,      setPermState]      = useState<PermState>('checking');
  const [recording,      setRecording]      = useState<Audio.Recording | null>(null);
  const [isRecording,    setIsRecording]    = useState(false);
  const [meterDbfs,      setMeterDbfs]      = useState<number | null>(null);
  const [secondsLeft,    setSecondsLeft]    = useState(TEST_DURATION_S);
  const [recordedUri,    setRecordedUri]    = useState<string | null>(null);
  const [sound,          setSound]          = useState<Audio.Sound | null>(null);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [playbackPos,    setPlaybackPos]    = useState(0);
  const [testDurationMs, setTestDurationMs] = useState(0);
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null);

  // Voice command / recognition state
  const [vcAvailable,   setVcAvailable]   = useState<boolean | null>(null);
  const [vcOnDevice,    setVcOnDevice]    = useState<boolean | null>(null);
  const [vcState,       setVcState]       = useState<RecognitionState | 'checking' | 'not_checked'>('not_checked');
  const [vcTranscript,  setVcTranscript]  = useState('');
  const [vcLastCmd,     setVcLastCmd]     = useState<VoiceCommand | null>(null);
  const vcSessionRef = useRef<VoiceCommandSession | null>(null);

  const meterTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef   = useRef<Audio.Recording | null>(null);
  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const pulseLoop      = useRef<Animated.CompositeAnimation | null>(null);

  // ── Check permissions on mount ────────────────────────────────────────────
  useEffect(() => {
    checkPermission();
    checkVoiceCommandAvailability();
    return () => {
      cleanup();
      vcSessionRef.current?.stop();
    };
  }, []);

  async function checkPermission() {
    setPermState('checking');
    try {
      const { status } = await Audio.getPermissionsAsync();
      setPermState(
        status === 'granted' ? 'granted' :
        status === 'denied'  ? 'denied'  : 'undetermined'
      );
    } catch { setPermState('undetermined'); }
  }

  async function requestPermission() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setPermState(status === 'granted' ? 'granted' : 'denied');
    } catch (e) { setErrorMsg('Could not request permission: ' + String(e)); }
  }

  async function checkVoiceCommandAvailability() {
    setVcAvailable(null);
    const avail = await isVoiceCommandAvailable();
    setVcAvailable(avail);
    if (avail) {
      const onDevice = await supportsOnDevice();
      setVcOnDevice(onDevice);
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

  // ── Test recording ────────────────────────────────────────────────────────
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

      meterTimerRef.current = setInterval(async () => {
        try {
          const status = await recordingRef.current?.getStatusAsync();
          if (status?.isRecording && status.metering !== undefined) {
            setMeterDbfs(status.metering);
          }
        } catch {}
      }, METER_POLL_MS);

      let remaining = TEST_DURATION_S;
      countdownRef.current = setInterval(async () => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearInterval(countdownRef.current!);
          await finishRecording();
        }
      }, 1000);
    } catch (e) { setErrorMsg('Could not start recording: ' + String(e)); }
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
    } catch (e) { setErrorMsg('Could not stop recording: ' + String(e)); }
    recordingRef.current = null;
    setRecording(null);
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────
  const playback = useCallback(async () => {
    if (!recordedUri) return;
    setErrorMsg(null);
    if (sound) {
      if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
      else           { await sound.playAsync();  setIsPlaying(true);  }
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
            ? Math.min(1, (status.positionMillis ?? 0) / testDurationMs) : 0;
          setPlaybackPos(pct);
          if (status.didJustFinish) { setIsPlaying(false); setPlaybackPos(0); }
        }
      );
      setSound(snd);
      setIsPlaying(true);
    } catch (e) { setErrorMsg('Could not play recording: ' + String(e)); }
  }, [recordedUri, sound, isPlaying, testDurationMs]);

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  // ── Voice command test ────────────────────────────────────────────────────
  const startVcTest = useCallback(async () => {
    if (!vcAvailable) return;
    setVcTranscript('');
    setVcLastCmd(null);
    setVcState('checking');
    vcSessionRef.current?.stop();

    const session = await startVoiceCommandSession(
      lang,
      (cmd) => {
        setVcLastCmd(cmd);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => { session?.stop(); vcSessionRef.current = null; }, 500);
      },
      (state) => setVcState(state),
      (text) => setVcTranscript(text),
    );
    vcSessionRef.current = session;
  }, [vcAvailable, lang]);

  const stopVcTest = useCallback(() => {
    vcSessionRef.current?.stop();
    vcSessionRef.current = null;
    setVcState('idle');
    setVcTranscript('');
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Voice / Mic Self-Test</Text>
          <Text style={styles.navSub}>Verify microphone and voice commands before scan</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Permission ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="mic" size={18} color={
              permState === 'granted' ? theme.statusGreen
              : permState === 'denied' ? theme.statusRed : theme.statusYellow
            } />
            <Text style={styles.cardTitle}>Microphone Permission</Text>
          </View>
          {permState === 'checking' && <Text style={styles.bodyText}>Checking permission…</Text>}
          {permState === 'granted' && (
            <View style={styles.permGranted}>
              <MaterialIcons name="check-circle" size={18} color={theme.statusGreen} />
              <Text style={[styles.bodyText, { color: theme.statusGreen }]}>Microphone access granted</Text>
            </View>
          )}
          {permState === 'denied' && (
            <View style={styles.permDenied}>
              <MaterialIcons name="block" size={18} color={theme.statusRed} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bodyText, { color: theme.statusRed }]}>Microphone access denied</Text>
                <Text style={styles.smallText}>
                  Settings → Apps → MediAid → Permissions → Microphone → Allow
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

        {/* ── Test recording ── */}
        {permState === 'granted' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="fiber-manual-record" size={18} color={isRecording ? theme.statusRed : theme.primary} />
              <Text style={styles.cardTitle}>5-Second Test Recording</Text>
            </View>
            <Text style={styles.label}>LIVE INPUT LEVEL (REAL MICROPHONE)</Text>
            <LevelMeter dbfs={meterDbfs} />
            <View style={styles.meterNote}>
              <MaterialIcons name="info-outline" size={13} color={theme.textMuted} />
              <Text style={styles.smallText}>
                Real-time dBFS from expo-av isMeteringEnabled: true (100 ms poll). Speak or cough to see it respond.
              </Text>
            </View>
            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 16 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.recordBtn,
                  isRecording && styles.recordingBtn,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={isRecording ? finishRecording : startTest}
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
                <Text style={styles.recordingLabel}>RECORDING — Speak clearly into the microphone</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Playback ── */}
        {recordedUri ? (
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
              <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={22} color="#FFF" />
              <Text style={styles.playBtnText}>
                {isPlaying ? 'Pause Playback' : 'Play Back Recording'}
              </Text>
            </Pressable>
            <Text style={[styles.smallText, { marginTop: 8 }]}>
              Duration: {(testDurationMs / 1000).toFixed(1)} s · Stored locally only, not transmitted
            </Text>
          </View>
        ) : null}

        {/* ── Error ── */}
        {errorMsg ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={16} color={theme.statusRed} />
            <Text style={[styles.smallText, { color: theme.statusRed, flex: 1 }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* ── Voice command recognition test (TASK C) ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="record-voice-over" size={18} color={
              vcAvailable ? theme.statusGreen : theme.textMuted
            } />
            <Text style={styles.cardTitle}>Voice Command Recognition</Text>
            {vcAvailable === null ? (
              <View style={styles.checkingChip}>
                <Text style={styles.checkingChipText}>CHECKING</Text>
              </View>
            ) : vcAvailable ? (
              <View style={styles.availableChip}>
                <Text style={styles.availableChipText}>AVAILABLE</Text>
              </View>
            ) : (
              <View style={styles.plannedChip}>
                <Text style={styles.plannedChipText}>NEEDS NATIVE BUILD</Text>
              </View>
            )}
          </View>

          {/* Status */}
          <Text style={styles.label}>RECOGNITION STATE</Text>
          <RecognitionStateChip state={vcState} />

          {/* On-device / online note */}
          {vcAvailable && vcOnDevice !== null && (
            <View style={[styles.meterNote, { marginTop: 10 }]}>
              <MaterialIcons
                name={vcOnDevice ? 'smartphone' : 'cloud'}
                size={13}
                color={vcOnDevice ? theme.statusGreen : theme.statusYellow}
              />
              <Text style={styles.smallText}>
                {vcOnDevice
                  ? 'On-device recognition supported — no audio sent to cloud.'
                  : 'On-device recognition NOT supported. Platform cloud recogniser will be used when listening.'}
              </Text>
            </View>
          )}

          {/* Not available explanation */}
          {vcAvailable === false && (
            <View style={[styles.meterNote, { marginTop: 8 }]}>
              <MaterialIcons name="info-outline" size={13} color={theme.statusYellow} />
              <Text style={[styles.smallText, { flex: 1 }]}>
                expo-speech-recognition requires a native development or production build.
                It does not work in Expo Go. Run <Text style={styles.code}>npx expo run:android</Text> or
                {' '}<Text style={styles.code}>npx expo run:ios</Text> to enable voice commands.
                All app functions remain usable via on-screen buttons.
              </Text>
            </View>
          )}

          {/* Live transcript */}
          {(vcState === 'listening' || vcState === 'online') && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>RECOGNISED TEXT (LIVE)</Text>
              <Text style={styles.transcriptText}>
                {vcTranscript || '(listening — speak a command)'}
              </Text>
            </View>
          )}

          {/* Last matched command */}
          {vcLastCmd ? (
            <View style={styles.commandMatch}>
              <MaterialIcons name="check-circle" size={18} color={theme.statusGreen} />
              <Text style={[styles.bodyText, { color: theme.statusGreen }]}>
                Command matched: <Text style={{ fontWeight: '800' }}>{vcLastCmd}</Text>
              </Text>
            </View>
          ) : null}

          {/* Test buttons */}
          {vcAvailable ? (
            <View style={styles.vcBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.vcStartBtn,
                  (vcState === 'listening' || vcState === 'online') && styles.vcStopBtn,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={
                  (vcState === 'listening' || vcState === 'online')
                    ? stopVcTest : startVcTest
                }
              >
                <MaterialIcons
                  name={(vcState === 'listening' || vcState === 'online') ? 'stop' : 'record-voice-over'}
                  size={18} color="#FFF"
                />
                <Text style={styles.vcBtnText}>
                  {(vcState === 'listening' || vcState === 'online')
                    ? 'Stop Recognition'
                    : `Test Recognition (${lang})`}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Supported commands reference */}
          <Text style={[styles.label, { marginTop: 16 }]}>SUPPORTED COMMANDS</Text>
          <View style={styles.commandTable}>
            {[
              { action: 'Start scan',  en: '"scan", "start", "scanner"', fr: '"démarrer", "commencer"' },
              { action: 'Stop / cancel', en: '"stop"', fr: '"arrête"' },
              { action: 'Yes / confirm', en: '"yes"',  fr: '"oui"' },
              { action: 'No / cancel',   en: '"no"',   fr: '"non"' },
            ].map((r) => (
              <View key={r.action} style={styles.commandRow}>
                <Text style={styles.commandAction}>{r.action}</Text>
                <Text style={styles.commandPhrase}>EN: {r.en}</Text>
                <Text style={styles.commandPhrase}>FR: {r.fr}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.smallText, { marginTop: 8 }]}>
            Commands are accepted only on exact normalised match (first word only).
            Voice commands are always optional — every action has a large visible button.
          </Text>
        </View>

        {/* ── Privacy note ── */}
        <View style={styles.privacyNote}>
          <MaterialIcons name="lock" size={14} color={theme.statusGreen} />
          <Text style={styles.smallText}>
            Test audio is stored temporarily on-device only and is never transmitted.
            Voice recognition audio is processed on-device when supportsOnDeviceRecognition() is true;
            otherwise the platform cloud recogniser is used (noted on screen).
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
  code: { fontFamily: 'monospace', fontSize: 11, color: theme.primary },

  permGranted: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  permDenied:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },

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
  recordBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  recordingStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.statusRed },
  recordingLabel: { fontSize: 12, fontWeight: '700', color: theme.statusRed },

  playbackTrack: {
    height: 6, backgroundColor: theme.border, borderRadius: 3,
    overflow: 'hidden', marginBottom: 12,
  },
  playbackFill: { height: '100%', borderRadius: 3, backgroundColor: theme.statusGreen, minWidth: 2 },
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
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  plannedChipText: { fontSize: 9, fontWeight: '800', color: theme.statusYellow, letterSpacing: 0.5 },
  checkingChip: {
    backgroundColor: theme.textMuted + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: theme.textMuted + '44',
  },
  checkingChipText: { fontSize: 9, fontWeight: '800', color: theme.textMuted, letterSpacing: 0.5 },
  availableChip: {
    backgroundColor: theme.statusGreen + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  availableChipText: { fontSize: 9, fontWeight: '800', color: theme.statusGreen, letterSpacing: 0.5 },

  transcriptBox: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 12, marginTop: 12, borderWidth: 1, borderColor: theme.primary + '44',
  },
  transcriptLabel: { fontSize: 9, fontWeight: '800', color: theme.primary, letterSpacing: 1, marginBottom: 6 },
  transcriptText: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, minHeight: 26 },

  commandMatch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusGreen + '10', borderRadius: theme.radius.medium,
    padding: 12, marginTop: 10, borderWidth: 1, borderColor: theme.statusGreen + '33',
  },

  vcBtnRow: { marginTop: 12 },
  vcStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium, padding: 14,
  },
  vcStopBtn: { backgroundColor: theme.statusRed },
  vcBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  commandTable: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  commandRow: {
    padding: 10, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  commandAction: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginBottom: 3 },
  commandPhrase: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.statusGreen + '08', borderRadius: theme.radius.medium,
    padding: 12, marginTop: 16, borderWidth: 1, borderColor: theme.statusGreen + '33',
  },
});
