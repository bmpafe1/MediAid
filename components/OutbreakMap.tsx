// Web fallback outbreak map — no react-native-maps dependency
// Uses a styled View with village pins positioned over a background
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type RiskLevel = 'High' | 'Medium' | 'Low';

function riskColor(level: RiskLevel) {
  if (level === 'High') return theme.statusRed;
  if (level === 'Medium') return theme.statusYellow;
  return theme.statusGreen;
}

// Rough relative positions within NW Cameroon bounding box
const VILLAGE_POSITIONS: Record<string, { top: string; left: string }> = {
  Baligham: { top: '52%', left: '34%' },
  Bagam:    { top: '38%', left: '58%' },
  Bambui:   { top: '63%', left: '40%' },
  Fundong:  { top: '18%', left: '24%' },
};

interface Alert {
  village: string;
  condition: string;
  riskLevel: RiskLevel;
}

interface Props {
  alerts: Alert[];
  selectedVillage: string | null;
  onSelectVillage: (v: string) => void;
  climateLayer: boolean;
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
        const pos = VILLAGE_POSITIONS[alert.village];
        if (!pos) return null;
        const col = riskColor(alert.riskLevel);
        const isSelected = selectedVillage === alert.village;
        return (
          <Pressable
            key={alert.village}
            style={[styles.pin, { top: pos.top, left: pos.left }]}
            onPress={() => onSelectVillage(alert.village)}
          >
            {/* Radius circle */}
            <View style={[styles.radiusCircle, {
              borderColor: col + '66',
              backgroundColor: col + '18',
              width: isSelected ? 64 : 48,
              height: isSelected ? 64 : 48,
              borderRadius: isSelected ? 32 : 24,
              marginLeft: isSelected ? -32 : -24,
              marginTop: isSelected ? -32 : -24,
            }]} />
            {/* Dot */}
            <View style={[styles.dot, {
              backgroundColor: col,
              width: isSelected ? 18 : 14,
              height: isSelected ? 18 : 14,
              borderRadius: isSelected ? 9 : 7,
            }]} />
            {/* Label */}
            <View style={[styles.labelBox, { backgroundColor: col + '22', borderColor: col + '55' }]}>
              <Text style={[styles.labelText, { color: col }]}>{alert.village}</Text>
              {isSelected && (
                <Text style={[styles.labelSub, { color: col }]}>{alert.riskLevel} Risk</Text>
              )}
            </View>
          </Pressable>
        );
      })}

      {/* Climate overlay hint */}
      {climateLayer && (
        <View style={styles.climateBadge}>
          <MaterialIcons name="water-drop" size={11} color="#4488FF" />
          <Text style={styles.climateBadgeText}>Rainfall overlay active</Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: theme.statusRed, label: 'Outbreak' },
          { color: theme.statusYellow, label: 'Watch' },
          { color: theme.statusGreen, label: 'Normal' },
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
    marginHorizontal: 16,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    marginBottom: 12,
    height: 260,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#0B1E2E',
    position: 'relative',
  },
  mapBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#081522',
  },
  mapBgLabel: {
    fontSize: 18, fontWeight: '800', color: '#1E3A4A', letterSpacing: 3,
  },
  mapBgSub: { fontSize: 11, color: '#1A2E3A', fontWeight: '600', letterSpacing: 1 },
  pin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusCircle: {
    position: 'absolute',
    borderWidth: 1,
  },
  dot: {
    borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  labelBox: {
    borderRadius: theme.radius.small, paddingHorizontal: 6, paddingVertical: 3,
    marginTop: 4, borderWidth: 1, alignItems: 'center',
  },
  labelText: { fontSize: 10, fontWeight: '700' },
  labelSub: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  legend: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: theme.background + 'EE',
    borderRadius: theme.radius.small, padding: 8,
    gap: 4, borderWidth: 1, borderColor: theme.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: theme.textSecondary, fontWeight: '600' },
  climateBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#001833CC', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#4488FF44',
  },
  climateBadgeText: { fontSize: 10, color: '#4488FF', fontWeight: '700' },
  mapNote: {
    position: 'absolute', bottom: 8, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  mapNoteText: { fontSize: 9, color: theme.textMuted },
});
