// Web fallback outbreak map — no react-native-maps dependency
// Accepts real radar rows (geohash-keyed). Village positions are
// rough relative coordinates within the NW Cameroon bounding box.
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type AlertLevel = 'OUTBREAK' | 'ELEVATED' | 'NORMAL';

function alertColor(level: AlertLevel) {
  if (level === 'OUTBREAK') return theme.statusRed;
  if (level === 'ELEVATED') return theme.statusYellow;
  return theme.statusGreen;
}

// Rough relative positions within the NW Cameroon bounding box.
// These are display config, not patient data.
const GEOHASH_POSITIONS: Record<string, { top: string; left: string }> = {
  s0yg: { top: '52%', left: '34%' }, // Baligham
  s0yf: { top: '38%', left: '58%' }, // Bagam
  s000: { top: '55%', left: '45%' }, // Lab / Demo
};

const FALLBACK_POSITION = { top: '50%', left: '50%' };

export interface MapAlert {
  geohash:    string;
  village:    string;
  alertLevel: AlertLevel;
  totalScans: number;
  redCount:   number;
  dataSource: string;
}

interface Props {
  alerts:          MapAlert[];
  selectedVillage: string | null; // geohash
  onSelectVillage: (geohash: string) => void;
  climateLayer:    boolean;
}

export default function OutbreakMap({ alerts, selectedVillage, onSelectVillage, climateLayer }: Props) {
  return (
    <View style={styles.container}>
      {/* Stylised map background */}
      <View style={styles.mapBg}>
        <Text style={styles.mapBgLabel}>NW CAMEROON</Text>
        <Text style={styles.mapBgSub}>Bamenda · Northwest Region</Text>
      </View>

      {/* Village pins */}
      {alerts.map((alert) => {
        const pos        = GEOHASH_POSITIONS[alert.geohash] ?? FALLBACK_POSITION;
        const col        = alertColor(alert.alertLevel);
        const isSelected = selectedVillage === alert.geohash;
        return (
          <Pressable
            key={alert.geohash}
            style={[styles.pin, { top: pos.top as any, left: pos.left as any }]}
            onPress={() => onSelectVillage(alert.geohash)}
          >
            {/* Radius circle */}
            <View style={[styles.radiusCircle, {
              borderColor: col + '66', backgroundColor: col + '18',
              width:  isSelected ? 64 : 48,
              height: isSelected ? 64 : 48,
              borderRadius: isSelected ? 32 : 24,
              marginLeft: isSelected ? -32 : -24,
              marginTop:  isSelected ? -32 : -24,
            }]} />
            {/* Dot */}
            <View style={[styles.dot, {
              backgroundColor: col,
              width:  isSelected ? 18 : 14,
              height: isSelected ? 18 : 14,
              borderRadius: isSelected ? 9 : 7,
            }]} />
            {/* Label */}
            <View style={[styles.labelBox, { backgroundColor: col + '22', borderColor: col + '55' }]}>
              <Text style={[styles.labelText, { color: col }]}>{alert.village}</Text>
              {isSelected && (
                <>
                  <Text style={[styles.labelSub, { color: col }]}>
                    {alert.alertLevel} · {alert.totalScans} scans
                  </Text>
                  {alert.dataSource !== 'field' && (
                    <Text style={styles.labelSimTag}>SIMULATED</Text>
                  )}
                </>
              )}
            </View>
          </Pressable>
        );
      })}

      {/* Climate overlay hint */}
      {climateLayer && (
        <View style={styles.climateBadge}>
          <MaterialIcons name="water-drop" size={11} color="#4488FF" />
          <Text style={styles.climateBadgeText}>Rainfall layer — Planned Q2</Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: theme.statusRed,    label: 'Outbreak' },
          { color: theme.statusYellow, label: 'Elevated' },
          { color: theme.statusGreen,  label: 'Normal'   },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Map note */}
      <View style={styles.mapNote}>
        <MaterialIcons name="info-outline" size={10} color={theme.textMuted} />
        <Text style={styles.mapNoteText}>Interactive map on iOS/Android</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16, borderRadius: theme.radius.large, overflow: 'hidden',
    marginBottom: 12, height: 260, borderWidth: 1, borderColor: theme.border,
    backgroundColor: '#0B1E2E', position: 'relative',
  },
  mapBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#081522',
  },
  mapBgLabel: { fontSize: 18, fontWeight: '800', color: '#1E3A4A', letterSpacing: 3 },
  mapBgSub: { fontSize: 11, color: '#1A2E3A', fontWeight: '600', letterSpacing: 1 },
  pin: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  radiusCircle: { position: 'absolute', borderWidth: 1 },
  dot: { borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },
  labelBox: { borderRadius: theme.radius.small, paddingHorizontal: 6, paddingVertical: 3, marginTop: 4, borderWidth: 1, alignItems: 'center' },
  labelText: { fontSize: 10, fontWeight: '700' },
  labelSub: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  labelSimTag: { fontSize: 8, fontWeight: '800', color: theme.statusYellow, marginTop: 1 },
  legend: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: theme.background + 'EE', borderRadius: theme.radius.small,
    padding: 8, gap: 4, borderWidth: 1, borderColor: theme.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: theme.textSecondary, fontWeight: '600' },
  climateBadge: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#001833CC', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#4488FF44',
  },
  climateBadgeText: { fontSize: 10, color: '#4488FF', fontWeight: '700' },
  mapNote: { position: 'absolute', bottom: 8, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapNoteText: { fontSize: 9, color: theme.textMuted },
});
