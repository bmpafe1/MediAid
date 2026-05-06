// MediAid — Offline Patient Queue
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const QUEUE_KEY = 'mediaid_patient_queue';

export type Priority = 'urgent' | 'routine' | 'followup';

export interface QueuedPatient {
  id: string;
  name: string;
  priority: Priority;
  notes: string;
  queuedAt: string;
}

function priorityColor(p: Priority): string {
  if (p === 'urgent') return theme.statusRed;
  if (p === 'routine') return theme.primary;
  return theme.statusYellow;
}
function priorityBg(p: Priority): string {
  if (p === 'urgent') return theme.statusRedBg;
  if (p === 'routine') return theme.primary + '18';
  return theme.statusYellowBg;
}
function priorityIcon(p: Priority): string {
  if (p === 'urgent') return 'priority-high';
  if (p === 'routine') return 'person';
  return 'history';
}
function priorityLabel(p: Priority): string {
  if (p === 'urgent') return 'URGENT';
  if (p === 'routine') return 'ROUTINE';
  return 'FOLLOW-UP';
}

function PriorityBadge({ priority, selected, onPress }: { priority: Priority; selected: boolean; onPress: () => void }) {
  const col = priorityColor(priority);
  const bg = priorityBg(priority);
  return (
    <Pressable
      style={({ pressed }) => [
        badgeStyles.badge,
        { borderColor: col + (selected ? 'CC' : '44'), backgroundColor: selected ? bg : theme.surface },
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      <MaterialIcons name={priorityIcon(priority) as any} size={14} color={selected ? col : theme.textMuted} />
      <Text style={[badgeStyles.text, { color: selected ? col : theme.textMuted }]}>
        {priorityLabel(priority)}
      </Text>
    </Pressable>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
  },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});

function QueueCard({
  patient,
  rank,
  onScanNow,
  onDelete,
}: {
  patient: QueuedPatient;
  rank: number;
  onScanNow: () => void;
  onDelete: () => void;
}) {
  const col = priorityColor(patient.priority);
  const bg = priorityBg(patient.priority);
  const elapsed = Math.round((Date.now() - new Date(patient.queuedAt).getTime()) / 60000);
  const timeLabel = elapsed < 1 ? 'Just added' : elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h ago`;

  return (
    <View style={[queueStyles.card, { borderLeftColor: col }]}>
      {/* Rank */}
      <View style={[queueStyles.rank, { backgroundColor: col + '22', borderColor: col + '55' }]}>
        <Text style={[queueStyles.rankNum, { color: col }]}>{rank}</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={queueStyles.topRow}>
          <Text style={queueStyles.patientName}>{patient.name}</Text>
          <View style={[queueStyles.priorityPill, { backgroundColor: bg, borderColor: col + '55' }]}>
            <MaterialIcons name={priorityIcon(patient.priority) as any} size={11} color={col} />
            <Text style={[queueStyles.priorityText, { color: col }]}>{priorityLabel(patient.priority)}</Text>
          </View>
        </View>
        {patient.notes.trim() !== '' && (
          <Text style={queueStyles.notes} numberOfLines={1}>{patient.notes}</Text>
        )}
        <Text style={queueStyles.timestamp}>{timeLabel}</Text>
      </View>

      {/* Actions */}
      <View style={queueStyles.actions}>
        <Pressable
          style={({ pressed }) => [queueStyles.scanBtn, { backgroundColor: col }, pressed && { opacity: 0.8 }]}
          onPress={onScanNow}
        >
          <MaterialIcons name="health-and-safety" size={14} color="#FFF" />
          <Text style={queueStyles.scanBtnText}>Scan</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [queueStyles.deleteBtn, pressed && { opacity: 0.7 }]}
          onPress={onDelete}
        >
          <MaterialIcons name="close" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const queueStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rankNum: { fontSize: 15, fontWeight: '800' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  patientName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  priorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  notes: { fontSize: 12, color: theme.textSecondary, marginBottom: 3 },
  timestamp: { fontSize: 11, color: theme.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  scanBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
});

export default function PatientQueueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [queue, setQueue] = useState<QueuedPatient[]>([]);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('routine');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);

  // Load queue from storage
  useEffect(() => {
    AsyncStorage.getItem(QUEUE_KEY).then((raw) => {
      if (raw) {
        try { setQueue(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const saveQueue = useCallback(async (newQueue: QueuedPatient[]) => {
    setQueue(newQueue);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    Haptics.selectionAsync();
    const patient: QueuedPatient = {
      id: `q_${Date.now()}`,
      name: newName.trim(),
      priority: newPriority,
      notes: newNotes.trim(),
      queuedAt: new Date().toISOString(),
    };
    // Insert urgent at top, others at end
    const updated =
      newPriority === 'urgent'
        ? [patient, ...queue]
        : [...queue, patient];
    await saveQueue(updated);
    setNewName('');
    setNewNotes('');
    setNewPriority('routine');
    setAdding(false);
  };

  const handleScanNow = (patient: QueuedPatient) => {
    // Remove from queue then launch scan with patient name pre-filled
    const updated = queue.filter((p) => p.id !== patient.id);
    saveQueue(updated);
    router.replace({
      pathname: '/scan-workflow',
      params: { prefillName: patient.name },
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove Patient', 'Remove this patient from the queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => saveQueue(queue.filter((p) => p.id !== id)),
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear Queue', 'Remove all patients from the queue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => saveQueue([]) },
    ]);
  };

  const urgentCount = queue.filter((p) => p.priority === 'urgent').length;
  const routineCount = queue.filter((p) => p.priority === 'routine').length;
  const followupCount = queue.filter((p) => p.priority === 'followup').length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.navBackBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Patient Queue</Text>
          <Text style={styles.navSub}>{queue.length} patient{queue.length !== 1 ? 's' : ''} waiting</Text>
        </View>
        {queue.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={handleClearAll}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Stats pills */}
      <View style={styles.statsRow}>
        {[
          { label: 'Urgent', count: urgentCount, color: theme.statusRed, bg: theme.statusRedBg, icon: 'priority-high' },
          { label: 'Routine', count: routineCount, color: theme.primary, bg: theme.primary + '18', icon: 'person' },
          { label: 'Follow-up', count: followupCount, color: theme.statusYellow, bg: theme.statusYellowBg, icon: 'history' },
        ].map((s) => (
          <View key={s.label} style={[styles.statPill, { backgroundColor: s.bg, borderColor: s.color + '55' }]}>
            <MaterialIcons name={s.icon as any} size={14} color={s.color} />
            <Text style={[styles.statNum, { color: s.color }]}>{s.count}</Text>
            <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Add patient form */}
      {adding ? (
        <View style={styles.addForm}>
          <Text style={styles.addFormTitle}>ADD PATIENT TO QUEUE</Text>
          <TextInput
            style={styles.nameInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Patient name or ID..."
            placeholderTextColor={theme.textMuted}
            autoFocus
          />
          {/* Priority selector */}
          <Text style={styles.priorityLabel}>Priority Level</Text>
          <View style={styles.priorityRow}>
            {(['urgent', 'routine', 'followup'] as Priority[]).map((p) => (
              <PriorityBadge
                key={p}
                priority={p}
                selected={newPriority === p}
                onPress={() => setNewPriority(p)}
              />
            ))}
          </View>
          {/* Notes */}
          <TextInput
            style={styles.notesInput}
            value={newNotes}
            onChangeText={setNewNotes}
            placeholder="Notes (symptoms, village, age...)"
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={2}
          />
          <View style={styles.addFormBtns}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
              onPress={() => { setAdding(false); setNewName(''); setNewNotes(''); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: newPriority === 'urgent' ? theme.statusRed : theme.primary },
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleAdd}
              disabled={!newName.trim()}
            >
              <MaterialIcons name="add" size={18} color="#FFF" />
              <Text style={styles.confirmBtnText}>Add to Queue</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setAdding(true)}
        >
          <MaterialIcons name="person-add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Add Patient to Queue</Text>
        </Pressable>
      )}

      {/* Queue list */}
      {queue.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="queue" size={64} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySub}>Add patients with their priority level before scanning to track your workload.</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <QueueCard
              patient={item}
              rank={index + 1}
              onScanNow={() => handleScanNow(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Offline note */}
      <View style={[styles.offlineNote, { paddingBottom: insets.bottom + 8 }]}>
        <MaterialIcons name="wifi-off" size={14} color={theme.textMuted} />
        <Text style={styles.offlineText}>Queue stored locally · No internet required · Persists between sessions</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  navBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  navTitle: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  navSub: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.statusRedBg,
    borderWidth: 1,
    borderColor: theme.statusRed + '44',
  },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: theme.statusRed },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  statNum: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: theme.radius.medium,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  addForm: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.large,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.primary + '44',
  },
  addFormTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: theme.background,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.primary + '66',
    padding: 14,
    fontSize: 16,
    color: theme.textPrimary,
    marginBottom: 14,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  notesInput: {
    backgroundColor: theme.background,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    fontSize: 14,
    color: theme.textPrimary,
    marginBottom: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addFormBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: theme.background,
    borderRadius: theme.radius.medium,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.medium,
    padding: 13,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emptySub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  offlineText: { fontSize: 11, color: theme.textMuted },
});
