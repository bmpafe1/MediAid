// MediAid Onboarding — Language Select + Grant Video Opener
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

const { width: W } = Dimensions.get('window');

// ─── Language Selector Slide ──────────────────────────────────────────────────
function LanguageSlide({
  selectedLang,
  onSelect,
}: {
  selectedLang: 'en' | 'fr';
  onSelect: (lang: 'en' | 'fr') => void;
}) {
  const scaleEN = useRef(new Animated.Value(selectedLang === 'en' ? 1.04 : 1)).current;
  const scaleFR = useRef(new Animated.Value(selectedLang === 'fr' ? 1.04 : 1)).current;

  const handleSelect = (lang: 'en' | 'fr') => {
    onSelect(lang);
    Animated.spring(lang === 'en' ? scaleEN : scaleFR, {
      toValue: 1.06,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start();
    Animated.spring(lang === 'en' ? scaleFR : scaleEN, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start();
  };

  return (
    <View style={[langStyles.root, { width: W }]}>
      {/* Logo area */}
      <View style={langStyles.logoArea}>
        <View style={langStyles.logoCircle}>
          <MaterialIcons name="health-and-safety" size={56} color={theme.primary} />
        </View>
        <Text style={langStyles.appName}>MediAid</Text>
        <Text style={langStyles.unicef}>UNICEF Venture Fund · Cameroon</Text>
      </View>

      {/* Language prompt */}
      <View style={langStyles.promptArea}>
        <Text style={langStyles.promptEN}>Choose your language</Text>
        <Text style={langStyles.promptFR}>Choisissez votre langue</Text>
      </View>

      {/* Language cards */}
      <View style={langStyles.langCards}>
        <Pressable onPress={() => handleSelect('en')}>
          <Animated.View
            style={[
              langStyles.langCard,
              selectedLang === 'en' && langStyles.langCardActive,
              { transform: [{ scale: scaleEN }] },
            ]}
          >
            <Text style={langStyles.flag}>🇬🇧</Text>
            <Text style={[langStyles.langName, selectedLang === 'en' && { color: theme.primary }]}>
              English
            </Text>
            <Text style={[langStyles.langSub, selectedLang === 'en' && { color: theme.primary + 'AA' }]}>
              English
            </Text>
            {selectedLang === 'en' && (
              <View style={langStyles.selectedDot}>
                <MaterialIcons name="check-circle" size={20} color={theme.primary} />
              </View>
            )}
          </Animated.View>
        </Pressable>

        <Pressable onPress={() => handleSelect('fr')}>
          <Animated.View
            style={[
              langStyles.langCard,
              selectedLang === 'fr' && langStyles.langCardActive,
              { transform: [{ scale: scaleFR }] },
            ]}
          >
            <Text style={langStyles.flag}>🇫🇷</Text>
            <Text style={[langStyles.langName, selectedLang === 'fr' && { color: theme.primary }]}>
              Français
            </Text>
            <Text style={[langStyles.langSub, selectedLang === 'fr' && { color: theme.primary + 'AA' }]}>
              French
            </Text>
            {selectedLang === 'fr' && (
              <View style={langStyles.selectedDot}>
                <MaterialIcons name="check-circle" size={20} color={theme.primary} />
              </View>
            )}
          </Animated.View>
        </Pressable>
      </View>

      <View style={langStyles.noticeRow}>
        <MaterialIcons name="language" size={14} color={theme.textMuted} />
        <Text style={langStyles.noticeText}>
          You can change this later in Settings · Vous pouvez changer cela dans Paramètres
        </Text>
      </View>
    </View>
  );
}

const langStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary + '44',
    marginBottom: 16,
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  appName: { fontSize: 36, fontWeight: '800', color: theme.textPrimary, letterSpacing: -1 },
  unicef: { fontSize: 12, color: theme.textMuted, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },
  promptArea: { alignItems: 'center', marginBottom: 28 },
  promptEN: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  promptFR: { fontSize: 16, fontWeight: '500', color: theme.textSecondary },
  langCards: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  langCard: {
    width: (W - 96) / 2,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.large,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: theme.border,
    position: 'relative',
  },
  langCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
    shadowColor: theme.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  flag: { fontSize: 40, marginBottom: 4 },
  langName: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },
  langSub: { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  selectedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
  },
  noticeText: {
    fontSize: 11,
    color: theme.textMuted,
    flex: 1,
    lineHeight: 16,
    textAlign: 'center',
  },
});

// ─── Content Slides ───────────────────────────────────────────────────────────
interface Slide {
  id: string;
  image: any;
  eyebrow: string;
  title: string;
  subtitle: string;
  highlight: string;
  highlightColor: string;
  icon: string;
}

const SLIDES_EN: Slide[] = [
  {
    id: '1',
    image: require('@/assets/images/scan-hero.png'),
    eyebrow: 'UNICEF Venture Fund · Cameroon',
    title: 'Screen 5 Diseases\nin 90 Seconds',
    subtitle:
      'Community Health Aides in rural Cameroon can now run a full multi-condition screening — no lab, no doctor, no internet required.',
    highlight: 'TB · AFib · Anemia · Parkinson\'s · Eye Disease',
    highlightColor: theme.primary,
    icon: 'health-and-safety',
  },
  {
    id: '2',
    image: require('@/assets/images/scan-complete.png'),
    eyebrow: 'On-Device AI · TensorFlow Lite',
    title: 'Powered by\nPeer-Reviewed AI',
    subtitle:
      'Every algorithm is validated in published research. Facial PPG for AFib (95% sensitivity), HeAR for TB cough (94% accuracy), and more.',
    highlight: '15 peer-reviewed citations · AUC 0.89–0.97',
    highlightColor: theme.statusGreen,
    icon: 'science',
  },
  {
    id: '3',
    image: require('@/assets/images/radar-map.png'),
    eyebrow: 'Climate × Health Intelligence',
    title: 'Predict Outbreaks\nBefore They Spread',
    subtitle:
      'The District Radar links rainfall anomalies to disease surges (Bime et al. 2022). CHAs see Malaria risk 4–6 weeks ahead.',
    highlight: 'DHIS2 · FHIR R4 · Offline-first · AES-256',
    highlightColor: theme.statusYellow,
    icon: 'radar',
  },
];

const SLIDES_FR: Slide[] = [
  {
    id: '1',
    image: require('@/assets/images/scan-hero.png'),
    eyebrow: 'Fonds Venture UNICEF · Cameroun',
    title: 'Dépister 5 Maladies\nen 90 Secondes',
    subtitle:
      "Les Agents de Santé Communautaires au Cameroun rural peuvent désormais effectuer un dépistage complet — sans laboratoire, sans médecin, sans internet.",
    highlight: 'TB · FAtriale · Anémie · Parkinson · Maladies Oculaires',
    highlightColor: theme.primary,
    icon: 'health-and-safety',
  },
  {
    id: '2',
    image: require('@/assets/images/scan-complete.png'),
    eyebrow: 'IA Embarquée · TensorFlow Lite',
    title: 'Alimenté par une\nIA Évaluée par les Pairs',
    subtitle:
      "Chaque algorithme est validé par des recherches publiées. PPG facial pour la FA (95% sensibilité), HeAR pour la tuberculose (94% précision).",
    highlight: '15 citations évaluées par les pairs · AUC 0,89–0,97',
    highlightColor: theme.statusGreen,
    icon: 'science',
  },
  {
    id: '3',
    image: require('@/assets/images/radar-map.png'),
    eyebrow: 'Intelligence Climatique × Santé',
    title: "Prédire les Épidémies\nAvant qu'Elles ne Se Propagent",
    subtitle:
      "Le Radar de District relie les anomalies pluviométriques aux pics de maladies (Bime et al. 2022). Les ASC voient le risque de paludisme 4–6 semaines à l'avance.",
    highlight: 'DHIS2 · FHIR R4 · Hors ligne · AES-256',
    highlightColor: theme.statusYellow,
    icon: 'radar',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setLanguage } = useApp();
  const flatRef = useRef<FlatList<any>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedLang, setSelectedLang] = useState<'en' | 'fr'>('en');

  // Slide 0 = language picker; slides 1–3 = content
  const SLIDES = selectedLang === 'fr' ? SLIDES_FR : SLIDES_EN;
  // Total pages: 1 lang + 3 content = 4
  const TOTAL = 1 + SLIDES.length;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleNext = () => {
    if (activeIndex < TOTAL - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const finish = () => {
    setLanguage(selectedLang);
    AsyncStorage.setItem('onboarding_done', '1');
    AsyncStorage.setItem('mediaid_language', selectedLang);
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    setLanguage(selectedLang);
    AsyncStorage.setItem('onboarding_done', '1');
    AsyncStorage.setItem('mediaid_language', selectedLang);
    router.replace('/(tabs)');
  };

  const handleLangSelect = (lang: 'en' | 'fr') => {
    setSelectedLang(lang);
  };

  // Build data array: [null = lang slide, ...SLIDES]
  const DATA = [null, ...SLIDES];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      {/* Skip (only on content slides) */}
      {activeIndex > 0 && (
        <Pressable style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>{selectedLang === 'fr' ? 'Passer' : 'Skip'}</Text>
        </Pressable>
      )}

      <FlatList
        ref={flatRef}
        data={DATA}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item, index }) => {
          if (index === 0) {
            return (
              <LanguageSlide
                selectedLang={selectedLang}
                onSelect={handleLangSelect}
              />
            );
          }
          return <SlideView slide={item as Slide} />;
        }}
      />

      {/* Dots + button */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {DATA.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
                i === 0 && activeIndex === 0 && { backgroundColor: theme.primary },
              ]}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}
          onPress={handleNext}
        >
          {activeIndex === 0 ? (
            <>
              <Text style={styles.nextBtnText}>{selectedLang === 'fr' ? 'Continuer' : 'Continue'}</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
            </>
          ) : activeIndex < TOTAL - 1 ? (
            <>
              <Text style={styles.nextBtnText}>{selectedLang === 'fr' ? 'Suivant' : 'Next'}</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
            </>
          ) : (
            <>
              <MaterialIcons name="health-and-safety" size={20} color="#FFF" />
              <Text style={styles.nextBtnText}>{selectedLang === 'fr' ? 'Démarrer MediAid' : 'Start MediAid'}</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  return (
    <View style={[styles.slide, { width: W }]}>
      <View style={styles.imageWrapper}>
        <Image
          source={slide.image}
          style={styles.slideImage}
          contentFit="cover"
          transition={400}
        />
        <View style={styles.imageOverlay} />
        <View style={styles.iconBadge}>
          <MaterialIcons name={slide.icon as any} size={32} color={slide.highlightColor} />
        </View>
      </View>

      <View style={styles.textContent}>
        <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        <View style={[styles.highlightBox, { borderColor: slide.highlightColor + '55', backgroundColor: slide.highlightColor + '18' }]}>
          <MaterialIcons name="verified" size={14} color={slide.highlightColor} />
          <Text style={[styles.highlightText, { color: slide.highlightColor }]}>
            {slide.highlight}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.surface + 'CC',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  skipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  slide: { flex: 1, paddingBottom: 0 },
  imageWrapper: {
    height: 280,
    position: 'relative',
    overflow: 'hidden',
  },
  slideImage: { width: '100%', height: '100%' },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: theme.background,
    opacity: 0.85,
  },
  iconBadge: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  textContent: { paddingHorizontal: 24, paddingTop: 12 },
  eyebrow: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.textPrimary,
    lineHeight: 38,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  highlightText: { fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 18 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.primary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
