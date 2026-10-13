// Native (iOS/Android) outbreak map — uses react-native-maps
// Accepts real radar rows (geohash-keyed). Village coordinates are
// configuration data — not patient data.
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type AlertLevel = 'OUTBREAK' | 'ELEVATED' | 'NORMAL';

function alertColor(level: AlertLevel) {
  if (level === 'OUTBREAK') return theme.statusRed;
  if (level === 'ELEVATED') return theme.statusYellow;
  return theme.statusGreen;
}

// Village centre coordinates — configuration, not patient data.
const GEOHASH_COORDS: Record<string, { latitude: number; longitude: number }> = {
  s0yg: { latitude: 5.897, longitude: 10.158 }, // Baligham
  s0yf: { latitude: 5.974, longitude: 10.283 }, // Bagam
  s000: { latitude: 5.960, longitude: 10.160 }, // Lab / Demo
};

// Fallback coords for unknown geohashes — centre of NW Cameroon
const FALLBACK_COORD = { latitude: 5.97, longitude: 10.19 };

export interface MapAlert {
  geohash:    string;
  village:    string;
  alertLevel: AlertLevel;
  totalScans: number;
  redCount:   number;
  dataSource: string;
}

interface Props {
  alerts:            MapAlert[];
  selectedVillage:   string | null; // geohash
  onSelectVillage:   (geohash: string) => void;
  climateLayer:      boolean;
}

export default function OutbreakMap({ alerts, selectedVillage, onSelectVillage, climateLayer }: Props) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (selectedVillage) {
      const coord = GEOHASH_COORDS[selectedVillage] ?? FALLBACK_COORD;
      mapRef.current?.animateToRegion({
        ...coord,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }, 600);
    }
  }, [selectedVillage]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType="hybrid"
        initialRegion={{
          latitude: 5.97,
          longitude: 10.19,
          latitudeDelta: 0.65,
          longitudeDelta: 0.65,
        }}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={true}
        toolbarEnabled={false}
      >
        {alerts.map((alert) => {
          const coord      = GEOHASH_COORDS[alert.geohash] ?? FALLBACK_COORD;
          const col        = alertColor(alert.alertLevel);
          const isSelected = selectedVillage === alert.geohash;
          const radius     = alert.alertLevel === 'OUTBREAK' ? 4000
                           : alert.alertLevel === 'ELEVATED' ? 2500 : 1500;

          return (
            <React.Fragment key={alert.geohash}>
              <Circle
                center={coord}
                radius={radius}
                fillColor={col + '22'}
                strokeColor={col + '88'}
                strokeWidth={1.5}
              />
              <Marker
                coordinate={coord}
                onPress={() => onSelectVillage(alert.geohash)}
                tracksViewChanges={false}
              >
                <View style={[
                  styles.markerOuter,
                  { backgroundColor: col + '22', borderColor: col, transform: [{ scale: isSelected ? 1.3 : 1 }] },
                ]}>
                  <View style={[styles.markerInner, { backgroundColor: col }]} />
                </View>
                <Callout tooltip>
                  <View style={[styles.callout, { borderColor: col + '88' }]}>
                    <Text style={[styles.calloutVillage, { color: col }]}>{alert.village}</Text>
                    <Text style={styles.calloutMeta}>
                      {alert.alertLevel} · {alert.totalScans} scans
                    </Text>
                    {alert.redCount > 0 && (
                      <Text style={[styles.calloutRed, { color: theme.statusRed }]}>
                        {alert.redCount} RED alert{alert.redCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                    {alert.dataSource !== 'field' && (
                      <Text style={styles.calloutSim}>SIMULATED DATA</Text>
                    )}
                  </View>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

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

      {climateLayer && (
        <View style={styles.climateBadge}>
          <MaterialIcons name="water-drop" size={11} color="#4488FF" />
          <Text style={styles.climateBadgeText}>Rainfall layer — Planned Q2</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16, borderRadius: theme.radius.large, overflow: 'hidden',
    marginBottom: 12, height: 260, borderWidth: 1, borderColor: theme.border,
  },
  map: { width: '100%', height: '100%' },
  markerOuter: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  markerInner: { width: 8, height: 8, borderRadius: 4 },
  callout: {
    backgroundColor: theme.surface + 'F4', borderRadius: theme.radius.medium,
    padding: 10, borderWidth: 1, minWidth: 130, alignItems: 'center', gap: 3,
  },
  calloutVillage: { fontSize: 14, fontWeight: '800' },
  calloutMeta: { fontSize: 11, color: theme.textSecondary, textAlign: 'center' },
  calloutRed: { fontSize: 10, fontWeight: '700' },
  calloutSim: { fontSize: 9, color: theme.statusYellow, fontWeight: '700', marginTop: 2 },
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
});
