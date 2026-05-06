// Animated PPG Waveform — MediAid Feature
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
const SEGMENTS = 60;

// Pre-compute a realistic PPG waveform shape (one heartbeat cycle)
// Values are in 0..1 range, mapped to pixel offsets
function buildPPGPath(): number[] {
  const pts: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const t = i / SEGMENTS;
    // Dicrotic pulse shape: sharp systolic peak + dicrotic notch
    let y: number;
    if (t < 0.05) {
      y = t / 0.05; // upstroke
    } else if (t < 0.12) {
      y = 1 - (t - 0.05) / 0.07 * 0.25; // systolic peak downslope
    } else if (t < 0.18) {
      y = 0.75 - (t - 0.12) / 0.06 * 0.2; // dicrotic notch dip
    } else if (t < 0.22) {
      y = 0.55 + (t - 0.18) / 0.04 * 0.15; // dicrotic bump
    } else if (t < 0.45) {
      y = 0.7 - (t - 0.22) / 0.23 * 0.7; // long diastolic decay
    } else {
      y = 0; // diastole baseline
    }
    pts.push(Math.max(0, Math.min(1, y)));
  }
  return pts;
}

const PPG_SHAPE = buildPPGPath();

interface PPGWaveformProps {
  color?: string;
  bpm?: number; // beats per minute (controls scroll speed)
  label?: string;
}

export function PPGWaveform({ color = theme.statusGreen, bpm = 72, label }: PPGWaveformProps) {
  // Scroll offset drives horizontal movement of the waveform
  const scrollX = useSharedValue(0);

  const periodMs = (60 / bpm) * 1000; // ms per beat

  useEffect(() => {
    scrollX.value = 0;
    scrollX.value = withRepeat(
      withTiming(-WAVE_WIDTH, {
        duration: periodMs * 2,
        easing: Easing.linear,
      }),
      -1
    );
  }, [bpm]);

  // Build SVG-like polyline points string for one period
  const segW = WAVE_WIDTH / SEGMENTS;
  const points = PPG_SHAPE.map((y, i) => ({
    x: i * segW,
    y: WAVE_HEIGHT * (1 - y * 0.85) - WAVE_HEIGHT * 0.075,
  }));

  // Duplicate to allow seamless looping scroll
  const allPoints = [...points, ...points.map((p) => ({ x: p.x + WAVE_WIDTH, y: p.y }))];

  const pointsStr = allPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.scanLine} />
      <Animated.View style={[{ width: WAVE_WIDTH * 2, height: WAVE_HEIGHT }, animStyle]}>
        {/* Render waveform as a series of line segments using Views */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: WAVE_WIDTH * 2, height: WAVE_HEIGHT }}>
          {allPoints.slice(0, -1).map((pt, i) => {
            const next = allPoints[i + 1];
            const dx = next.x - pt.x;
            const dy = next.y - pt.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const lineColor = pt.y < WAVE_HEIGHT * 0.3 ? color : color + '99';
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: pt.x,
                  top: pt.y,
                  width: length,
                  height: 2.5,
                  backgroundColor: lineColor,
                  transformOrigin: 'left center',
                  transform: [{ rotate: `${angle}deg` }],
                  borderRadius: 1,
                  shadowColor: color,
                  shadowOpacity: 0.8,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              />
            );
          })}
        </View>
      </Animated.View>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => (
        <View
          key={frac}
          style={[styles.gridLine, { top: WAVE_HEIGHT * frac }]}
        />
      ))}
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
  scanLine: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: theme.statusGreen + '44',
    zIndex: 10,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.border,
    zIndex: 1,
  },
});
