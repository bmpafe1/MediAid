// MediAid — Real-time Connectivity Status Banner
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

interface ConnectivityBannerProps {
  /** Show pending sync count from context */
  showSyncCount?: boolean;
  /** Callback when banner tapped — usually navigate to Sync tab */
  onPress?: () => void;
}

export function ConnectivityBanner({ showSyncCount = true, onPress }: ConnectivityBannerProps) {
  const { pendingSyncCount } = useApp();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);

  const slideAnim = useRef(new Animated.Value(-80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline((prev) => {
        if (prev === false && online) {
          // Just came back online
          setWasOffline(true);
          setShowReconnected(true);
          setOfflineSince(null);
          setDismissed(false);
          setTimeout(() => setShowReconnected(false), 4000);
        }
        if (prev !== false && !online) {
          // Just went offline
          setOfflineSince(new Date());
          setDismissed(false);
        }
        return online;
      });
    });

    // Initial fetch
    NetInfo.fetch().then((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (!online) setOfflineSince(new Date());
    });

    return () => unsubscribe();
  }, []);

  // Animate banner in/out
  const shouldShow = isOnline === false || showReconnected;
  const visible = shouldShow && !dismissed;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -80,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [visible]);

  // Pulse animation when offline
  useEffect(() => {
    if (!isOnline) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  if (isOnline === null) return null;

  const offlineMinutes = offlineSince
    ? Math.floor((Date.now() - offlineSince.getTime()) / 60000)
    : 0;

  const bgColor = showReconnected ? theme.statusGreen : theme.statusRed;
  const borderColor = showReconnected ? theme.statusGreen + '66' : theme.statusRed + '66';

  return (
    <Animated.View
      style={[
        bannerStyles.container,
        { backgroundColor: showReconnected ? theme.statusGreenBg : theme.statusRedBg, borderColor, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable style={bannerStyles.inner} onPress={onPress}>
        {/* Status indicator dot */}
        <Animated.View style={[bannerStyles.dot, { backgroundColor: bgColor, opacity: showReconnected ? 1 : pulseAnim }]} />

        {/* Message */}
        <View style={{ flex: 1 }}>
          {showReconnected ? (
            <>
              <Text style={[bannerStyles.title, { color: theme.statusGreen }]}>Back Online</Text>
              <Text style={[bannerStyles.sub, { color: theme.statusGreen }]}>
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} record${pendingSyncCount !== 1 ? 's' : ''} ready to sync — tap to sync now`
                  : 'All records up to date'}
              </Text>
            </>
          ) : (
            <>
              <Text style={[bannerStyles.title, { color: theme.statusRed }]}>
                Offline Mode
                {offlineMinutes > 0 ? ` · ${offlineMinutes}m` : ''}
              </Text>
              <Text style={[bannerStyles.sub, { color: theme.statusRed }]}>
                {showSyncCount && pendingSyncCount > 0
                  ? `${pendingSyncCount} record${pendingSyncCount !== 1 ? 's' : ''} pending sync · Core functions available`
                  : 'All clinical functions available · Data saved locally'}
              </Text>
            </>
          )}
        </View>

        {/* Icon */}
        <MaterialIcons
          name={showReconnected ? 'cloud-done' : 'cloud-off'}
          size={20}
          color={bgColor}
        />

        {/* Dismiss */}
        <Pressable
          style={bannerStyles.closeBtn}
          onPress={(e) => { e.stopPropagation(); setDismissed(true); }}
          hitSlop={8}
        >
          <MaterialIcons name="close" size={14} color={bgColor} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.medium,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 1, lineHeight: 15 },
  closeBtn: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});

// ─── Small status chip for tab headers ───────────────────────────────────────
export function ConnectivityChip() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  if (isOnline === null || isOnline) return null;

  return (
    <View style={chipStyles.chip}>
      <View style={chipStyles.dot} />
      <Text style={chipStyles.text}>OFFLINE</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.statusRed },
  text: { fontSize: 9, fontWeight: '800', color: theme.statusRed, letterSpacing: 0.5 },
});
