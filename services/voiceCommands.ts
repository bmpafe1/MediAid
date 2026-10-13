/**
 * MediAid · services/voiceCommands.ts
 * AICEXPERTS Limited · MIT Licence
 *
 * Voice command layer for expo-speech-recognition.
 *
 * IMPORTANT CONSTRAINTS (non-negotiable):
 *   - Requires a NATIVE DEV BUILD or production build (not Expo Go).
 *     If the native module is unavailable (Expo Go), all calls are no-ops
 *     and `isAvailable()` returns false. The app MUST remain fully usable
 *     via on-screen buttons when voice commands are unavailable.
 *   - Languages supported: en-US and fr-FR only.
 *   - On-device recognition used when supportsOnDeviceRecognition() === true.
 *     Otherwise, platform recogniser is used with a visible "online recognition" note.
 *   - Voice commands are CONVENIENCE only — every action has a large visible button.
 *   - No audio is persisted: interimResults=true, maxAlternatives=1.
 *   - NO CLAIM of accuracy: commands accepted only when the transcript is an
 *     exact normalised match to the command table below.
 *
 * Supported commands:
 *   START SCAN : "scan" | "start" | "scanner" | "démarrer" | "commencer"
 *   STOP       : "stop" | "arrête" | "arreter"
 *   YES        : "yes"  | "oui"
 *   NO         : "no"   | "non"
 *
 * Usage:
 *   const vc = VoiceCommandService.getInstance();
 *   await vc.start('en-US', (cmd) => { if (cmd === 'START_SCAN') router.push('/scan-workflow'); });
 *   vc.stop();
 */

// We import conditionally so that Metro can still bundle on web/Expo Go
// where the native module is absent.
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {
  // Package not installed OR Expo Go — graceful no-op
  ExpoSpeechRecognitionModule = null;
  useSpeechRecognitionEvent = null;
}

// ── Command enum ──────────────────────────────────────────────────────────────

export type VoiceCommand = 'START_SCAN' | 'STOP' | 'YES' | 'NO';

// ── Command table (exact normalised match) ────────────────────────────────────

const COMMAND_MAP: Record<string, VoiceCommand> = {
  // EN — start
  scan:       'START_SCAN',
  start:      'START_SCAN',
  scanner:    'START_SCAN',
  // FR — start
  démarrer:   'START_SCAN',
  demarrer:   'START_SCAN',
  commencer:  'START_SCAN',
  // EN/FR — stop
  stop:       'STOP',
  arrête:     'STOP',
  arrete:     'STOP',
  arreter:    'STOP',
  // EN — yes/no
  yes:        'YES',
  no:         'NO',
  // FR — yes/no
  oui:        'YES',
  non:        'NO',
};

// ── Normalise transcript to single lowercase word ─────────────────────────────

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')               // decompose accents
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .trim()
    .split(/\s+/)[0]               // first word only
    ?? '';
}

// ── Availability check ────────────────────────────────────────────────────────

export async function isVoiceCommandAvailable(): Promise<boolean> {
  if (!ExpoSpeechRecognitionModule) return false;
  try {
    const avail = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
    return !!avail;
  } catch {
    return false;
  }
}

export async function supportsOnDevice(): Promise<boolean> {
  if (!ExpoSpeechRecognitionModule) return false;
  try {
    return !!(await ExpoSpeechRecognitionModule.supportsOnDeviceRecognition());
  } catch {
    return false;
  }
}

// ── Service singleton ─────────────────────────────────────────────────────────

export type RecognitionState =
  | 'unavailable'     // native module missing (Expo Go) or not supported
  | 'idle'
  | 'permission_denied'
  | 'listening'
  | 'online'         // using cloud recogniser (not on-device)
  | 'error';

export interface VoiceCommandSession {
  stop: () => void;
}

/**
 * Start a voice command session.
 *
 * @param lang        'en-US' or 'fr-FR'
 * @param onCommand   called when a command is matched
 * @param onState     called when recognition state changes
 * @param onTranscript called with every interim transcript (display only)
 * @returns a session handle with a stop() method; or null if unavailable
 */
export async function startVoiceCommandSession(
  lang: 'en-US' | 'fr-FR',
  onCommand: (cmd: VoiceCommand) => void,
  onState?: (state: RecognitionState) => void,
  onTranscript?: (text: string) => void,
): Promise<VoiceCommandSession | null> {
  if (!ExpoSpeechRecognitionModule) {
    onState?.('unavailable');
    return null;
  }

  // Check availability
  const available = await isVoiceCommandAvailable();
  if (!available) {
    onState?.('unavailable');
    return null;
  }

  // Request permissions
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) {
    onState?.('permission_denied');
    return null;
  }

  // Decide on-device vs online
  const onDevice = await supportsOnDevice();
  onState?.(onDevice ? 'listening' : 'online');

  // Register event listeners
  const listeners: Array<{ remove: () => void }> = [];

  const resultListener = ExpoSpeechRecognitionModule.addListener(
    'result',
    (event: { results: Array<{ transcript: string; confidence: number }>; isFinal: boolean }) => {
      const transcript = event.results[0]?.transcript ?? '';
      onTranscript?.(transcript);

      if (event.isFinal || transcript) {
        const norm = normalise(transcript);
        const cmd  = COMMAND_MAP[norm];
        if (cmd) {
          onCommand(cmd);
        }
      }
    },
  );
  listeners.push(resultListener);

  const errorListener = ExpoSpeechRecognitionModule.addListener(
    'error',
    (event: { error: string; message: string }) => {
      if (event.error === 'not-allowed') {
        onState?.('permission_denied');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onState?.('error');
      }
    },
  );
  listeners.push(errorListener);

  const endListener = ExpoSpeechRecognitionModule.addListener('end', () => {
    onState?.('idle');
  });
  listeners.push(endListener);

  // Start recognition (non-continuous: one command per session)
  try {
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: onDevice,
      maxAlternatives: 1,
    });
  } catch (e) {
    listeners.forEach((l) => l.remove());
    onState?.('error');
    return null;
  }

  return {
    stop() {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
      listeners.forEach((l) => l.remove());
      onState?.('idle');
    },
  };
}

// ── Re-export hook for React components ──────────────────────────────────────
// Returns the hook from the package if available, or a no-op stub.
export { useSpeechRecognitionEvent };
