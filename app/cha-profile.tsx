// MediAid — CHA (Community Health Aide) Profile Screen
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
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

const PROFILE_KEY = 'mediaid_cha_profile_v1';

interface CHAProfile {
  name: string;
  employeeId: string;
  village: string;
  district: string;
  phone: string;
  supervisor: string;
  yearsService: string;
  certificationLevel: 'Basic' | 'Intermediate' | 'Advanced';
  languages: string[];
  bio: string;
  monthlyTarget: number;
  joinDate: string;
}

const DEFAULT_PROFILE: CHAProfile = {
  name: 'Comfort Nkemdirim',
  employeeId: 'CHA-NW-2847',
  village: 'Baligham',
  district: 'Bamenda III',
  phone: '+237 677 234 567',
  supervisor: 'Dr. Emmanuel Fon',
  yearsService: '4',
  certificationLevel: 'Intermediate',
  languages: ['English', 'French', 'Yemba'],
  bio: 'Experienced Community Health Aide serving Baligham village since 2021. Trained in TB screening, malaria RDT, and maternal health outreach.',
  monthlyTarget: 30,
  joinDate: '2021-03-15',
};

const CERT_COLORS = {
  Basic: theme.statusYellow,
  Intermediate: theme.primary,
  Advanced: theme.statusGreen,
};

const CERT_ICON: Record<string, string> = {
  Basic: 'star-border',
  Intermediate: 'star-half',
  Advanced: 'star',
};

// ─── Animated Stat Counter ────────────────────────────────────────────────────
function StatCounter({
  target, label, color, icon, suffix = '',
}: {
  target: number; label: string; color: string; icon: string; suffix?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const listener = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(listener);
  }, [target]);

  return (
    <View style={[statStyles.card, { borderColor: color + '44' }]}>
      <MaterialIcons name={icon as any} size={20} color={color} />
      <Text style={[statStyles.value, { color }]}>{display}{suffix}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1,
  },
  value: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 10, color: theme.textMuted, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── Animated Progress Bar ────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View style={pbStyles.track}>
      <Animated.View
        style={[pbStyles.fill, {
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
        }]}
      />
    </View>
  );
}
const pbStyles = StyleSheet.create({
  track: { height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  visible, profile, onSave, onClose,
}: {
  visible: boolean;
  profile: CHAProfile;
  onSave: (p: CHAProfile) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<CHAProfile>(profile);

  useEffect(() => { setLocal(profile); }, [profile]);

  const set = (key: keyof CHAProfile, value: string | number) =>
    setLocal((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={editStyles.header}>
          <Text style={editStyles.title}>Edit CHA Profile</Text>
          <Pressable style={editStyles.cancelBtn} onPress={onClose}>
            <Text style={editStyles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
          {([
            { key: 'name', label: 'Full Name', placeholder: 'CHA Name' },
            { key: 'employeeId', label: 'Employee ID', placeholder: 'CHA-NW-XXXX' },
            { key: 'phone', label: 'Phone Number', placeholder: '+237 6XX XXX XXX' },
            { key: 'village', label: 'Village', placeholder: 'Village name' },
            { key: 'district', label: 'District', placeholder: 'District name' },
            { key: 'supervisor', label: 'Supervisor Name', placeholder: 'Supervisor' },
            { key: 'yearsService', label: 'Years of Service', placeholder: '0' },
          ] as { key: keyof CHAProfile; label: string; placeholder: string }[]).map((f) => (
            <View key={f.key}>
              <Text style={editStyles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={editStyles.input}
                value={String(local[f.key])}
                onChangeText={(v) => set(f.key, v)}
                placeholder={f.placeholder}
                placeholderTextColor={theme.textMuted}
              />
            </View>
          ))}

          <View>
            <Text style={editStyles.fieldLabel}>Monthly Scan Target</Text>
            <TextInput
              style={editStyles.input}
              value={String(local.monthlyTarget)}
              onChangeText={(v) => set('monthlyTarget', parseInt(v) || 0)}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View>
            <Text style={editStyles.fieldLabel}>Certification Level</Text>
            <View style={editStyles.certRow}>
              {(['Basic', 'Intermediate', 'Advanced'] as const).map((c) => (
                <Pressable
                  key={c}
                  style={[editStyles.certChip, local.certificationLevel === c && { backgroundColor: CERT_COLORS[c] + '22', borderColor: CERT_COLORS[c] }]}
                  onPress={() => set('certificationLevel', c)}
                >
                  <Text style={[editStyles.certChipText, local.certificationLevel === c && { color: CERT_COLORS[c] }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={editStyles.fieldLabel}>Bio / Notes</Text>
            <TextInput
              style={[editStyles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={local.bio}
              onChangeText={(v) => set('bio', v)}
              multiline
              placeholder="Brief CHA bio..."
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <Pressable
            style={({ pressed }) => [editStyles.saveBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSave(local);
            }}
          >
            <MaterialIcons name="save" size={20} color="#FFF" />
            <Text style={editStyles.saveBtnText}>Save Profile</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelText: { fontSize: 15, color: theme.primary, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, fontSize: 15, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.border,
  },
  certRow: { flexDirection: 'row', gap: 10 },
  certChip: {
    flex: 1, borderRadius: theme.radius.full, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1.5, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  certChipText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    paddingVertical: 16, marginTop: 8,
    shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});

// ─── Badge Component ──────────────────────────────────────────────────────────
function Badge({ label, color, icon }: { label: string; color: string; icon: string }) {
  return (
    <View style={[badgeStyles.chip, { backgroundColor: color + '18', borderColor: color + '44' }]}>
      <MaterialIcons name={icon as any} size={12} color={color} />
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CHAProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanHistory, language } = useApp();
  const [profile, setProfile] = useState<CHAProfile>(DEFAULT_PROFILE);
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (raw) {
        try { setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(raw) }); } catch {}
      }
    });
  }, []);

  const saveProfile = async (p: CHAProfile) => {
    setProfile(p);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setEditVisible(false);
  };

  // ── Performance metrics from scan history
  const total = scanHistory.length;
  const redCount = scanHistory.filter((s) => s.hasRedAlert).length;
  const syncedCount = scanHistory.filter((s) => s.synced).length;
  const redRate = total > 0 ? Math.round((redCount / total) * 100) : 0;

  // This month scans
  const now = new Date();
  const thisMonthScans = scanHistory.filter((s) => {
    const d = new Date(s.scanTimestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Last 7 days
  const last7 = scanHistory.filter((s) => {
    const d = new Date(s.scanTimestamp);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  }).length;

  const monthlyPct = Math.min(100, profile.monthlyTarget > 0 ? Math.round((thisMonthScans / profile.monthlyTarget) * 100) : 0);

  const certColor = CERT_COLORS[profile.certificationLevel];
  const certIcon = CERT_ICON[profile.certificationLevel];

  // Days since joining
  const joinDate = new Date(profile.joinDate);
  const daysActive = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

  // Training completion
  const trainingBadges = [
    { label: 'TB Screening', done: true, color: theme.statusRed },
    { label: 'Malaria RDT', done: true, color: theme.statusYellow },
    { label: 'AFib Detect', done: total > 0, color: theme.primary },
    { label: 'Eye Screening', done: total > 3, color: '#A78BFA' },
    { label: 'Tremor Assess', done: total > 5, color: '#F59E0B' },
    { label: 'DHIS2 Sync', done: syncedCount > 0, color: theme.statusGreen },
  ];
  const trainingDone = trainingBadges.filter((b) => b.done).length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <EditModal
        visible={editVisible}
        profile={profile}
        onSave={saveProfile}
        onClose={() => setEditVisible(false)}
      />

      {/* Nav */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>CHA Profile</Text>
          <Text style={styles.navSub}>Community Health Aide · NW Cameroon</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setEditVisible(true)}
        >
          <MaterialIcons name="edit" size={16} color={theme.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          {/* Avatar */}
          <View style={[styles.avatarCircle, { borderColor: certColor + '88' }]}>
            <MaterialIcons name="person" size={52} color={certColor} />
          </View>

          {/* Name & ID */}
          <Text style={styles.heroName}>{profile.name}</Text>
          <Text style={styles.heroId}>{profile.employeeId}</Text>

          {/* Cert badge */}
          <View style={[styles.certBadge, { backgroundColor: certColor + '18', borderColor: certColor + '55' }]}>
            <MaterialIcons name={certIcon as any} size={16} color={certColor} />
            <Text style={[styles.certBadgeText, { color: certColor }]}>
              {profile.certificationLevel} CHA
            </Text>
          </View>

          {/* Tags */}
          <View style={styles.tagsRow}>
            <Badge label={profile.village} color={theme.primary} icon="location-on" />
            <Badge label={profile.district} color={theme.textMuted} icon="map" />
            <Badge label={`${profile.yearsService}y exp`} color={theme.statusGreen} icon="work" />
          </View>

          {/* Languages */}
          <View style={styles.tagsRow}>
            {profile.languages.map((lang) => (
              <Badge key={lang} label={lang} color="#A78BFA" icon="language" />
            ))}
          </View>

          {/* Bio */}
          <Text style={styles.bio}>{profile.bio}</Text>

          {/* Contact */}
          <View style={styles.contactRow}>
            <MaterialIcons name="phone" size={14} color={theme.textMuted} />
            <Text style={styles.contactText}>{profile.phone}</Text>
            <View style={styles.dividerDot} />
            <MaterialIcons name="admin-panel-settings" size={14} color={theme.textMuted} />
            <Text style={styles.contactText}>{profile.supervisor}</Text>
          </View>

          {/* Join date */}
          <View style={styles.joinRow}>
            <MaterialIcons name="calendar-today" size={12} color={theme.textMuted} />
            <Text style={styles.joinText}>
              Active since {new Date(profile.joinDate).toLocaleDateString([], { month: 'long', year: 'numeric' })} · {daysActive} days
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PERFORMANCE METRICS</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCounter target={total} label="Total Scans" color={theme.primary} icon="health-and-safety" />
          <StatCounter target={redCount} label="RED Alerts" color={theme.statusRed} icon="warning" suffix="" />
          <StatCounter target={syncedCount} label="Synced" color={theme.statusGreen} icon="cloud-done" />
          <StatCounter target={last7} label="This Week" color="#A78BFA" icon="date-range" />
        </View>

        {/* Monthly target */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>MONTHLY TARGET</Text>
          <Pressable onPress={() => setEditVisible(true)}>
            <Text style={styles.editTargetText}>Edit target</Text>
          </Pressable>
        </View>
        <View style={styles.targetCard}>
          <View style={styles.targetHeader}>
            <View>
              <Text style={styles.targetNum}>{thisMonthScans}</Text>
              <Text style={styles.targetLabel}>scans this month</Text>
            </View>
            <View style={[styles.targetPct, { backgroundColor: (monthlyPct >= 100 ? theme.statusGreen : monthlyPct >= 60 ? theme.statusYellow : theme.statusRed) + '22' }]}>
              <Text style={[styles.targetPctNum, { color: monthlyPct >= 100 ? theme.statusGreen : monthlyPct >= 60 ? theme.statusYellow : theme.statusRed }]}>
                {monthlyPct}%
              </Text>
              <Text style={styles.targetPctLabel}>of target</Text>
            </View>
          </View>
          <ProgressBar
            value={thisMonthScans}
            max={profile.monthlyTarget}
            color={monthlyPct >= 100 ? theme.statusGreen : monthlyPct >= 60 ? theme.statusYellow : theme.statusRed}
          />
          <Text style={styles.targetNote}>
            {profile.monthlyTarget - thisMonthScans > 0
              ? `${profile.monthlyTarget - thisMonthScans} more scans to reach monthly target of ${profile.monthlyTarget}`
              : `Monthly target of ${profile.monthlyTarget} scans ACHIEVED`}
          </Text>
          {monthlyPct >= 100 && (
            <View style={styles.achievedBadge}>
              <MaterialIcons name="emoji-events" size={16} color={theme.statusGreen} />
              <Text style={styles.achievedText}>Monthly Target Achieved!</Text>
            </View>
          )}
        </View>

        {/* RED alert rate */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RED ALERT RATE</Text>
        </View>
        <View style={styles.redRateCard}>
          <View style={styles.redRateHeader}>
            <MaterialIcons name="warning" size={18} color={redRate > 30 ? theme.statusRed : redRate > 15 ? theme.statusYellow : theme.statusGreen} />
            <Text style={styles.redRateNum}>{redRate}%</Text>
            <Text style={styles.redRateLabel}>of scans triggered referral</Text>
          </View>
          <ProgressBar
            value={redRate}
            max={100}
            color={redRate > 30 ? theme.statusRed : redRate > 15 ? theme.statusYellow : theme.statusGreen}
          />
          <Text style={styles.redRateNote}>
            {redRate > 30
              ? 'High referral rate — possible high-risk population or low specificity. Review scan protocols.'
              : redRate > 15
              ? 'Moderate referral rate — within expected range for NW Cameroon high-burden settings.'
              : 'Low referral rate — good sensitivity. Monitor for potential underdetection.'}
          </Text>
        </View>

        {/* Training badges */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRAINING COMPLETION — {trainingDone}/{trainingBadges.length}</Text>
        </View>
        <View style={styles.trainingCard}>
          <ProgressBar value={trainingDone} max={trainingBadges.length} color={theme.statusGreen} />
          <Text style={styles.trainingSubtitle}>{trainingDone} of {trainingBadges.length} competencies certified</Text>
          <View style={styles.trainingGrid}>
            {trainingBadges.map((b) => (
              <View
                key={b.label}
                style={[
                  styles.trainingBadge,
                  {
                    backgroundColor: b.done ? b.color + '18' : theme.surface,
                    borderColor: b.done ? b.color + '55' : theme.border,
                  },
                ]}
              >
                <MaterialIcons
                  name={b.done ? 'verified' : 'radio-button-unchecked'}
                  size={16}
                  color={b.done ? b.color : theme.textMuted}
                />
                <Text style={[styles.trainingBadgeText, { color: b.done ? b.color : theme.textMuted }]}>
                  {b.label}
                </Text>
              </View>
            ))}
          </View>
          {trainingDone === trainingBadges.length && (
            <View style={styles.fullCertCard}>
              <MaterialIcons name="workspace-premium" size={24} color={theme.statusGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fullCertTitle}>Fully Certified CHA</Text>
                <Text style={styles.fullCertSub}>All 6 MediAid competencies verified</Text>
              </View>
            </View>
          )}
        </View>

        {/* UNICEF Impact summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>UNICEF IMPACT CONTRIBUTION</Text>
        </View>
        <View style={styles.impactCard}>
          {[
            { icon: 'people', label: 'Patients screened', value: String(total), color: theme.primary },
            { icon: 'local-hospital', label: 'RED alerts caught', value: String(redCount), color: theme.statusRed },
            { icon: 'attach-money', label: 'Est. cost savings', value: `$${(total * 4.2).toFixed(0)}`, color: theme.statusGreen },
            { icon: 'cloud-done', label: 'Records synced', value: String(syncedCount), color: '#A78BFA' },
          ].map((item) => (
            <View key={item.label} style={[styles.impactRow, { borderColor: item.color + '33' }]}>
              <View style={[styles.impactIconCircle, { backgroundColor: item.color + '18' }]}>
                <MaterialIcons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.impactLabel}>{item.label}</Text>
              <Text style={[styles.impactValue, { color: item.color }]}>{item.value}</Text>
            </View>
          ))}
          <Text style={styles.impactNote}>
            $4.20 per patient screened vs $42 clinic cost · Based on WHO economic modelling · UNICEF Venture Fund 2025
          </Text>
        </View>

        {/* Quick actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.actionsGrid}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { borderColor: theme.primary + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/training-quiz')}
          >
            <MaterialIcons name="quiz" size={22} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Take Training{'\n'}Quiz</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { borderColor: theme.statusGreen + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/supervisor')}
          >
            <MaterialIcons name="admin-panel-settings" size={22} color={theme.statusGreen} />
            <Text style={[styles.actionBtnText, { color: theme.statusGreen }]}>Supervisor{'\n'}Panel</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { borderColor: theme.statusRed + '44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/daily-report')}
          >
            <MaterialIcons name="summarize" size={22} color={theme.statusRed} />
            <Text style={[styles.actionBtnText, { color: theme.statusRed }]}>Daily{'\n'}Report</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { borderColor: '#A78BFA44' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/impact-dashboard')}
          >
            <MaterialIcons name="insights" size={22} color="#A78BFA" />
            <Text style={[styles.actionBtnText, { color: '#A78BFA' }]}>Impact{'\n'}Dashboard</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          MediAid v1.0 · CHA Profile · UNICEF Venture Fund 2025 · NW Cameroon
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
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: theme.primary },

  // Hero
  heroCard: {
    backgroundColor: theme.surface, margin: 16,
    borderRadius: theme.radius.large, padding: 24,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: theme.border,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: theme.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  heroName: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  heroId: { fontSize: 13, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  certBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, marginTop: 4,
  },
  certBadgeText: { fontSize: 14, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  bio: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  contactText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  dividerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.border },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  joinText: { fontSize: 11, color: theme.textMuted },

  // Sections
  sectionHeader: { paddingHorizontal: 16, marginBottom: 8, marginTop: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8, marginTop: 8 },
  sectionTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  editTargetText: { fontSize: 12, color: theme.primary, fontWeight: '600' },

  // Stats
  statsGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },

  // Target
  targetCard: {
    backgroundColor: theme.surface, marginHorizontal: 16,
    borderRadius: theme.radius.medium, padding: 16,
    borderWidth: 1, borderColor: theme.border, gap: 10, marginBottom: 8,
  },
  targetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  targetNum: { fontSize: 36, fontWeight: '800', color: theme.textPrimary },
  targetLabel: { fontSize: 12, color: theme.textMuted, fontWeight: '600', marginTop: 2 },
  targetPct: { borderRadius: theme.radius.medium, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  targetPctNum: { fontSize: 24, fontWeight: '800' },
  targetPctLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  targetNote: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  achievedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
    alignSelf: 'center',
  },
  achievedText: { fontSize: 13, fontWeight: '700', color: theme.statusGreen },

  // Red rate
  redRateCard: {
    backgroundColor: theme.surface, marginHorizontal: 16,
    borderRadius: theme.radius.medium, padding: 16,
    borderWidth: 1, borderColor: theme.border, gap: 10, marginBottom: 8,
  },
  redRateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redRateNum: { fontSize: 28, fontWeight: '800', color: theme.textPrimary },
  redRateLabel: { fontSize: 12, color: theme.textMuted, flex: 1 },
  redRateNote: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },

  // Training
  trainingCard: {
    backgroundColor: theme.surface, marginHorizontal: 16,
    borderRadius: theme.radius.medium, padding: 16,
    borderWidth: 1, borderColor: theme.border, gap: 12, marginBottom: 8,
  },
  trainingSubtitle: { fontSize: 12, color: theme.textMuted },
  trainingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trainingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1,
  },
  trainingBadgeText: { fontSize: 11, fontWeight: '600' },
  fullCertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  fullCertTitle: { fontSize: 15, fontWeight: '700', color: theme.statusGreen },
  fullCertSub: { fontSize: 12, color: theme.statusGreen + 'AA', marginTop: 2 },

  // Impact
  impactCard: {
    backgroundColor: theme.surface, marginHorizontal: 16,
    borderRadius: theme.radius.medium, padding: 14,
    borderWidth: 1, borderColor: theme.border, gap: 8, marginBottom: 8,
  },
  impactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: theme.radius.small, padding: 10,
    borderWidth: 1,
  },
  impactIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  impactLabel: { flex: 1, fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
  impactValue: { fontSize: 18, fontWeight: '800' },
  impactNote: { fontSize: 10, color: theme.textMuted, lineHeight: 16 },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  actionBtn: {
    width: '47%', flexGrow: 1,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 8, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 18 },

  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 18, marginBottom: 8 },
});
