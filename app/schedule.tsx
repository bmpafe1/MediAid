// MediAid — Patient Follow-up Scheduling Calendar
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

const SCHEDULE_KEY = 'mediaid_schedule_v1';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  dateKey: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM'
  reason: string;
  priority: 'urgent' | 'routine' | 'followup';
  createdAt: string;
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: theme.statusRed, bg: theme.statusRedBg, icon: 'warning' },
  routine: { label: 'Routine', color: theme.statusGreen, bg: theme.statusGreenBg, icon: 'event' },
  followup: { label: 'Follow-up', color: theme.statusYellow, bg: theme.statusYellowBg, icon: 'refresh' },
};

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildWeeks(anchor: Date) {
  const result: { dateKey: string; label: string; weekday: string; isToday: boolean; isPast: boolean }[][] = [];
  const startOfWeek = new Date(anchor);
  startOfWeek.setDate(anchor.getDate() - anchor.getDay());
  for (let w = 0; w < 4; w++) {
    const week: typeof result[0] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + w * 7 + d);
      const today = new Date();
      week.push({
        dateKey: toDateKey(date),
        label: String(date.getDate()),
        weekday: date.toLocaleDateString([], { weekday: 'narrow' }),
        isToday: toDateKey(date) === toDateKey(today),
        isPast: date < new Date(today.setHours(0, 0, 0, 0)),
      });
    }
    result.push(week);
  }
  return result;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function AppointmentModal({
  visible,
  dateKey,
  patientName,
  patientId,
  onSave,
  onClose,
}: {
  visible: boolean;
  dateKey: string;
  patientName: string;
  patientId: string;
  onSave: (appt: Omit<Appointment, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<Appointment['priority']>('followup');

  const handleSave = () => {
    if (!reason.trim()) return;
    onSave({ patientId, patientName, dateKey, time, reason: reason.trim(), priority });
    setReason('');
    setTime('09:00');
    setPriority('followup');
  };

  const displayDate = dateKey ? new Date(dateKey + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  }) : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Schedule Appointment</Text>
          <Text style={modalStyles.dateLabel}>{displayDate}</Text>

          <View style={modalStyles.patientRow}>
            <MaterialIcons name="person" size={16} color={theme.primary} />
            <Text style={modalStyles.patientName}>{patientName}</Text>
            <Text style={modalStyles.patientId}>{patientId}</Text>
          </View>

          <Text style={modalStyles.fieldLabel}>TIME</Text>
          <View style={modalStyles.timeRow}>
            {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map((t) => (
              <Pressable
                key={t}
                style={[modalStyles.timeChip, time === t && modalStyles.timeChipActive]}
                onPress={() => setTime(t)}
              >
                <Text style={[modalStyles.timeChipText, time === t && { color: theme.primary }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={modalStyles.fieldLabel}>PRIORITY</Text>
          <View style={modalStyles.priorityRow}>
            {(Object.entries(PRIORITY_CONFIG) as [Appointment['priority'], typeof PRIORITY_CONFIG[keyof typeof PRIORITY_CONFIG]][]).map(([key, cfg]) => (
              <Pressable
                key={key}
                style={[
                  modalStyles.priorityChip,
                  { borderColor: cfg.color + '44' },
                  priority === key && { backgroundColor: cfg.bg, borderColor: cfg.color },
                ]}
                onPress={() => setPriority(key)}
              >
                <MaterialIcons name={cfg.icon as any} size={14} color={priority === key ? cfg.color : theme.textMuted} />
                <Text style={[modalStyles.priorityChipText, priority === key && { color: cfg.color }]}>{cfg.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={modalStyles.fieldLabel}>REASON / NOTES</Text>
          <TextInput
            style={modalStyles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. TB Risk follow-up, SpO2 monitoring, eye screening..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={modalStyles.btnRow}>
            <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.saveBtn, !reason.trim() && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!reason.trim()}
            >
              <MaterialIcons name="event" size={16} color="#FFF" />
              <Text style={modalStyles.saveBtnText}>Schedule</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 12,
    borderTopWidth: 1, borderColor: theme.border,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  dateLabel: { fontSize: 14, color: theme.primary, fontWeight: '600' },
  patientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.background, borderRadius: theme.radius.small, padding: 10,
  },
  patientName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  patientId: { fontSize: 11, color: theme.textMuted },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: theme.background, borderRadius: theme.radius.small,
    borderWidth: 1, borderColor: theme.border,
  },
  timeChipActive: { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
  timeChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: 8, borderRadius: theme.radius.small,
    backgroundColor: theme.background, borderWidth: 1,
  },
  priorityChipText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  reasonInput: {
    backgroundColor: theme.background, borderRadius: theme.radius.small,
    padding: 12, fontSize: 13, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.border, minHeight: 70,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, alignItems: 'center', padding: 14,
    borderRadius: theme.radius.medium, backgroundColor: theme.background,
    borderWidth: 1, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: theme.radius.medium, backgroundColor: theme.primary,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory } = useApp();
  const { patientId: prefillId, patientName: prefillName } = useLocalSearchParams<{ patientId?: string; patientName?: string }>();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [anchor] = useState(new Date());

  const weeks = useMemo(() => buildWeeks(anchor), [anchor]);

  // Determine which patient to schedule for
  const targetPatient = useMemo(() => {
    if (prefillId) {
      const scan = scanHistory.find((s) => s.patientId === prefillId);
      return { id: prefillId, name: prefillName ?? scan?.patientName ?? 'Unknown' };
    }
    const latest = scanHistory[0];
    if (latest) return { id: latest.patientId, name: latest.patientName };
    return { id: 'CHA-0000', name: 'Select Patient' };
  }, [prefillId, prefillName, scanHistory]);

  useEffect(() => {
    AsyncStorage.getItem(SCHEDULE_KEY).then((raw) => {
      if (raw) {
        try { setAppointments(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const saveAppointments = async (list: Appointment[]) => {
    setAppointments(list);
    await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(list));
  };

  const handleDayPress = (dateKey: string, isPast: boolean) => {
    if (isPast) return;
    setSelectedDate(dateKey);
    setModalVisible(true);
    Haptics.selectionAsync();
  };

  const handleSaveAppointment = (data: Omit<Appointment, 'id' | 'createdAt'>) => {
    const newAppt: Appointment = {
      ...data,
      id: `appt_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const next = [...appointments, newAppt].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    saveAppointments(next);
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteAppointment = (id: string) => {
    saveAppointments(appointments.filter((a) => a.id !== id));
  };

  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      if (!map[a.dateKey]) map[a.dateKey] = [];
      map[a.dateKey].push(a);
    });
    return map;
  }, [appointments]);

  const upcoming = useMemo(() => {
    const today = toDateKey(new Date());
    return appointments.filter((a) => a.dateKey >= today).sort((a, b) => {
      const dateComp = a.dateKey.localeCompare(b.dateKey);
      return dateComp !== 0 ? dateComp : a.time.localeCompare(b.time);
    });
  }, [appointments]);

  const monthLabel = anchor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <AppointmentModal
        visible={modalVisible}
        dateKey={selectedDate ?? ''}
        patientName={targetPatient.name}
        patientId={targetPatient.id}
        onSave={handleSaveAppointment}
        onClose={() => setModalVisible(false)}
      />

      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Follow-up Calendar</Text>
          <Text style={styles.navSub}>{targetPatient.name}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{upcoming.length} upcoming</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* Calendar grid */}
        <View style={styles.calendarCard}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>

          {/* Weekday header */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((d, i) => (
              <Text key={i} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day) => {
                const dayAppts = apptsByDate[day.dateKey] ?? [];
                const hasAppt = dayAppts.length > 0;
                const hasUrgent = dayAppts.some((a) => a.priority === 'urgent');

                return (
                  <Pressable
                    key={day.dateKey}
                    style={({ pressed }) => [
                      styles.dayCell,
                      day.isToday && styles.dayCellToday,
                      day.isPast && styles.dayCellPast,
                      hasAppt && !day.isPast && styles.dayCellHasAppt,
                      pressed && !day.isPast && { opacity: 0.7 },
                    ]}
                    onPress={() => handleDayPress(day.dateKey, day.isPast)}
                    disabled={day.isPast}
                  >
                    <Text style={[
                      styles.dayNum,
                      day.isToday && { color: '#FFF', fontWeight: '800' },
                      day.isPast && { color: theme.textMuted },
                      hasAppt && !day.isPast && !day.isToday && { color: theme.primary, fontWeight: '700' },
                    ]}>
                      {day.label}
                    </Text>
                    {hasAppt && !day.isPast && (
                      <View style={[styles.apptDot, { backgroundColor: hasUrgent ? theme.statusRed : theme.primary }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Legend */}
          <View style={styles.calLegend}>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: theme.primary }]} />
              <Text style={styles.calLegendText}>Appointment</Text>
            </View>
            <View style={styles.calLegendItem}>
              <View style={[styles.calLegendDot, { backgroundColor: theme.statusRed }]} />
              <Text style={styles.calLegendText}>Urgent</Text>
            </View>
            <View style={[styles.calLegendItem]}>
              <View style={[styles.calLegendDot, { backgroundColor: theme.primary, borderRadius: 0 }]} />
              <Text style={styles.calLegendText}>Today</Text>
            </View>
          </View>
        </View>

        {/* Upcoming appointments */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.sectionTitle}>
            UPCOMING APPOINTMENTS ({upcoming.length})
          </Text>

          {upcoming.length === 0 ? (
            <View style={styles.emptyAppts}>
              <MaterialIcons name="event-available" size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>No appointments scheduled</Text>
              <Text style={styles.emptySub}>Tap any future date on the calendar to schedule a follow-up.</Text>
            </View>
          ) : (
            upcoming.map((appt) => {
              const cfg = PRIORITY_CONFIG[appt.priority];
              const displayDate = new Date(appt.dateKey + 'T12:00:00').toLocaleDateString([], {
                weekday: 'short', month: 'short', day: 'numeric',
              });
              return (
                <View key={appt.id} style={[styles.apptCard, { borderLeftColor: cfg.color }]}>
                  <View style={[styles.apptPriorityIcon, { backgroundColor: cfg.bg }]}>
                    <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.apptHeaderRow}>
                      <Text style={styles.apptPatientName}>{appt.patientName}</Text>
                      <View style={[styles.apptPriorityBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '55' }]}>
                        <Text style={[styles.apptPriorityText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.apptId}>{appt.patientId}</Text>
                    <View style={styles.apptMetaRow}>
                      <MaterialIcons name="calendar-today" size={12} color={theme.textMuted} />
                      <Text style={styles.apptMeta}>{displayDate} at {appt.time}</Text>
                    </View>
                    <Text style={styles.apptReason}>{appt.reason}</Text>
                  </View>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteAppointment(appt.id)}
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={16} color={theme.textMuted} />
                  </Pressable>
                </View>
              );
            })
          )}
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
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  countBadge: {
    backgroundColor: theme.primary + '22', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: theme.primary },
  calendarCard: {
    backgroundColor: theme.surface, margin: 16, borderRadius: theme.radius.large,
    padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 8,
  },
  monthLabel: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: theme.textMuted },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: {
    flex: 1, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.small, gap: 3,
  },
  dayCellToday: { backgroundColor: theme.primary },
  dayCellPast: { opacity: 0.35 },
  dayCellHasAppt: { backgroundColor: theme.primary + '18', borderWidth: 1, borderColor: theme.primary + '44' },
  dayNum: { fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  apptDot: { width: 5, height: 5, borderRadius: 3 },
  calLegend: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calLegendText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8,
  },
  emptyAppts: { alignItems: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  emptySub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  apptCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  apptPriorityIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  apptHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  apptPatientName: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  apptPriorityBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  apptPriorityText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  apptId: { fontSize: 11, color: theme.textMuted, marginBottom: 4 },
  apptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  apptMeta: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  apptReason: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background,
  },
});
