// Animated Cough / Microphone Waveform — MediAid Part B
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { theme } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVE_WIDTH = SCREEN_WIDTH - 32;
const WAVE_HEIGHT = 80;
const BAR_COUNT = 40;

// Pre-build amplitude envelopes for two phases: silent + cough burst
function buildCoughEnvelope(): number[] {
  const env: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / BAR_COUNT;
    if (t < 0.25) {
      // Quiet breath — low micro-noise
      env.push(0.04 + Math.random() * 0.08);
    } else if (t < 0.32) {
      // Pre-cough build-up
      env.push(0.1 + (t - 0.25) / 0.07 * 0.5 + Math.random() * 0.1);
    } else if (t < 0.52) {
      // COUGH BURST — high irregular amplitude
      const peak = Math.sin(((t - 0.32) / 0.2) * Math.PI);
      env.push(0.5 + peak * 0.45 + (Math.random() - 0.5) * 0.3);
    } else if (t < 0.62) {
      // Post-cough decay
      env.push(0.7 - (t - 0.52) / 0.1 * 0.55 + Math.random() * 0.1);
    } else if (t < 0.68) {
      // Second smaller cough
      const peak2 = Math.sin(((t - 0.62) / 0.06) * Math.PI);
      env.push(0.25 + peak2 * 0.35 + Math.random() * 0.1);
    } else {
      // Recovery to quiet
      env.push(0.04 + Math.random() * 0.06);
    }
  }
  return env.map((v) => Math.max(0.02, Math.min(1, v)));
}

const ENVELOPE = buildCoughEnvelope();

interface CoughWaveformProps {
  color?: string;
  phase?: 'listening' | 'cough' | 'analysis';
}

export function CoughWaveform({ color = '#A855F7', phase = 'cough' }: CoughWaveformProps) {
  const animValues = useRef(ENVELOPE.map((v) => new Animated.Value(v * 0.3))).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (phase === 'listening') {
      // Gentle oscillation at breath level
      const animations = animValues.map((av, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(av, {
              toValue: 0.04 + Math.random() * 0.1,
              duration: 400 + i * 20,
              useNativeDriver: false,
            }),
            Animated.timing(av, {
              toValue: 0.02 + Math.random() * 0.06,
              duration: 350 + i * 18,
              useNativeDriver: false,
            }),
          ])
        )
      );
      loopRef.current = Animated.parallel(animations);
      loopRef.current.start();
    } else if (phase === 'cough') {
      // Play the cough pattern once, then loop quietly
      const playOnce = Animated.parallel(
        animValues.map((av, i) =>
          Animated.sequence([
            Animated.delay(i * 12),
            Animated.timing(av, {
              toValue: ENVELOPE[i],
              duration: 120,
              useNativeDriver: false,
            }),
          ])
        )
      );
      const quietLoop = Animated.loop(
        Animated.parallel(
          animValues.map((av) =>
            Animated.sequence([
              Animated.timing(av, { toValue: 0.03 + Math.random() * 0.07, duration: 600, useNativeDriver: false }),
              Animated.timing(av, { toValue: 0.02 + Math.random() * 0.05, duration: 500, useNativeDriver: false }),
            ])
          )
        )
      );
      playOnce.start(() => quietLoop.start());
    } else {
      // analysis — freeze at low steady
      animValues.forEach((av) =>
        Animated.timing(av, { toValue: 0.08, duration: 300, useNativeDriver: false }).start()
      );
    }
    return () => {
      loopRef.current?.stop();
      animValues.forEach((av) => av.stopAnimation());
    };
  }, [phase]);

  const barWidth = (WAVE_WIDTH - (BAR_COUNT - 1) * 2) / BAR_COUNT;

  return (
    <View style={[styles.container, { borderColor: color + '44' }]}>
      {/* Frequency label bars */}
      <View style={styles.barRow}>
        {animValues.map((av, i) => {
          const heightAnim = av.interpolate({
            inputRange: [0, 1],
            outputRange: [2, WAVE_HEIGHT - 8],
          });
          const opacityAnim = av.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0.3, 0.6, 1],
          });
          const colorAnim = av.interpolate({
            inputRange: [0, 0.4, 0.8, 1],
            outputRange: [color + '55', color + '88', color + 'CC', color],
          });
          return (
            <View key={i} style={[styles.barWrapper, { width: barWidth }]}>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    height: heightAnim,
                    backgroundColor: colorAnim,
                    opacity: opacityAnim,
                    shadowColor: color,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Centre baseline */}
      <View style={[styles.baseline, { backgroundColor: color + '22' }]} />
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
    position: 'relative',
    justifyContent: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: WAVE_HEIGHT,
    paddingHorizontal: 4,
  },
  barWrapper: {
    height: WAVE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 2,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WAVE_HEIGHT / 2,
    height: 1,
  },
});
