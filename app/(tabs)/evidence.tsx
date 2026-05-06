// Powered by OnSpace.AI — Evidence Base with TTS Audio Playback + Bookmarks
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { config } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

const BOOKMARK_KEY = 'mediaid_bookmarked_citations';

type CitationType = typeof config.citations[0];

function CitationCard({
  citation,
  bookmarked,
  isPlaying,
  onBookmark,
  onPlay,
  onStop,
}: {
  citation: CitationType;
  bookmarked: boolean;
  isPlaying: boolean;
  onBookmark: () => void;
  onPlay: () => void;
  onStop: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, isPlaying && styles.cardPlaying]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idBadge}>
          <Text style={styles.idText}>{citation.id}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authors}>{citation.authors} ({citation.year})</Text>
          <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>{citation.title}</Text>
        </View>
        <View style={styles.cardActions}>
          {/* Bookmark */}
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            onPress={onBookmark}
            hitSlop={8}
          >
            <MaterialIcons
              name={bookmarked ? 'bookmark' : 'bookmark-border'}
              size={20}
              color={bookmarked ? theme.statusYellow : theme.textMuted}
            />
          </Pressable>
          {/* Play / Stop */}
          <Pressable
            style={({ pressed }) => [styles.playBtn, isPlaying && styles.playBtnActive, pressed && { opacity: 0.8 }]}
            onPress={isPlaying ? onStop : onPlay}
            hitSlop={4}
          >
            <Animated.View style={isPlaying ? { transform: [{ scale: pulseAnim }] } : {}}>
              <MaterialIcons
                name={isPlaying ? 'stop' : 'volume-up'}
                size={16}
                color={isPlaying ? '#FFF' : theme.primary}
              />
            </Animated.View>
          </Pressable>
        </View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.textMuted}
          style={{ marginLeft: 4 }}
        />
      </View>

      {/* Playing indicator */}
      {isPlaying && (
        <View style={styles.playingBar}>
          <MaterialIcons name="graphic-eq" size={14} color={theme.primary} />
          <Text style={styles.playingText}>Reading aloud...</Text>
        </View>
      )}

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.journalRow}>
            <MaterialIcons name="menu-book" size={14} color={theme.primary} />
            <Text style={styles.journal}>{citation.journal}</Text>
          </View>
          <View style={styles.findingBox}>
            <Text style={styles.findingLabel}>KEY FINDING</Text>
            <Text style={styles.finding}>{citation.finding}</Text>
          </View>
          <Pressable
            style={[styles.readFindingBtn, { borderColor: theme.primary + '44' }]}
            onPress={(e) => {
              e.stopPropagation?.();
              if (isPlaying) { onStop(); } else { onPlay(); }
            }}
          >
            <MaterialIcons name={isPlaying ? 'stop' : 'volume-up'} size={14} color={theme.primary} />
            <Text style={styles.readFindingText}>{isPlaying ? 'Stop Reading' : 'Read Finding Aloud'}</Text>
          </Pressable>
          <View style={styles.doiRow}>
            <MaterialIcons name="link" size={12} color={theme.textMuted} />
            <Text style={styles.doi}>{citation.doi}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function EvidenceScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useApp();
  const router = useRouter();

  const [filter, setFilter] = useState<'all' | 'bookmarked' | 'ai' | 'climate' | 'implementation'>('all');
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [readAllMode, setReadAllMode] = useState(false);
  const readAllIndexRef = useRef(0);

  const filters: { id: typeof filter; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'list' },
    { id: 'bookmarked', label: 'Saved', icon: 'bookmark' },
    { id: 'ai', label: 'AI / Sensors', icon: 'science' },
    { id: 'climate', label: 'Climate', icon: 'cloud' },
    { id: 'implementation', label: 'Impl.', icon: 'settings' },
  ];

  const filtered = (() => {
    if (filter === 'bookmarked') return config.citations.filter((c) => bookmarked.has(c.id));
    if (filter === 'climate') return config.citations.filter((c) => c.id === 5);
    if (filter === 'implementation') return config.citations.filter((c) => [10, 11, 13, 14, 15].includes(c.id));
    if (filter === 'ai') return config.citations.filter((c) => [1, 2, 3, 4, 6, 7, 8, 9, 12].includes(c.id));
    return config.citations;
  })();

  // Load bookmarks from storage
  useEffect(() => {
    AsyncStorage.getItem(BOOKMARK_KEY).then((raw) => {
      if (raw) {
        try { setBookmarked(new Set(JSON.parse(raw))); } catch {}
      }
    });
  }, []);

  const saveBookmarks = async (set: Set<number>) => {
    setBookmarked(new Set(set));
    await AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.from(set)));
  };

  const toggleBookmark = (id: number) => {
    const next = new Set(bookmarked);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveBookmarks(next);
  };

  const buildSpeechText = (c: CitationType): string =>
    `Citation ${c.id}. ${c.authors}, ${c.year}. ${c.title}. Published in ${c.journal}. Key finding: ${c.finding}`;

  const playCitation = (id: number) => {
    const c = config.citations.find((x) => x.id === id);
    if (!c) return;
    Speech.stop();
    setPlayingId(id);
    Speech.speak(buildSpeechText(c), {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: 0.85,
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const stopSpeech = () => {
    Speech.stop();
    setPlayingId(null);
    setReadAllMode(false);
  };

  const handleReadAll = () => {
    if (readAllMode) {
      stopSpeech();
      return;
    }
    setReadAllMode(true);
    readAllIndexRef.current = 0;

    const readNext = (index: number) => {
      if (index >= filtered.length) {
        setPlayingId(null);
        setReadAllMode(false);
        return;
      }
      const c = filtered[index];
      setPlayingId(c.id);
      Speech.speak(buildSpeechText(c), {
        language: language === 'fr' ? 'fr-FR' : 'en-US',
        rate: 0.85,
        onDone: () => readNext(index + 1),
        onStopped: () => { setPlayingId(null); setReadAllMode(false); },
        onError: () => readNext(index + 1),
      });
    };

    readNext(0);
  };

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>Peer-Reviewed Research</Text>
          <Text style={styles.headerTitle}>Evidence Base</Text>
          <Text style={styles.headerDesc}>
            25+ peer-reviewed studies · 16 validated sensor capabilities · African AI Equity Validation Protocol active.
            All AI inference targets validated in peer-reviewed literature.
          </Text>
        </View>

        {/* Tool CTAs */}
        <View style={styles.toolBannerRow}>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#A78BFA44', backgroundColor: '#A78BFA10' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/ai-advisor')}
          >
            <MaterialIcons name="local-hospital" size={22} color="#A78BFA" />
            <Text style={[styles.toolBannerTitle, { color: '#A78BFA' }]}>AI Clinical{`\n`}Advisor</Text>
            <Text style={styles.toolBannerSub}>12 offline{`\n`}protocols</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: theme.statusYellow + '44', backgroundColor: theme.statusYellowBg }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/formulary')}
          >
            <MaterialIcons name="medication" size={22} color={theme.statusYellow} />
            <Text style={[styles.toolBannerTitle, { color: theme.statusYellow }]}>Drug{`\n`}Formulary</Text>
            <Text style={styles.toolBannerSub}>10 WHO{`\n`}essentials</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: theme.statusRed + '44', backgroundColor: theme.statusRedBg }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/symptom-checker')}
          >
            <MaterialIcons name="search" size={22} color={theme.statusRed} />
            <Text style={[styles.toolBannerTitle, { color: theme.statusRed }]}>Symptom{`\n`}Checker</Text>
            <Text style={styles.toolBannerSub}>8 condition{`\n`}protocols</Text>
          </Pressable>
        </View>
        {/* Health Education + Village Dashboard row */}
        <View style={[styles.toolBannerRow, { marginTop: -4 }]}>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#10B98144', backgroundColor: '#10B98110' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/health-education')}
          >
            <MaterialIcons name="menu-book" size={22} color="#10B981" />
            <Text style={[styles.toolBannerTitle, { color: '#10B981' }]}>Health{`\n`}Education</Text>
            <Text style={styles.toolBannerSub}>8 topics{`\n`}EN/FR TTS</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: theme.primary + '44', backgroundColor: theme.primary + '10' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/village-dashboard')}
          >
            <MaterialIcons name="location-city" size={22} color={theme.primary} />
            <Text style={[styles.toolBannerTitle, { color: theme.primary }]}>Village{`\n`}Dashboard</Text>
            <Text style={styles.toolBannerSub}>4 villages{`\n`}field data</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#A78BFA44', backgroundColor: '#A78BFA10' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/analytics')}
          >
            <MaterialIcons name="bar-chart" size={22} color="#A78BFA" />
            <Text style={[styles.toolBannerTitle, { color: '#A78BFA' }]}>Pop.{`\n`}Analytics</Text>
            <Text style={styles.toolBannerSub}>8 condition{`\n`}charts</Text>
          </Pressable>
        </View>

        {/* v10 LLM + Biometric row */}
        <View style={[styles.toolBannerRow, { marginTop: -4 }]}>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#7C3AED44', backgroundColor: '#7C3AED10' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/llm-validation')}
          >
            <MaterialIcons name="psychology" size={22} color="#7C3AED" />
            <Text style={[styles.toolBannerTitle, { color: '#7C3AED' }]}>Silent LLM{`\n`}Validation</Text>
            <Text style={styles.toolBannerSub}>5 records{`\n`}v10 NEW</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#22D3EE44', backgroundColor: '#22D3EE10' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/biometric-identity')}
          >
            <MaterialIcons name="fingerprint" size={22} color="#22D3EE" />
            <Text style={[styles.toolBannerTitle, { color: '#22D3EE' }]}>Biometric{`\n`}Identity</Text>
            <Text style={styles.toolBannerSub}>Hash-only{`\n`}v10 NEW</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#818CF844', backgroundColor: '#818CF810' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/self-healing-ai')}
          >
            <MaterialIcons name="auto-fix-high" size={22} color="#818CF8" />
            <Text style={[styles.toolBannerTitle, { color: '#818CF8' }]}>{`Self-Healing\nAI`}</Text>
            <Text style={styles.toolBannerSub}>{`10 cases\nv10`}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: theme.primary + '44', backgroundColor: theme.primary + '10' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/cha-professionalization')}
          >
            <MaterialIcons name="trending-up" size={22} color={theme.primary} />
            <Text style={[styles.toolBannerTitle, { color: theme.primary }]}>{`CHA Prof.\nMetric`}</Text>
            <Text style={styles.toolBannerSub}>{`5 dimensions\nv10`}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.toolBannerCard, { borderColor: '#F9731644', backgroundColor: '#F9731610' }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/risk-calculator')}
          >
            <MaterialIcons name="calculate" size={22} color="#F97316" />
            <Text style={[styles.toolBannerTitle, { color: '#F97316' }]}>Risk{`\n`}Calculators</Text>
            <Text style={styles.toolBannerSub}>5 validated{`\n`}tools</Text>
          </Pressable>
        </View>

        {/* Quiz CTA */}
        <Pressable
          style={({ pressed }) => [styles.quizBanner, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/training-quiz')}
        >
          <View style={styles.quizBannerLeft}>
            <MaterialIcons name="quiz" size={28} color={theme.statusGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quizBannerTitle}>CHA Training Quiz</Text>
            <Text style={styles.quizBannerSub}>7 MCQ questions · Clinical thresholds · Earn your knowledge badge</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.statusGreen} />
        </Pressable>

        {/* Impact stats */}
        <View style={styles.impactRow}>
          {[
            { value: '95%', label: 'AFib sensitivity', color: theme.primary },
            { value: '94%', label: 'TB accuracy', color: theme.statusRed },
            { value: '0.97', label: 'Eye AUC', color: '#A78BFA' },
            { value: '25+', label: 'Peer studies', color: theme.statusGreen },
          ].map((s) => (
            <View key={s.label} style={[styles.impactCard, { borderColor: s.color + '44' }]}>
              <Text style={[styles.impactValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.impactLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* African AI Equity Validation Protocol */}
        <View style={styles.equityCard}>
          <View style={styles.equityHeader}>
            <View style={styles.equityIconCircle}>
              <MaterialIcons name="public" size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.equityTitle}>African AI Equity Validation Protocol</Text>
              <Text style={styles.equitySub}>v10 · Four workstreams · Zero additional field cost</Text>
            </View>
            <View style={styles.equityBadge}>
              <Text style={styles.equityBadgeText}>NEW v10</Text>
            </View>
          </View>
          <Text style={styles.equityDesc}>
            MediAid is the first community mHealth tool to systematically validate AI model equity across African populations. All four workstreams run from Month 1 of Phase 1 data collection.
          </Text>
          {[
            { num: '1', title: 'PPG Skin-Tone Calibration', desc: 'rPPG + AF detection accuracy by Fitzpatrick VI population (Cameroon). Partner: Makerere AI Lab.' },
            { num: '2', title: 'Cough Acoustic Transfer Study', desc: 'TB cough AI on Cameroonian population vs. Indian/Kenyan training data. Partner: University of Buea.' },
            { num: '3', title: 'Anaemia & Jaundice Colorimetry Bias', desc: 'Conjunctival colorimetry AI accuracy across Fitzpatrick scale — minimum fine-tuning dataset size.' },
            { num: '4', title: 'Voice Biomarker Language Transfer', desc: 'Depression + MCI voice models on Fulfulde and Cameroonian French. First published dataset in these language groups.' },
          ].map((ws) => (
            <View key={ws.num} style={styles.equityWorkstream}>
              <View style={styles.equityWsNum}>
                <Text style={styles.equityWsNumText}>{ws.num}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.equityWsTitle}>{ws.title}</Text>
                <Text style={styles.equityWsDesc}>{ws.desc}</Text>
              </View>
            </View>
          ))}
          <View style={styles.equityOutputRow}>
            <MaterialIcons name="article" size={13} color="#10B981" />
            <Text style={styles.equityOutputText}>Output: 4 peer-reviewed publications · Wellcome Trust mandate alignment · Google.org responsible AI requirement</Text>
          </View>
        </View>

        {/* Read All banner */}
        <Pressable
          style={({ pressed }) => [
            styles.readAllBtn,
            readAllMode && styles.readAllBtnActive,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleReadAll}
        >
          <MaterialIcons
            name={readAllMode ? 'stop' : 'playlist-play'}
            size={20}
            color={readAllMode ? '#FFF' : theme.primary}
          />
          <Text style={[styles.readAllText, readAllMode && { color: '#FFF' }]}>
            {readAllMode
              ? `Reading citations aloud... (tap to stop)`
              : `Listen to All ${filtered.length} Citations`}
          </Text>
        </Pressable>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={{ marginBottom: 16 }}
        >
          {filters.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.chip, filter === f.id && styles.chipActive]}
              onPress={() => setFilter(f.id)}
            >
              <MaterialIcons
                name={f.icon as any}
                size={13}
                color={filter === f.id ? theme.primary : theme.textMuted}
              />
              <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Bookmark count */}
        {bookmarked.size > 0 && filter !== 'bookmarked' && (
          <Pressable
            style={styles.bookmarkBanner}
            onPress={() => setFilter('bookmarked')}
          >
            <MaterialIcons name="bookmark" size={14} color={theme.statusYellow} />
            <Text style={styles.bookmarkBannerText}>
              {bookmarked.size} citation{bookmarked.size !== 1 ? 's' : ''} saved — tap to view
            </Text>
            <MaterialIcons name="chevron-right" size={14} color={theme.statusYellow} />
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>
          {filtered.length} CITATION{filtered.length !== 1 ? 'S' : ''}
          {filter === 'bookmarked' ? ' · SAVED' : ''}
        </Text>

        {filtered.length === 0 && filter === 'bookmarked' && (
          <View style={styles.emptyBookmarks}>
            <MaterialIcons name="bookmark-border" size={48} color={theme.textMuted} />
            <Text style={styles.emptyBookmarksText}>No bookmarks yet. Tap the bookmark icon on any citation to save it.</Text>
          </View>
        )}

        {filtered.map((c) => (
          <CitationCard
            key={c.id}
            citation={c}
            bookmarked={bookmarked.has(c.id)}
            isPlaying={playingId === c.id}
            onBookmark={() => toggleBookmark(c.id)}
            onPlay={() => playCitation(c.id)}
            onStop={stopSpeech}
          />
        ))}

        {/* Disclaimer */}
        <View style={styles.disclaimerBox}>
          <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
          <Text style={styles.disclaimerText}>
            MediAid v10 prototype for the UNICEF Venture Fund. 25+ peer-reviewed studies. All AI inferences are
            simulated within clinically plausible ranges for this prototype. Not intended as a replacement
            for clinical diagnosis. CHAs must follow national referral protocols.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  header: { paddingTop: 16, marginBottom: 20 },
  headerSub: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginTop: 2 },
  headerDesc: { fontSize: 14, color: theme.textSecondary, marginTop: 8, lineHeight: 22 },
  impactRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  impactCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  impactValue: { fontSize: 18, fontWeight: '800' },
  impactLabel: { fontSize: 9, color: theme.textSecondary, marginTop: 3, textAlign: 'center', fontWeight: '600' },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary + '18',
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.primary + '44',
  },
  readAllBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  readAllText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.primary },
  filterRow: { gap: 8, paddingHorizontal: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primary + '22', borderColor: theme.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: theme.primary },
  bookmarkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.statusYellowBg,
    borderRadius: theme.radius.medium,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.statusYellow + '44',
  },
  bookmarkBannerText: { flex: 1, fontSize: 13, color: theme.statusYellow, fontWeight: '600' },
  sectionTitle: { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardPlaying: {
    borderColor: theme.primary + '77',
    backgroundColor: theme.primary + '0A',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  idBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.primary + '44',
  },
  idText: { fontSize: 11, fontWeight: '800', color: theme.primary },
  authors: { fontSize: 11, color: theme.primary, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 13, color: theme.textPrimary, marginTop: 3, lineHeight: 18, fontWeight: '500' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary + '18',
    borderWidth: 1,
    borderColor: theme.primary + '44',
  },
  playBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  playingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: theme.primary + '12',
    borderRadius: theme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  playingText: { fontSize: 11, color: theme.primary, fontWeight: '600' },
  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  journalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  journal: { fontSize: 12, color: theme.textSecondary, fontStyle: 'italic', flex: 1 },
  findingBox: {
    backgroundColor: theme.backgroundSecondary ?? theme.background,
    borderRadius: theme.radius.small,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.primary + '33',
  },
  findingLabel: { fontSize: 10, color: theme.primary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  finding: { fontSize: 13, color: theme.textPrimary, lineHeight: 20 },
  readFindingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  readFindingText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  doiRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doi: { fontSize: 11, color: theme.textMuted, fontFamily: 'monospace' },
  quizBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.statusGreenBg,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.statusGreen + '44',
  },
  quizBannerLeft: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.statusGreen + '22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  quizBannerTitle: { fontSize: 16, fontWeight: '700', color: theme.statusGreen },
  quizBannerSub: { fontSize: 12, color: theme.statusGreen + 'CC', marginTop: 2, lineHeight: 18 },
  toolBannerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  toolBannerCard: {
    flex: 1, borderRadius: theme.radius.medium, padding: 14,
    alignItems: 'center', gap: 6, borderWidth: 1,
  },
  toolBannerTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 19 },
  toolBannerSub: { fontSize: 10, color: theme.textMuted, textAlign: 'center', lineHeight: 15 },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.background,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
  emptyBookmarks: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyBookmarksText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  // African AI Equity Protocol styles
  equityCard: {
    backgroundColor: '#10B98108', borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#10B98144',
  },
  equityHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  equityIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#10B98122', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#10B98144',
  },
  equityTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  equitySub: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  equityBadge: {
    backgroundColor: '#10B98122', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#10B98144',
  },
  equityBadgeText: { fontSize: 9, fontWeight: '800', color: '#10B981', letterSpacing: 0.5 },
  equityDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },
  equityWorkstream: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  equityWsNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#10B98122', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#10B98144', flexShrink: 0,
  },
  equityWsNumText: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  equityWsTitle: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  equityWsDesc: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  equityOutputRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#10B98112', borderRadius: theme.radius.small,
    padding: 10, marginTop: 6,
  },
  equityOutputText: { flex: 1, fontSize: 11, color: '#10B981', lineHeight: 16 },
});
