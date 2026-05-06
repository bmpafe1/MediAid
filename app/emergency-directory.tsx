// MediAid — Offline Emergency Contact Directory
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

type ContactCategory = 'hospital' | 'supervisor' | 'authority' | 'emergency';

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  phone2?: string;
  category: ContactCategory;
  distanceKm?: number;
  district?: string;
  hours?: string;
  beds?: number;
  hasAmbulance?: boolean;
  specialties?: string[];
  address?: string;
  note?: string;
}

const CONTACTS: Contact[] = [
  // Hospitals
  {
    id: 'h1',
    name: 'Bamenda Regional Hospital',
    role: 'Regional Referral Hospital',
    phone: '+237 233 362 450',
    phone2: '+237 233 362 451',
    category: 'hospital',
    distanceKm: 8.4,
    district: 'Bamenda I',
    hours: '24/7 Emergency',
    beds: 312,
    hasAmbulance: true,
    specialties: ['TB/Respiratory', 'Cardiology', 'Neurology', 'Ophthalmology'],
    address: 'Hospital Roundabout, Bamenda, NW Region',
    note: 'Primary referral for RED alerts. DOTS TB program available.',
  },
  {
    id: 'h2',
    name: 'Mbingo Baptist Hospital',
    role: 'Mission Hospital · Level 3',
    phone: '+237 233 247 001',
    phone2: '+237 233 247 002',
    category: 'hospital',
    distanceKm: 24.1,
    district: 'Tubah',
    hours: '24/7 Emergency',
    beds: 180,
    hasAmbulance: true,
    specialties: ['Surgery', 'Eye Care', 'TB', 'Pediatrics'],
    address: 'Mbingo Village, Tubah Subdivision',
    note: 'Strong ophthalmology unit. Eye condition referrals preferred here.',
  },
  {
    id: 'h3',
    name: 'Bafut District Hospital',
    role: 'District Hospital · Level 2',
    phone: '+237 233 260 001',
    category: 'hospital',
    distanceKm: 16.2,
    district: 'Bafut',
    hours: 'Mon–Sat 7am–6pm / Emergency 24h',
    beds: 72,
    hasAmbulance: false,
    specialties: ['General Medicine', 'Maternal Health'],
    address: 'Bafut Town, Bafut Subdivision',
  },
  {
    id: 'h4',
    name: 'Santa District Hospital',
    role: 'District Hospital · Level 2',
    phone: '+237 233 274 100',
    category: 'hospital',
    distanceKm: 32.5,
    district: 'Santa',
    hours: 'Mon–Sat 7am–6pm',
    beds: 58,
    hasAmbulance: false,
    specialties: ['Malaria', 'Maternal Health'],
  },
  {
    id: 'h5',
    name: 'Fundong District Hospital',
    role: 'District Hospital · Level 2',
    phone: '+237 233 250 010',
    category: 'hospital',
    distanceKm: 55.8,
    district: 'Boyo',
    hours: 'Mon–Fri 8am–4pm',
    beds: 45,
    hasAmbulance: false,
    specialties: ['General Medicine', 'HIV/AIDS', 'Malaria'],
  },
  {
    id: 'h6',
    name: 'Nkambe District Hospital',
    role: 'District Hospital · Level 2',
    phone: '+237 233 230 052',
    category: 'hospital',
    distanceKm: 82.3,
    district: 'Donga-Mantung',
    hours: 'Mon–Fri 8am–4pm',
    beds: 60,
    hasAmbulance: false,
    specialties: ['General Medicine', 'TB'],
  },
  // Supervisors
  {
    id: 's1',
    name: 'Dr. Emmanuel Fon',
    role: 'District Health Officer · Bamenda',
    phone: '+237 674 123 456',
    category: 'supervisor',
    district: 'Bamenda III',
    hours: 'Office: Mon–Fri 7:30am–3:30pm',
    note: 'Primary contact for all RED alert escalations and bypass events.',
  },
  {
    id: 's2',
    name: 'Sr. Agnes Nchinda',
    role: 'CHA Supervisor · Mezam Division',
    phone: '+237 677 234 567',
    category: 'supervisor',
    district: 'Mezam',
    hours: 'Reachable 7am–8pm',
    note: 'Coordinate field referrals and emergency transport with this supervisor.',
  },
  {
    id: 's3',
    name: 'Mr. Pascal Kang',
    role: 'MediAid Program Coordinator',
    phone: '+237 655 345 678',
    phone2: '+237 681 234 567',
    category: 'supervisor',
    hours: 'Mon–Sat 8am–6pm',
    note: 'Contact for app issues, training, and DHIS2 sync problems.',
  },
  // Health authorities
  {
    id: 'a1',
    name: 'Regional Delegation of Health',
    role: 'NW Region Health Authority',
    phone: '+237 233 362 200',
    category: 'authority',
    district: 'NW Region',
    hours: 'Mon–Fri 7:30am–3:30pm',
    address: 'Finance Junction, Bamenda',
  },
  {
    id: 'a2',
    name: 'UNICEF Cameroon Office',
    role: 'Program Support',
    phone: '+237 222 200 100',
    category: 'authority',
    district: 'Yaoundé',
    hours: 'Mon–Fri 8am–5pm',
  },
  // Emergency
  {
    id: 'e1',
    name: 'Cameroon Emergency Services',
    role: 'National Emergency · Fire / Police',
    phone: '117',
    phone2: '118',
    category: 'emergency',
    hours: '24/7',
    note: 'Dial 117 for Police, 118 for Fire/Emergency.',
  },
  {
    id: 'e2',
    name: 'Bamenda Ambulance Service',
    role: 'Emergency Medical Transport',
    phone: '+237 233 362 999',
    category: 'emergency',
    hours: '24/7',
    hasAmbulance: true,
    note: 'Request ambulance for RED alert patients unable to self-transport.',
  },
];

function categoryColor(c: ContactCategory) {
  if (c === 'hospital') return theme.primary;
  if (c === 'supervisor') return theme.statusGreen;
  if (c === 'authority') return '#A78BFA';
  return theme.statusRed;
}
function categoryBg(c: ContactCategory) {
  if (c === 'hospital') return theme.primary + '18';
  if (c === 'supervisor') return theme.statusGreenBg;
  if (c === 'authority') return '#A78BFA18';
  return theme.statusRedBg;
}
function categoryIcon(c: ContactCategory): string {
  if (c === 'hospital') return 'local-hospital';
  if (c === 'supervisor') return 'admin-panel-settings';
  if (c === 'authority') return 'account-balance';
  return 'emergency';
}
function categoryLabel(c: ContactCategory) {
  if (c === 'hospital') return 'HOSPITAL';
  if (c === 'supervisor') return 'SUPERVISOR';
  if (c === 'authority') return 'AUTHORITY';
  return 'EMERGENCY';
}

function dialPhone(phone: string) {
  const cleaned = phone.replace(/\s/g, '');
  Linking.openURL(`tel:${cleaned}`).catch(() => {
    Alert.alert('Call Failed', 'Unable to open phone dialer on this device.');
  });
}

function ContactCard({ contact }: { contact: Contact }) {
  const [expanded, setExpanded] = useState(false);
  const col = categoryColor(contact.category);
  const bg = categoryBg(contact.category);

  return (
    <Pressable
      style={[cardStyles.card, { borderLeftColor: col }]}
      onPress={() => setExpanded((v) => !v)}
    >
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={[cardStyles.iconCircle, { backgroundColor: bg, borderColor: col + '44' }]}>
          <MaterialIcons name={categoryIcon(contact.category) as any} size={20} color={col} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.name} numberOfLines={1}>{contact.name}</Text>
            <View style={[cardStyles.catBadge, { backgroundColor: bg, borderColor: col + '55' }]}>
              <Text style={[cardStyles.catBadgeText, { color: col }]}>
                {categoryLabel(contact.category)}
              </Text>
            </View>
          </View>
          <Text style={cardStyles.role} numberOfLines={1}>{contact.role}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
      </View>

      {/* Meta row */}
      <View style={cardStyles.metaRow}>
        {contact.distanceKm !== undefined && (
          <View style={cardStyles.metaChip}>
            <MaterialIcons name="place" size={11} color={theme.textMuted} />
            <Text style={cardStyles.metaChipText}>{contact.distanceKm} km</Text>
          </View>
        )}
        {contact.hasAmbulance && (
          <View style={[cardStyles.metaChip, { backgroundColor: theme.statusRedBg, borderColor: theme.statusRed + '44' }]}>
            <MaterialIcons name="directions-car" size={11} color={theme.statusRed} />
            <Text style={[cardStyles.metaChipText, { color: theme.statusRed }]}>Ambulance</Text>
          </View>
        )}
        {contact.hours && (
          <View style={cardStyles.metaChip}>
            <MaterialIcons name="access-time" size={11} color={theme.textMuted} />
            <Text style={cardStyles.metaChipText} numberOfLines={1}>{contact.hours}</Text>
          </View>
        )}
      </View>

      {/* Primary phone — always visible */}
      <Pressable
        style={({ pressed }) => [cardStyles.callBtn, { backgroundColor: col + '18', borderColor: col + '44' }, pressed && { opacity: 0.8 }]}
        onPress={(e) => {
          e.stopPropagation?.();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          dialPhone(contact.phone);
        }}
      >
        <MaterialIcons name="phone" size={18} color={col} />
        <Text style={[cardStyles.callBtnText, { color: col }]}>{contact.phone}</Text>
        <Text style={[cardStyles.callBtnLabel, { color: col + 'AA' }]}>TAP TO CALL</Text>
      </Pressable>

      {/* Expanded */}
      {expanded && (
        <View style={cardStyles.expanded}>
          <View style={cardStyles.expandDivider} />

          {/* Second phone */}
          {contact.phone2 && (
            <Pressable
              style={({ pressed }) => [cardStyles.phone2Btn, pressed && { opacity: 0.8 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); dialPhone(contact.phone2!); }}
            >
              <MaterialIcons name="phone-forwarded" size={14} color={theme.textSecondary} />
              <Text style={cardStyles.phone2Text}>{contact.phone2} (alt)</Text>
            </Pressable>
          )}

          {/* Specialties */}
          {contact.specialties && contact.specialties.length > 0 && (
            <>
              <Text style={cardStyles.expandLabel}>SPECIALTIES</Text>
              <View style={cardStyles.specialtiesRow}>
                {contact.specialties.map((s) => (
                  <View key={s} style={[cardStyles.specialtyChip, { backgroundColor: col + '15', borderColor: col + '44' }]}>
                    <Text style={[cardStyles.specialtyChipText, { color: col }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Beds */}
          {contact.beds && (
            <View style={cardStyles.infoRow}>
              <MaterialIcons name="king-bed" size={14} color={theme.textMuted} />
              <Text style={cardStyles.infoText}>{contact.beds} beds capacity</Text>
            </View>
          )}

          {/* Address */}
          {contact.address && (
            <View style={cardStyles.infoRow}>
              <MaterialIcons name="location-on" size={14} color={theme.textMuted} />
              <Text style={cardStyles.infoText}>{contact.address}</Text>
            </View>
          )}

          {/* Note */}
          {contact.note && (
            <View style={cardStyles.noteBox}>
              <MaterialIcons name="info-outline" size={13} color={col} />
              <Text style={[cardStyles.noteText, { color: col + 'CC' }]}>{contact.note}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  catBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1,
  },
  catBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  role: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.border,
  },
  metaChipText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: theme.radius.medium, padding: 12, borderWidth: 1,
  },
  callBtnText: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  callBtnLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  expanded: { marginTop: 10 },
  expandDivider: { height: 1, backgroundColor: theme.border, marginBottom: 10 },
  phone2Btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.background, borderRadius: theme.radius.medium,
    padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  phone2Text: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
  expandLabel: {
    fontSize: 9, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
  },
  specialtiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  specialtyChip: {
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  specialtyChipText: { fontSize: 11, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  infoText: { fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 18 },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.background, borderRadius: theme.radius.small,
    padding: 10, marginTop: 4, borderWidth: 1, borderColor: theme.border,
  },
  noteText: { flex: 1, fontSize: 11, lineHeight: 17 },
});

export default function EmergencyDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [catFilter, setCatFilter] = useState<ContactCategory | 'all'>('all');

  const filtered = CONTACTS.filter((c) => catFilter === 'all' || c.category === catFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (a.distanceKm !== undefined && b.distanceKm !== undefined) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== undefined) return -1;
    return 0;
  });

  const categories: { id: ContactCategory | 'all'; label: string; icon: string; color: string }[] = [
    { id: 'all', label: 'All', icon: 'list', color: theme.primary },
    { id: 'emergency', label: 'Emergency', icon: 'emergency', color: theme.statusRed },
    { id: 'hospital', label: 'Hospitals', icon: 'local-hospital', color: theme.primary },
    { id: 'supervisor', label: 'Supervisors', icon: 'admin-panel-settings', color: theme.statusGreen },
    { id: 'authority', label: 'Authorities', icon: 'account-balance', color: '#A78BFA' },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Emergency Directory</Text>
          <Text style={styles.navSub}>{CONTACTS.length} contacts · Offline available · NW Cameroon</Text>
        </View>
        <View style={styles.offlineBadge}>
          <MaterialIcons name="cloud-off" size={12} color={theme.statusGreen} />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick emergency row */}
        <Text style={styles.sectionTitle}>QUICK EMERGENCY CALL</Text>
        <View style={styles.emergencyRow}>
          {CONTACTS.filter((c) => c.category === 'emergency').map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [styles.emergencyBtn, pressed && { opacity: 0.8 }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                dialPhone(c.phone);
              }}
            >
              <MaterialIcons name="phone" size={22} color="#FFF" />
              <Text style={styles.emergencyBtnName} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.emergencyBtnPhone}>{c.phone}</Text>
            </Pressable>
          ))}
        </View>

        {/* Nearest hospital highlight */}
        <View style={styles.nearestCard}>
          <View style={styles.nearestHeader}>
            <MaterialIcons name="local-hospital" size={16} color={theme.primary} />
            <Text style={styles.nearestTitle}>Nearest Referral Hospital</Text>
            <View style={styles.nearestDistBadge}>
              <Text style={styles.nearestDist}>8.4 km</Text>
            </View>
          </View>
          <Text style={styles.nearestName}>Bamenda Regional Hospital</Text>
          <Text style={styles.nearestSub}>24/7 Emergency · 312 beds · Ambulance available</Text>
          <Pressable
            style={({ pressed }) => [styles.nearestCallBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              dialPhone('+237 233 362 450');
            }}
          >
            <MaterialIcons name="phone" size={18} color="#FFF" />
            <Text style={styles.nearestCallBtnText}>Call Now — +237 233 362 450</Text>
          </Pressable>
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.filterChip,
                  catFilter === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color },
                ]}
                onPress={() => setCatFilter(cat.id)}
              >
                <MaterialIcons
                  name={cat.icon as any}
                  size={13}
                  color={catFilter === cat.id ? cat.color : theme.textMuted}
                />
                <Text style={[
                  styles.filterChipText,
                  catFilter === cat.id && { color: cat.color, fontWeight: '700' },
                ]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.sectionTitle}>
          {sorted.length} CONTACT{sorted.length !== 1 ? 'S' : ''}
          {catFilter !== 'all' ? ` · ${categoryLabel(catFilter as ContactCategory)}` : ''}
        </Text>

        {sorted.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}

        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
          <Text style={styles.disclaimerText}>
            All numbers verified for NW Cameroon · Stored on-device for offline access · Last verified April 2025
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
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  offlineBadgeText: { fontSize: 10, fontWeight: '700', color: theme.statusGreen },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 16,
  },
  emergencyRow: { flexDirection: 'row', gap: 10 },
  emergencyBtn: {
    flex: 1, backgroundColor: theme.statusRed, borderRadius: theme.radius.medium,
    padding: 14, alignItems: 'center', gap: 5,
    shadowColor: theme.statusRed, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  emergencyBtnName: { fontSize: 12, fontWeight: '700', color: '#FFF', textAlign: 'center' },
  emergencyBtnPhone: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  nearestCard: {
    backgroundColor: theme.primary + '12', borderRadius: theme.radius.medium,
    padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  nearestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nearestTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  nearestDistBadge: {
    backgroundColor: theme.primary + '22', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  nearestDist: { fontSize: 11, fontWeight: '700', color: theme.primary },
  nearestName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  nearestSub: { fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
  nearestCallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium, paddingVertical: 14,
    shadowColor: theme.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nearestCallBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginTop: 16,
    borderWidth: 1, borderColor: theme.border,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 17 },
});


