// MediAid — Patient Clinical Notes (with Voice Notes)
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const NOTES_KEY = 'mediaid_patient_notes_v1';
const VOICE_NOTES_KEY = 'mediaid_voice_notes_v1';

// ─── Voice Note Interface ────────────────────────────────────────────────────
interface VoiceNote {
  id: string;
  patientId: string;
  patientName: string;
  uri: string;
  durationMs: number;
  createdAt: string;
  label: string;
}

type NoteCategory = 'observation' | 'medication' | 'followup' | 'social' | 'nutrition' | 'other';

interface ClinicalNote {
  id: string;
  patientId: string;
  patientName: string;
  category: NoteCategory;
  content: string;
  chaName: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  important: boolean;
  tags: string[];
}

interface NoteCategory_ {
  id: NoteCategory;
  label: string;
  icon: string;
  color: string;
}

const CATEGORIES: NoteCategory_[] = [
  { id: 'observation', label: 'Clinical Observation', icon: 'visibility', color: theme.primary },
  { id: 'medication', label: 'Medication', icon: 'medication', color: theme.statusYellow },
  { id: 'followup', label: 'Follow-up Plan', icon: 'event', color: theme.statusGreen },
  { id: 'social', label: 'Social / Household', icon: 'home', color: '#F59E0B' },
  { id: 'nutrition', label: 'Nutrition', icon: 'restaurant', color: '#10B981' },
  { id: 'other', label: 'Other', icon: 'notes', color: theme.textMuted },
];

function getCat(id: NoteCategory): NoteCategory_ {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[5];
}

function generateId() {
  return 'NOTE-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ─── Add / Edit Note Modal ────────────────────────────────────────────────────
function NoteModal({
  visible,
  existingNote,
  prefillPatientId,
  prefillPatientName,
  onClose,
  onSave,
}: {
  visible: boolean;
  existingNote: ClinicalNote | null;
  prefillPatientId?: string;
  prefillPatientName?: string;
  onClose: () => void;
  onSave: (note: ClinicalNote) => void;
}) {
  const [category, setCategory] = useState<NoteCategory>('observation');
  const [content, setContent] = useState('');
  const [chaName, setChaName] = useState('Abena Mbah');
  const [important, setImportant] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [patientName, setPatientName] = useState(prefillPatientName ?? '');
  const [patientId, setPatientId] = useState(prefillPatientId ?? '');

  useEffect(() => {
    if (visible) {
      if (existingNote) {
        setCategory(existingNote.category);
        setContent(existingNote.content);
        setChaName(existingNote.chaName);
        setImportant(existingNote.important);
        setTags(existingNote.tags);
        setPatientName(existingNote.patientName);
        setPatientId(existingNote.patientId);
      } else {
        setCategory('observation');
        setContent('');
        setImportant(false);
        setTags([]);
        setTagInput('');
        setPatientName(prefillPatientName ?? '');
        setPatientId(prefillPatientId ?? '');
      }
    }
  }, [visible, existingNote, prefillPatientId, prefillPatientName]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleSave = () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Please write something before saving.');
      return;
    }
    if (!patientName.trim()) {
      Alert.alert('Missing Patient', 'Please enter a patient name.');
      return;
    }
    const now = new Date().toISOString();
    const note: ClinicalNote = {
      id: existingNote?.id ?? generateId(),
      patientId: patientId || 'PT-' + Date.now().toString(36).toUpperCase(),
      patientName: patientName.trim(),
      category,
      content: content.trim(),
      chaName,
      createdAt: existingNote?.createdAt ?? now,
      updatedAt: now,
      important,
      tags,
    };
    onSave(note);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={modalStyles.backdrop} onPress={onClose}>
          <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>{existingNote ? 'Edit Note' : 'Add Clinical Note'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              {/* Patient */}
              <Text style={modalStyles.label}>Patient Name *</Text>
              <TextInput
                style={modalStyles.input}
                value={patientName}
                onChangeText={setPatientName}
                placeholder="Enter patient name"
                placeholderTextColor={theme.textMuted}
              />

              {/* Category */}
              <Text style={modalStyles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        modalStyles.catChip,
                        category === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color },
                      ]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <MaterialIcons name={cat.icon as any} size={14} color={category === cat.id ? cat.color : theme.textMuted} />
                      <Text style={[modalStyles.catChipText, category === cat.id && { color: cat.color, fontWeight: '700' }]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Content */}
              <Text style={modalStyles.label}>Note *</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.contentInput]}
                value={content}
                onChangeText={setContent}
                placeholder="Write clinical observation, medication note, or follow-up plan..."
                placeholderTextColor={theme.textMuted}
                multiline
                textAlignVertical="top"
                autoFocus
              />

              {/* Tags */}
              <Text style={modalStyles.label}>Tags (optional)</Text>
              <View style={modalStyles.tagInputRow}>
                <TextInput
                  style={[modalStyles.input, { flex: 1, marginBottom: 0 }]}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  placeholder="Add tag (press enter)"
                  placeholderTextColor={theme.textMuted}
                  returnKeyType="done"
                />
                <Pressable
                  style={({ pressed }) => [modalStyles.addTagBtn, pressed && { opacity: 0.85 }]}
                  onPress={addTag}
                >
                  <MaterialIcons name="add" size={18} color="#FFF" />
                </Pressable>
              </View>
              {tags.length > 0 && (
                <View style={modalStyles.tagsRow}>
                  {tags.map((t) => (
                    <Pressable key={t} style={modalStyles.tag} onPress={() => removeTag(t)}>
                      <Text style={modalStyles.tagText}>{t}</Text>
                      <MaterialIcons name="close" size={11} color={theme.primary} />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Important toggle */}
              <Pressable
                style={[modalStyles.importantRow, important && { backgroundColor: theme.statusRed + '15', borderColor: theme.statusRed + '44' }]}
                onPress={() => setImportant((v) => !v)}
              >
                <MaterialIcons
                  name={important ? 'star' : 'star-border'}
                  size={20}
                  color={important ? theme.statusRed : theme.textMuted}
                />
                <Text style={[modalStyles.importantText, important && { color: theme.statusRed }]}>
                  {important ? 'Marked as Important' : 'Mark as Important'}
                </Text>
              </Pressable>

              {/* CHA name */}
              <Text style={modalStyles.label}>CHA Name</Text>
              <TextInput
                style={modalStyles.input}
                value={chaName}
                onChangeText={setChaName}
                placeholderTextColor={theme.textMuted}
              />
            </ScrollView>

            <View style={modalStyles.btnRow}>
              <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
                <Text style={modalStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [modalStyles.saveBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSave}
              >
                <MaterialIcons name="save" size={16} color="#FFF" />
                <Text style={modalStyles.saveBtnText}>{existingNote ? 'Update Note' : 'Save Note'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
    borderWidth: 1, borderColor: theme.border,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
    padding: 12, fontSize: 14, color: theme.textPrimary, marginBottom: 12,
  },
  contentInput: { height: 110, textAlignVertical: 'top' },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  catChipText: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  tagInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addTagBtn: {
    width: 44, height: 44, borderRadius: theme.radius.medium,
    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  tagText: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  importantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  importantText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ─── Note Card ────────────────────────────────────────────────────────────────
function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: ClinicalNote;
  onEdit: (n: ClinicalNote) => void;
  onDelete: (id: string) => void;
}) {
  const cat = getCat(note.category);
  const isEdited = note.updatedAt !== note.createdAt;

  const timeAgo = () => {
    const diff = Date.now() - new Date(note.updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  return (
    <View style={[noteCardStyles.card, { borderLeftColor: cat.color }, note.important && { borderColor: theme.statusRed + '44' }]}>
      {/* Header */}
      <View style={noteCardStyles.header}>
        <View style={[noteCardStyles.catCircle, { backgroundColor: cat.color + '18', borderColor: cat.color + '44' }]}>
          <MaterialIcons name={cat.icon as any} size={16} color={cat.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={noteCardStyles.catLabel}>{cat.label}</Text>
          <Text style={noteCardStyles.patientName}>{note.patientName}</Text>
        </View>
        {note.important && (
          <View style={noteCardStyles.importantBadge}>
            <MaterialIcons name="star" size={12} color={theme.statusRed} />
            <Text style={noteCardStyles.importantBadgeText}>IMPORTANT</Text>
          </View>
        )}
        <View style={noteCardStyles.actions}>
          <Pressable
            style={({ pressed }) => [noteCardStyles.actionBtn, pressed && { opacity: 0.7 }]}
            onPress={() => onEdit(note)}
            hitSlop={8}
          >
            <MaterialIcons name="edit" size={16} color={theme.textMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [noteCardStyles.actionBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(note.id) },
              ]);
            }}
            hitSlop={8}
          >
            <MaterialIcons name="delete-outline" size={16} color={theme.statusRed + 'AA'} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <Text style={noteCardStyles.content}>{note.content}</Text>

      {/* Tags */}
      {note.tags.length > 0 && (
        <View style={noteCardStyles.tagsRow}>
          {note.tags.map((t) => (
            <View key={t} style={noteCardStyles.tag}>
              <Text style={noteCardStyles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={noteCardStyles.footer}>
        <MaterialIcons name="access-time" size={11} color={theme.textMuted} />
        <Text style={noteCardStyles.footerText}>{timeAgo()}</Text>
        {isEdited && <Text style={noteCardStyles.editedText}>· Edited</Text>}
        <View style={{ flex: 1 }} />
        <Text style={noteCardStyles.chaText}>CHA: {note.chaName}</Text>
      </View>
    </View>
  );
}

const noteCardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  catCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  catLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  patientName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginTop: 1 },
  importantBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  importantBadgeText: { fontSize: 8, fontWeight: '800', color: theme.statusRed, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.background,
  },
  content: { fontSize: 14, color: theme.textPrimary, lineHeight: 22, marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  tag: {
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.primary + '33',
  },
  tagText: { fontSize: 10, color: theme.primary, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 11, color: theme.textMuted },
  editedText: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic' },
  chaText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
});

// ─── Voice Note Recorder ─────────────────────────────────────────────────────
function VoiceNoteRecorder({
  patientId, patientName, onSaved,
}: { patientId: string; patientName: string; onSaved: (vn: VoiceNote) => void }) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const MAX_SECONDS = 60;

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true, easing: Easing.ease }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true, easing: Easing.ease }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Microphone access is required for voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setElapsed(0);
      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return e + 1;
        });
      }, 1000);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(timerRef.current!);
    stopPulse();
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      if (!uri) return;
      const vn: VoiceNote = {
        id: 'VN-' + Date.now().toString(36).toUpperCase(),
        patientId,
        patientName,
        uri,
        durationMs: status.durationMillis ?? elapsed * 1000,
        createdAt: new Date().toISOString(),
        label: `Voice Note · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      };
      onSaved(vn);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setRecording(null);
    setElapsed(0);
  };

  useEffect(() => () => { clearInterval(timerRef.current!); }, []);

  const pct = (elapsed / MAX_SECONDS) * 100;
  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={voiceStyles.container}>
      <View style={voiceStyles.header}>
        <MaterialIcons name="mic" size={16} color="#22D3EE" />
        <Text style={voiceStyles.title}>Voice Note Recorder</Text>
        <Text style={voiceStyles.limit}>Max {MAX_SECONDS}s</Text>
      </View>

      {/* Progress bar */}
      <View style={voiceStyles.progressTrack}>
        <View style={[voiceStyles.progressFill, { width: `${pct}%`, backgroundColor: elapsed >= 50 ? theme.statusRed : '#22D3EE' }]} />
      </View>

      <View style={voiceStyles.recRow}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            style={[voiceStyles.recBtn, { backgroundColor: isRecording ? theme.statusRed : '#22D3EE' }]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <MaterialIcons name={isRecording ? 'stop' : 'mic'} size={22} color="#FFF" />
          </Pressable>
        </Animated.View>
        <View style={{ flex: 1 }}>
          {isRecording ? (
            <>
              <View style={voiceStyles.liveDotRow}>
                <View style={voiceStyles.liveDot} />
                <Text style={voiceStyles.liveLabel}>RECORDING</Text>
              </View>
              <Text style={voiceStyles.elapsed}>{fmtTime(elapsed)} / {fmtTime(MAX_SECONDS)}</Text>
            </>
          ) : (
            <>
              <Text style={voiceStyles.idleLabel}>Tap to record</Text>
              <Text style={voiceStyles.idleSub}>Stored on-device only · No transmission</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const voiceStyles = StyleSheet.create({
  container: {
    backgroundColor: '#22D3EE08', borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#22D3EE33',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { flex: 1, fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  limit: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  progressTrack: { height: 3, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 2, minWidth: 2 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22D3EE', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.statusRed },
  liveLabel: { fontSize: 11, fontWeight: '800', color: theme.statusRed, letterSpacing: 1 },
  elapsed: { fontSize: 18, fontWeight: '800', color: '#22D3EE', marginTop: 2 },
  idleLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  idleSub: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
});

// ─── Voice Note Playback Card ──────────────────────────────────────────────────
function VoiceNoteCard({ vn, onDelete }: { vn: VoiceNote; onDelete: (id: string) => void }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const durationSecs = Math.round(vn.durationMs / 1000);
  const positionSecs = Math.round(positionMs / 1000);
  const pct = vn.durationMs > 0 ? Math.min(1, positionMs / vn.durationMs) : 0;

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const togglePlay = async () => {
    if (sound) {
      if (playing) {
        await sound.pauseAsync();
        setPlaying(false);
      } else {
        await sound.playAsync();
        setPlaying(true);
      }
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound: snd } = await Audio.Sound.createAsync(
        { uri: vn.uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPositionMs(status.positionMillis ?? 0);
            if (status.didJustFinish) { setPlaying(false); setPositionMs(0); }
          }
        }
      );
      setSound(snd);
      setPlaying(true);
    } catch {
      Alert.alert('Playback Error', 'Could not play this voice note.');
    }
  };

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  return (
    <View style={vnCardStyles.card}>
      <View style={vnCardStyles.header}>
        <Pressable style={[vnCardStyles.playBtn, { backgroundColor: playing ? theme.statusGreen : '#22D3EE' }]} onPress={togglePlay}>
          <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={18} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={vnCardStyles.label}>{vn.label}</Text>
          <Text style={vnCardStyles.meta}>{vn.patientName} · {new Date(vn.createdAt).toLocaleString()}</Text>
        </View>
        <Text style={vnCardStyles.duration}>{fmtTime(positionSecs)}/{fmtTime(durationSecs)}</Text>
        <Pressable style={vnCardStyles.deleteBtn} onPress={() => onDelete(vn.id)} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={16} color={theme.statusRed + 'AA'} />
        </Pressable>
      </View>
      {/* Progress bar */}
      <View style={vnCardStyles.track}>
        <View style={[vnCardStyles.fill, { width: `${pct * 100}%`, backgroundColor: playing ? theme.statusGreen : '#22D3EE' }]} />
      </View>
    </View>
  );
}

const vnCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#22D3EE08', borderRadius: theme.radius.medium,
    padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: '#22D3EE33',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  meta: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  duration: { fontSize: 11, fontWeight: '700', color: '#22D3EE' },
  deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, minWidth: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PatientNotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>();

  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [editNote, setEditNote] = useState<ClinicalNote | null>(null);
  const [catFilter, setCatFilter] = useState<NoteCategory | 'all'>('all');
  const [importantOnly, setImportantOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTES_KEY);
      if (raw) setNotes(JSON.parse(raw));
      const vraw = await AsyncStorage.getItem(VOICE_NOTES_KEY);
      if (vraw) setVoiceNotes(JSON.parse(vraw));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const persist = async (list: ClinicalNote[]) => {
    setNotes(list);
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(list));
  };

  const saveNote = (note: ClinicalNote) => {
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) {
      const updated = [...notes];
      updated[idx] = note;
      persist(updated);
    } else {
      persist([note, ...notes]);
    }
    setEditNote(null);
  };

  const deleteNote = (id: string) => {
    persist(notes.filter((n) => n.id !== id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const saveVoiceNote = async (vn: VoiceNote) => {
    const next = [vn, ...voiceNotes];
    setVoiceNotes(next);
    await AsyncStorage.setItem(VOICE_NOTES_KEY, JSON.stringify(next));
  };

  const deleteVoiceNote = async (id: string) => {
    const next = voiceNotes.filter((v) => v.id !== id);
    setVoiceNotes(next);
    await AsyncStorage.setItem(VOICE_NOTES_KEY, JSON.stringify(next));
  };

  const patientVoiceNotes = voiceNotes.filter((v) =>
    params.patientId ? v.patientId === params.patientId : true
  );

  const filtered = notes.filter((n) => {
    if (params.patientId && n.patientId !== params.patientId) return false;
    if (catFilter !== 'all' && n.category !== catFilter) return false;
    if (importantOnly && !n.important) return false;
    return true;
  });

  const importantCount = notes.filter((n) =>
    params.patientId ? n.patientId === params.patientId : true
  ).filter((n) => n.important).length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <NoteModal
        visible={addVisible || editNote !== null}
        existingNote={editNote}
        prefillPatientId={params.patientId}
        prefillPatientName={params.patientName}
        onClose={() => { setAddVisible(false); setEditNote(null); }}
        onSave={saveNote}
      />

      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Clinical Notes</Text>
          <Text style={styles.navSub}>
            {params.patientName ? `${params.patientName} · ` : ''}{notes.length} note{notes.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setAddVisible(true)}
        >
          <MaterialIcons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Note</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Voice Recorder */}
        <Text style={styles.sectionTitle}>VOICE NOTE</Text>
        <VoiceNoteRecorder
          patientId={params.patientId ?? 'PT-UNKNOWN'}
          patientName={params.patientName ?? 'Unknown Patient'}
          onSaved={saveVoiceNote}
        />

        {/* Voice note playback */}
        {patientVoiceNotes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>RECORDED VOICE NOTES ({patientVoiceNotes.length})</Text>
            {patientVoiceNotes.map((vn) => (
              <VoiceNoteCard key={vn.id} vn={vn} onDelete={deleteVoiceNote} />
            ))}
          </>
        )}

        {/* Summary */}
        <Text style={styles.sectionTitle}>NOTES OVERVIEW</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: notes.length, color: theme.primary, icon: 'notes' },
            { label: 'Important', value: importantCount, color: theme.statusRed, icon: 'star' },
            { label: 'Today', value: notes.filter((n) => new Date(n.createdAt).toDateString() === new Date().toDateString()).length, color: theme.statusGreen, icon: 'today' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + '44' }]}>
              <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Important toggle */}
        {importantCount > 0 && (
          <Pressable
            style={[styles.importantToggle, importantOnly && { backgroundColor: theme.statusRedBg, borderColor: theme.statusRed + '55' }]}
            onPress={() => setImportantOnly((v) => !v)}
          >
            <MaterialIcons name="star" size={16} color={importantOnly ? theme.statusRed : theme.textMuted} />
            <Text style={[styles.importantToggleText, importantOnly && { color: theme.statusRed }]}>
              {importantOnly ? `Showing ${importantCount} important note${importantCount !== 1 ? 's' : ''}` : `Show important only (${importantCount})`}
            </Text>
          </Pressable>
        )}

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.filterChip, catFilter === 'all' && { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}
              onPress={() => setCatFilter('all')}
            >
              <Text style={[styles.filterChipText, catFilter === 'all' && { color: theme.primary, fontWeight: '700' }]}>All</Text>
            </Pressable>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.filterChip, catFilter === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color }]}
                onPress={() => setCatFilter(cat.id)}
              >
                <MaterialIcons name={cat.icon as any} size={12} color={catFilter === cat.id ? cat.color : theme.textMuted} />
                <Text style={[styles.filterChipText, catFilter === cat.id && { color: cat.color, fontWeight: '700' }]}>
                  {cat.label.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Notes list */}
        <Text style={styles.sectionTitle}>
          {filtered.length} NOTE{filtered.length !== 1 ? 'S' : ''}
          {params.patientName ? ` · ${params.patientName}` : ''}
        </Text>

        {filtered.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <MaterialIcons name="notes" size={56} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>
              {notes.length === 0 ? 'No clinical notes yet' : 'No notes match this filter'}
            </Text>
            <Text style={styles.emptySub}>
              {notes.length === 0
                ? 'Tap "Note" to add your first clinical observation'
                : 'Try a different category or clear the filter'}
            </Text>
            {notes.length === 0 && (
              <Pressable
                style={({ pressed }) => [styles.emptyAddBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setAddVisible(true)}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Add First Note</Text>
              </Pressable>
            )}
          </View>
        )}

        {filtered.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onEdit={(n) => setEditNote(n)}
            onDelete={deleteNote}
          />
        ))}

        {/* Category guide */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>NOTE CATEGORIES</Text>
        <View style={styles.catGuide}>
          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.catGuideRow}>
              <MaterialIcons name={cat.icon as any} size={16} color={cat.color} />
              <Text style={[styles.catGuideLabel, { color: cat.color }]}>{cat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          All notes stored on-device · FHIR R4 compatible · MediAid v1.0
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
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  importantToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginBottom: 4,
    borderWidth: 1, borderColor: theme.border,
  },
  importantToggleText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyAddBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  catGuide: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  catGuideRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  catGuideLabel: { fontSize: 12, fontWeight: '600' },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
