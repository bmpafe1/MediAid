// Native (iOS/Android) outbreak map — uses react-native-maps
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/constants/theme';

type RiskLevel = 'High' | 'Medium' | 'Low';

function riskColor(level: RiskLevel) {
  if (level === 'High') return theme.statusRed;
  if (level === 'Medium') return theme.statusYellow;
  return theme.statusGreen;
}

const VILLAGE_COORDS: Record<string, { latitude: number; longitude: number }> = {
  Baligham: { latitude: 5.897, longitude: 10.158 },
  Bagam:    { latitude: 5.974, longitude: 10.283 },
  Bambui:   { latitude: 5.920, longitude: 10.134 },
  Fundong:  { latitude: 6.238, longitude: 10.179 },
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
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (selectedVillage && VILLAGE_COORDS[selectedVillage]) {
      mapRef.current?.animateToRegion({
        ...VILLAGE_COORDS[selectedVillage],
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
          const coord = VILLAGE_COORDS[alert.village];
          if (!coord) return null;
          const col = riskColor(alert.riskLevel);
          const isSelected = selectedVillage === alert.village;
          const radiusMeters = alert.riskLevel === 'High' ? 4000 : alert.riskLevel === 'Medium' ? 2500 : 1500;

          return (
            <React.Fragment key={alert.village}>
              <Circle
                center={coord}
                radius={radiusMeters}
                fillColor={col + '22'}
                strokeColor={col + '88'}
                strokeWidth={1.5}
              />
              {climateLayer && (
                <Circle
                  center={coord}
                  radius={radiusMeters * 1.5}
                  fillColor={'#4488FF11'}
                  strokeColor={'#4488FF44'}
                  strokeWidth={1}
                />
              )}
              <Marker
                coordinate={coord}
                onPress={() => onSelectVillage(alert.village)}
                tracksViewChanges={false}
              >
                <View style={[
                  styles.markerOuter,
                  {
                    backgroundColor: col + '22',
                    borderColor: col,
                    transform: [{ scale: isSelected ? 1.3 : 1 }],
                  },
                ]}>
                  <View style={[styles.markerInner, { backgroundColor: col }]} />
                </View>
                <Callout tooltip>
                  <View style={[styles.callout, { borderColor: col + '88' }]}>
                    <Text style={[styles.calloutVillage, { color: col }]}>{alert.village}</Text>
                    <Text style={styles.calloutCondition}>{alert.condition}</Text>
                    <View style={[styles.calloutBadge, { backgroundColor: col + '22', borderColor: col + '55' }]}>
                      <Text style={[styles.calloutBadgeText, { color: col }]}>{alert.riskLevel} Risk</Text>
                    </View>
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

      {climateLayer && (
        <View style={styles.climateBadge}>
          <MaterialIcons name="water-drop" size={11} color="#4488FF" />
          <Text style={styles.climateBadgeText}>Rainfall overlay active</Text>
        </View>
      )}
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
  },
  map: { width: '100%', height: '100%' },
  markerOuter: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  markerInner: { width: 8, height: 8, borderRadius: 4 },
  callout: {
    backgroundColor: theme.surface + 'F4',
    borderRadius: theme.radius.medium,
    padding: 10,
    borderWidth: 1,
    minWidth: 120,
    alignItems: 'center',
    gap: 4,
  },
  calloutVillage: { fontSize: 14, fontWeight: '800' },
  calloutCondition: { fontSize: 11, color: theme.textSecondary, textAlign: 'center' },
  calloutBadge: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, marginTop: 4,
  },
  calloutBadgeText: { fontSize: 10, fontWeight: '700' },
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
});
