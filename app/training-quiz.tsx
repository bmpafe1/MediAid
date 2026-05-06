// MediAid — CHA Clinical Training Quiz
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

const BADGE_KEY = 'mediaid_quiz_badge';

interface QuizQuestion {
  id: number;
  category: string;
  question: string;
  options: string[];
  correct: number; // index
  explanation: string;
  citation: string;
  icon: string;
  color: string;
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    category: 'TB Screening',
    question: 'At what TB risk percentage does MediAid trigger a RED alert requiring immediate referral?',
    options: ['≥50%', '≥65%', '≥80%', '≥95%'],
    correct: 2,
    explanation: 'MediAid flags TB Risk ≥80% as RED. The HeAR model (Google/WHO 2023) achieves 94% accuracy on cough audio, with a sensitivity-optimized threshold of 80% to minimize missed cases in high-burden settings.',
    citation: 'WHO/Google HeAR 2023 · arxiv.org/abs/2403.02522',
    icon: 'air',
    color: theme.statusRed,
  },
  {
    id: 2,
    category: 'AFib Detection',
    question: 'Which sensor captures cardiac rhythm to estimate AFib risk in MediAid?',
    options: [
      'Rear camera with flash (finger PPG)',
      'Front camera facial video (rPPG)',
      'Microphone (acoustic cardiogram)',
      'Accelerometer (ballistocardiogram)',
    ],
    correct: 1,
    explanation: 'Remote photoplethysmography (rPPG) uses subtle color changes in facial skin captured by the front camera to extract pulse waveforms. Yan et al. 2018 demonstrated 95% sensitivity for AFib detection using this method.',
    citation: 'Yan et al. 2018 · DOI: 10.1109/TBME.2018.2852198',
    icon: 'monitor-heart',
    color: theme.primary,
  },
  {
    id: 3,
    category: 'Oxygen Saturation',
    question: 'What SpO₂ level indicates critical hypoxia and triggers a RED alert?',
    options: ['Below 98%', 'Below 95%', 'Below 92%', 'At or below 90%'],
    correct: 3,
    explanation: 'SpO₂ ≤90% represents critical hypoxia — the point at which tissue oxygen delivery becomes severely compromised. The WHO classifies this as "severe hypoxemia" requiring emergency intervention. MediAid uses rear camera PPG with flash (per Nitzan et al. 2020).',
    citation: 'Nitzan et al. 2020 · DOI: 10.3390/s20215415',
    icon: 'psychology',
    color: '#60A5FA',
  },
  {
    id: 4,
    category: 'Climate × Health',
    question: 'According to Bime et al. 2022, what climate variable most strongly predicts Malaria surges in Northwest Cameroon?',
    options: [
      'Temperature increase (>33°C)',
      'Rainfall anomaly (>100mm above baseline)',
      'Humidity drop (<40%)',
      'Dust particulate index',
    ],
    correct: 1,
    explanation: 'Bime et al. 2022 found that rainfall anomalies exceeding 100mm above seasonal baseline create the mosquito breeding conditions that drive Malaria case surges with a 4–6 week lag. MediAid\'s Radar screen uses this lag to provide predictive outbreak alerts.',
    citation: 'Bime et al. 2022 · Climate-Health linkage in NW Cameroon',
    icon: 'cloud',
    color: theme.statusYellow,
  },
  {
    id: 5,
    category: 'Parkinson\'s Screening',
    question: 'What is the AUC (Area Under Curve) reported by He et al. 2024 for smartphone-based tremor detection?',
    options: ['AUC 0.71', 'AUC 0.79', 'AUC 0.89', 'AUC 0.97'],
    correct: 2,
    explanation: 'He et al. 2024 reported AUC 0.89 for Parkinson\'s tremor detection using smartphone accelerometer data during a 15-second resting tremor assessment. MediAid\'s Part D replicates this protocol with mock accelerometer capture.',
    citation: 'He et al. 2024 · DOI: 10.1038/s41746-024-01103-z',
    icon: 'vibration',
    color: '#F59E0B',
  },
  {
    id: 6,
    category: 'Hemoglobin / Anemia',
    question: 'What hemoglobin level (g/dL) indicates severe anemia requiring referral in MediAid?',
    options: ['Below 14 g/dL', 'Below 12 g/dL', 'Below 10 g/dL', 'Below 8 g/dL'],
    correct: 3,
    explanation: 'WHO defines severe anemia as hemoglobin <8 g/dL in adults. At this level, compensatory mechanisms are overwhelmed and cardiac compromise risk increases dramatically. MediAid estimates hemoglobin via conjunctival pallor analysis using the front camera.',
    citation: 'WHO Haemoglobin concentrations for the diagnosis of anaemia · 2011',
    icon: 'opacity',
    color: theme.statusYellow,
  },
  {
    id: 7,
    category: 'Eye Screening',
    question: 'How many distinct ocular conditions does MediAid\'s AI screen for using the front camera?',
    options: ['3 conditions', '5 conditions', '7 conditions', '12 conditions'],
    correct: 2,
    explanation: 'Jin et al. 2024 developed a smartphone-based model detecting 7 ocular conditions (including glaucoma, diabetic retinopathy, cataracts) from retinal image proxies with AUC 0.91–0.97. MediAid\'s Part E captures a front-camera image for this analysis.',
    citation: 'Jin et al. 2024 · DOI: 10.1038/s41591-024-03087-z',
    icon: 'remove-red-eye',
    color: '#A78BFA',
  },
];

type QuizPhase = 'intro' | 'question' | 'feedback' | 'complete';

export default function TrainingQuizScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();

  const [phase, setPhase] = useState<QuizPhase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(QUESTIONS.length).fill(null));
  const [badgeEarned, setBadgeEarned] = useState(false);
  const [previousBadge, setPreviousBadge] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const currentQ = QUESTIONS[currentIndex];
  const isCorrect = selectedOption === currentQ?.correct;

  useEffect(() => {
    AsyncStorage.getItem(BADGE_KEY).then((v) => {
      if (v) setPreviousBadge(true);
    });
    return () => Speech.stop();
  }, []);

  const animateTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const handleStart = () => {
    animateTransition(() => {
      setPhase('question');
      setCurrentIndex(0);
    });
  };

  const handleAnswer = (optionIndex: number) => {
    if (phase !== 'question') return;
    setSelectedOption(optionIndex);

    const correct = optionIndex === currentQ.correct;
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 1);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionIndex;
    setAnswers(newAnswers);

    // TTS explanation
    Speech.speak(
      correct
        ? `Correct! ${currentQ.explanation}`
        : `Incorrect. The correct answer is: ${currentQ.options[currentQ.correct]}. ${currentQ.explanation}`,
      { language: language === 'fr' ? 'fr-FR' : 'en-US', rate: 0.9 }
    );

    setPhase('feedback');
  };

  const handleNext = () => {
    Speech.stop();
    if (currentIndex < QUESTIONS.length - 1) {
      animateTransition(() => {
        setCurrentIndex((i) => i + 1);
        setSelectedOption(null);
        setPhase('question');
      });
    } else {
      // Compute final score
      const finalScore = answers.filter((a, i) => a === QUESTIONS[i].correct).length + (isCorrect ? 0 : 0);
      const passed = score >= 5;
      if (passed) {
        AsyncStorage.setItem(BADGE_KEY, new Date().toISOString());
        setBadgeEarned(true);
      }
      Animated.timing(successAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      animateTransition(() => setPhase('complete'));
    }
  };

  const handleRestart = () => {
    animateTransition(() => {
      setPhase('intro');
      setCurrentIndex(0);
      setSelectedOption(null);
      setScore(0);
      setAnswers(new Array(QUESTIONS.length).fill(null));
      setBadgeEarned(false);
    });
  };

  const pct = Math.round((score / QUESTIONS.length) * 100);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => { Speech.stop(); router.back(); }}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>CHA Clinical Training</Text>
          <Text style={styles.navSub}>MediAid Knowledge Quiz</Text>
        </View>
        {phase === 'question' || phase === 'feedback' ? (
          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>{currentIndex + 1}/{QUESTIONS.length}</Text>
          </View>
        ) : null}
      </View>

      <Animated.ScrollView
        style={[{ flex: 1 }, { opacity: fadeAnim }]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── INTRO ── */}
        {phase === 'intro' && (
          <View style={styles.introContainer}>
            <View style={styles.quizIconCircle}>
              <MaterialIcons name="quiz" size={64} color={theme.primary} />
            </View>
            <Text style={styles.introTitle}>Clinical Knowledge Quiz</Text>
            <Text style={styles.introSub}>
              Test your understanding of MediAid's clinical thresholds, AI algorithms, and peer-reviewed evidence.
              {'\n\n'}7 questions · Multiple choice · Audio feedback
            </Text>

            {/* Topics */}
            <View style={styles.topicsGrid}>
              {QUESTIONS.map((q) => (
                <View key={q.id} style={[styles.topicChip, { borderColor: q.color + '44', backgroundColor: q.color + '12' }]}>
                  <MaterialIcons name={q.icon as any} size={14} color={q.color} />
                  <Text style={[styles.topicChipText, { color: q.color }]}>{q.category}</Text>
                </View>
              ))}
            </View>

            {previousBadge && (
              <View style={styles.badgeBanner}>
                <MaterialIcons name="emoji-events" size={20} color={theme.statusYellow} />
                <Text style={styles.badgeBannerText}>Badge earned previously — retake to refresh knowledge</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
              onPress={handleStart}
            >
              <MaterialIcons name="play-arrow" size={24} color="#FFF" />
              <Text style={styles.startBtnText}>Start Quiz</Text>
            </Pressable>
          </View>
        )}

        {/* ── QUESTION ── */}
        {(phase === 'question' || phase === 'feedback') && currentQ && (
          <View style={styles.questionContainer}>
            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${((currentIndex) / QUESTIONS.length) * 100}%`, backgroundColor: currentQ.color }]} />
            </View>

            {/* Score running total */}
            <View style={styles.scoreRow}>
              <View style={[styles.categoryChip, { borderColor: currentQ.color + '55', backgroundColor: currentQ.color + '15' }]}>
                <MaterialIcons name={currentQ.icon as any} size={13} color={currentQ.color} />
                <Text style={[styles.categoryChipText, { color: currentQ.color }]}>{currentQ.category}</Text>
              </View>
              <View style={styles.liveScore}>
                <MaterialIcons name="star" size={14} color={theme.statusYellow} />
                <Text style={styles.liveScoreText}>{score}/{currentIndex}</Text>
              </View>
            </View>

            {/* Question text */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Text style={styles.questionText}>{currentQ.question}</Text>
            </Animated.View>

            {/* Options */}
            <View style={styles.optionsGrid}>
              {currentQ.options.map((opt, i) => {
                const isSelected = selectedOption === i;
                const correctAnswer = phase === 'feedback' && i === currentQ.correct;
                const wrongAnswer = phase === 'feedback' && isSelected && !isCorrect;

                let borderColor = theme.border;
                let bgColor = theme.surface;
                let textColor = theme.textPrimary;

                if (correctAnswer) {
                  borderColor = theme.statusGreen;
                  bgColor = theme.statusGreenBg;
                  textColor = theme.statusGreen;
                } else if (wrongAnswer) {
                  borderColor = theme.statusRed;
                  bgColor = theme.statusRedBg;
                  textColor = theme.statusRed;
                } else if (isSelected && phase === 'question') {
                  borderColor = currentQ.color;
                  bgColor = currentQ.color + '15';
                }

                return (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      styles.optionBtn,
                      { borderColor, backgroundColor: bgColor },
                      pressed && phase === 'question' && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => handleAnswer(i)}
                    disabled={phase === 'feedback'}
                  >
                    <View style={[styles.optionLetter, { borderColor, backgroundColor: bgColor }]}>
                      <Text style={[styles.optionLetterText, { color: textColor }]}>
                        {['A', 'B', 'C', 'D'][i]}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, { color: textColor, flex: 1 }]}>{opt}</Text>
                    {correctAnswer && <MaterialIcons name="check-circle" size={20} color={theme.statusGreen} />}
                    {wrongAnswer && <MaterialIcons name="cancel" size={20} color={theme.statusRed} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Explanation (shown after answering) */}
            {phase === 'feedback' && (
              <View style={[
                styles.explanationBox,
                { borderColor: isCorrect ? theme.statusGreen + '55' : theme.statusRed + '55',
                  backgroundColor: isCorrect ? theme.statusGreenBg : theme.statusRedBg }
              ]}>
                <View style={styles.explanationHeader}>
                  <MaterialIcons
                    name={isCorrect ? 'check-circle' : 'cancel'}
                    size={22}
                    color={isCorrect ? theme.statusGreen : theme.statusRed}
                  />
                  <Text style={[styles.explanationResult, { color: isCorrect ? theme.statusGreen : theme.statusRed }]}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </Text>
                  <Pressable
                    style={styles.ttsBtn}
                    onPress={() => Speech.speak(currentQ.explanation, {
                      language: language === 'fr' ? 'fr-FR' : 'en-US', rate: 0.9
                    })}
                  >
                    <MaterialIcons name="volume-up" size={16} color={theme.primary} />
                  </Pressable>
                </View>
                <Text style={styles.explanationText}>{currentQ.explanation}</Text>
                <View style={styles.citationRow}>
                  <MaterialIcons name="science" size={12} color={theme.textMuted} />
                  <Text style={styles.citationText}>{currentQ.citation}</Text>
                </View>
              </View>
            )}

            {phase === 'feedback' && (
              <Pressable
                style={({ pressed }) => [styles.nextBtn, { backgroundColor: currentQ.color }, pressed && { opacity: 0.85 }]}
                onPress={handleNext}
              >
                <Text style={styles.nextBtnText}>
                  {currentIndex < QUESTIONS.length - 1 ? 'Next Question' : 'See Results'}
                </Text>
                <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
              </Pressable>
            )}
          </View>
        )}

        {/* ── COMPLETE ── */}
        {phase === 'complete' && (
          <View style={styles.completeContainer}>
            {/* Badge / score */}
            <Animated.View style={[styles.badgeCircle, {
              backgroundColor: score >= 5 ? theme.statusYellow + '22' : theme.surface,
              borderColor: score >= 5 ? theme.statusYellow : theme.border,
              transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              opacity: successAnim,
            }]}>
              <MaterialIcons
                name={score >= 5 ? 'emoji-events' : 'quiz'}
                size={64}
                color={score >= 5 ? theme.statusYellow : theme.textMuted}
              />
              <Text style={[styles.badgeScore, { color: score >= 5 ? theme.statusYellow : theme.textPrimary }]}>
                {score}/{QUESTIONS.length}
              </Text>
              <Text style={[styles.badgePct, { color: score >= 5 ? theme.statusYellow : theme.textSecondary }]}>
                {pct}% correct
              </Text>
            </Animated.View>

            <Text style={styles.completeTitle}>
              {score >= 6 ? 'Outstanding!' : score >= 5 ? 'Quiz Passed!' : 'Keep Practicing'}
            </Text>
            <Text style={styles.completeSub}>
              {score >= 5
                ? 'You have demonstrated clinical knowledge of MediAid thresholds and peer-reviewed evidence. Badge earned!'
                : `You answered ${score} of ${QUESTIONS.length} correctly. Review the explanations and try again to earn your badge.`}
            </Text>

            {/* Per-question review */}
            <Text style={styles.reviewTitle}>QUESTION REVIEW</Text>
            {QUESTIONS.map((q, i) => {
              const userAnswer = answers[i];
              const correct = userAnswer === q.correct;
              return (
                <View key={q.id} style={[styles.reviewRow, { borderLeftColor: correct ? theme.statusGreen : theme.statusRed }]}>
                  <MaterialIcons
                    name={correct ? 'check-circle' : 'cancel'}
                    size={18}
                    color={correct ? theme.statusGreen : theme.statusRed}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewQ} numberOfLines={2}>{q.question}</Text>
                    <Text style={[styles.reviewA, { color: correct ? theme.statusGreen : theme.statusRed }]}>
                      {userAnswer !== null ? q.options[userAnswer] : 'Not answered'}
                    </Text>
                    {!correct && (
                      <Text style={styles.reviewCorrect}>Correct: {q.options[q.correct]}</Text>
                    )}
                  </View>
                </View>
              );
            })}

            <View style={styles.completeBtns}>
              <Pressable
                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
                onPress={handleRestart}
              >
                <MaterialIcons name="refresh" size={18} color={theme.primary} />
                <Text style={styles.retryBtnText}>Retake Quiz</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
                onPress={() => { Speech.stop(); router.back(); }}
              >
                <MaterialIcons name="check" size={18} color="#FFF" />
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  navTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  progressPill: {
    backgroundColor: theme.primary + '22', borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  progressPillText: { fontSize: 12, fontWeight: '700', color: theme.primary },

  // Intro
  introContainer: { alignItems: 'center', paddingTop: 24, gap: 16 },
  quizIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: theme.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.primary + '44',
    marginBottom: 8,
  },
  introTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  introSub: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 24 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginVertical: 8 },
  topicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  topicChipText: { fontSize: 11, fontWeight: '700' },
  badgeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.medium,
    padding: 12, borderWidth: 1, borderColor: theme.statusYellow + '44',
    width: '100%',
  },
  badgeBannerText: { flex: 1, fontSize: 13, color: theme.statusYellow, fontWeight: '600' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 32, paddingVertical: 16,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
    marginTop: 8,
  },
  startBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },

  // Question
  questionContainer: { paddingTop: 16, gap: 14 },
  progressBar: {
    height: 5, backgroundColor: theme.surface, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: 3 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: theme.radius.full, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  categoryChipText: { fontSize: 11, fontWeight: '700' },
  liveScore: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: 'auto',
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  liveScoreText: { fontSize: 12, fontWeight: '700', color: theme.statusYellow },
  questionText: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, lineHeight: 28 },
  optionsGrid: { gap: 10 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: theme.radius.medium, borderWidth: 1.5,
    padding: 14,
  },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  optionLetterText: { fontSize: 13, fontWeight: '700' },
  optionText: { fontSize: 14, lineHeight: 20 },
  explanationBox: {
    borderRadius: theme.radius.medium, borderWidth: 1, padding: 14, gap: 10,
  },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  explanationResult: { fontSize: 16, fontWeight: '700', flex: 1 },
  ttsBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.primary + '18', borderWidth: 1, borderColor: theme.primary + '44',
  },
  explanationText: { fontSize: 14, color: theme.textPrimary, lineHeight: 22 },
  citationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  citationText: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic', flex: 1 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: theme.radius.full, padding: 16,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Complete
  completeContainer: { paddingTop: 24, gap: 16, alignItems: 'center' },
  badgeCircle: {
    width: 160, height: 160, borderRadius: 80,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, gap: 4, marginBottom: 8,
  },
  badgeScore: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  badgePct: { fontSize: 13, fontWeight: '600' },
  completeTitle: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  completeSub: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 24 },
  reviewTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', alignSelf: 'flex-start' },
  reviewRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, borderLeftWidth: 3, borderWidth: 1, borderColor: theme.border,
    width: '100%',
  },
  reviewQ: { fontSize: 13, color: theme.textPrimary, fontWeight: '500', lineHeight: 18, marginBottom: 4 },
  reviewA: { fontSize: 12, fontWeight: '700' },
  reviewCorrect: { fontSize: 12, color: theme.statusGreen, fontWeight: '600', marginTop: 2 },
  completeBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  retryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary + '18', borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.primary + '44',
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  doneBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium, padding: 14,
  },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
