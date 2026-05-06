// Animated Tremor / Accelerometer Waveform — MediAid Part D
// Supports both real accelerometer data (liveValues) and mock animated mode
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVE_WIDTH = SCREEN_WIDTH - 32;
const WAVE_HEIGHT = 80;
const SEGMENTS = 80;
const LIVE_BUFFER_SIZE = 80; // keep last 80 accelerometer readings

/** Build a resting-tremor-like waveform at ~5 Hz (mock mode) */
function buildTremorPath(highTremor: boolean): number[] {
  const pts: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    if (highTremor) {
      const base = Math.sin(t * Math.PI * 2 * 6) * 0.4;
      const noise1 = Math.sin(t * Math.PI * 2 * 11.3 + 0.5) * 0.2;
      const noise2 = Math.sin(t * Math.PI * 2 * 3.7 + 1.2) * 0.15;
      const spike = i % 13 === 0 ? 0.25 * (Math.random() > 0.5 ? 1 : -1) : 0;
      pts.push(0.5 + base + noise1 + noise2 + spike);
    } else {
      const base = Math.sin(t * Math.PI * 2 * 1.5) * 0.05;
      const micro = Math.sin(t * Math.PI * 2 * 8.3) * 0.03;
      pts.push(0.5 + base + micro);
    }
  }
  return pts.map((y) => Math.max(0.02, Math.min(0.98, y)));
}

const LOW_TREMOR = buildTremorPath(false);
const HIGH_TREMOR = buildTremorPath(true);

interface TremorWaveformProps {
  tremorLevel?: 'low' | 'high';
  color?: string;
  /** Optional live accelerometer RMS values array (0–1 normalised). When provided, renders real data. */
  liveValues?: number[];
}

export function TremorWaveform({
  tremorLevel = 'low',
  color = '#F59E0B',
  liveValues,
}: TremorWaveformProps) {
  const scrollX = useSharedValue(0);
  const isLiveMode = liveValues && liveValues.length > 0;

  // Mock animation mode (used when no liveValues)
  useEffect(() => {
    if (isLiveMode) return; // live mode handles its own rendering
    const shape = tremorLevel === 'high' ? HIGH_TREMOR : LOW_TREMOR;
    const speed = tremorLevel === 'high' ? 1800 : 3200;
    scrollX.value = 0;
    scrollX.value = withRepeat(
      withTiming(-WAVE_WIDTH, { duration: speed, easing: Easing.linear }),
      -1
    );
  }, [tremorLevel, isLiveMode]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: isLiveMode ? 0 : scrollX.value }],
  }));

  // Build points from live data or mock shape
  const buildPoints = (): { x: number; y: number }[] => {
    if (isLiveMode && liveValues) {
      // Pad or trim to SEGMENTS
      const buf = liveValues.slice(-SEGMENTS);
      const padded = [...Array(Math.max(0, SEGMENTS - buf.length)).fill(0.5), ...buf];
      const segW = WAVE_WIDTH / SEGMENTS;
      return padded.map((v, i) => {
        // Centre at 0.5, scale to fill height nicely
        const clamped = Math.max(0.02, Math.min(0.98, v));
        return { x: i * segW, y: WAVE_HEIGHT * (1 - clamped * 0.85) - WAVE_HEIGHT * 0.075 };
      });
    }
    // Mock mode
    const shape = tremorLevel === 'high' ? HIGH_TREMOR : LOW_TREMOR;
    const segW = WAVE_WIDTH / SEGMENTS;
    return shape.map((y, i) => ({
      x: i * segW,
      y: WAVE_HEIGHT * (1 - y * 0.85) - WAVE_HEIGHT * 0.075,
    }));
  };

  const points = buildPoints();
  const allPoints = isLiveMode
    ? points
    : [...points, ...points.map((p) => ({ x: p.x + WAVE_WIDTH, y: p.y }))];

  const hasTremor = isLiveMode
    ? (liveValues?.length ? Math.max(...liveValues) : 0) > 0.35
    : tremorLevel === 'high';

  return (
    <View style={styles.container}>
      {/* Centre baseline */}
      <View style={[styles.baseline, { top: WAVE_HEIGHT / 2 }]} />

      <Animated.View
        style={[
          { width: isLiveMode ? WAVE_WIDTH : WAVE_WIDTH * 2, height: WAVE_HEIGHT },
          animStyle,
        ]}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: isLiveMode ? WAVE_WIDTH : WAVE_WIDTH * 2,
            height: WAVE_HEIGHT,
          }}
        >
          {allPoints.slice(0, -1).map((pt, i) => {
            const next = allPoints[i + 1];
            const dx = next.x - pt.x;
            const dy = next.y - pt.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const deviation = Math.abs(pt.y - WAVE_HEIGHT / 2) / (WAVE_HEIGHT / 2);
            const opacity = 0.6 + deviation * 0.4;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: pt.x,
                  top: pt.y,
                  width: length,
                  height: hasTremor ? 3 : 2,
                  backgroundColor: color,
                  opacity,
                  transformOrigin: 'left center',
                  transform: [{ rotate: `${angle}deg` }],
                  borderRadius: 1,
                  shadowColor: color,
                  shadowOpacity: hasTremor ? 0.9 : 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              />
            );
          })}
        </View>
      </Animated.View>

      {/* Threshold lines for high tremor */}
      {hasTremor && (
        <>
          <View style={[styles.threshLine, { top: WAVE_HEIGHT * 0.25, borderColor: color + '55' }]} />
          <View style={[styles.threshLine, { top: WAVE_HEIGHT * 0.75, borderColor: color + '55' }]} />
        </>
      )}

      {/* Live mode indicator */}
      {isLiveMode && (
        <View style={styles.livePill}>
          <View style={[styles.liveDot, { backgroundColor: hasTremor ? '#FF3B3B' : '#00D97E' }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: WAVE_WIDTH,
    height: WAVE_HEIGHT,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.border,
    zIndex: 1,
  },
  threshLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 2,
  },
  livePill: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#00D97E',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
});
