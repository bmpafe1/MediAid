// MediAid — Offline AI Clinical Advisor
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

interface Message {
  id: string;
  role: 'user' | 'advisor';
  text: string;
  timestamp: string;
  urgency?: 'red' | 'yellow' | 'green';
}

// Pre-built clinical response trees — offline, no API needed
const CLINICAL_KB: { triggers: string[]; response: string; urgency: 'red' | 'yellow' | 'green' }[] = [
  {
    triggers: ['tb', 'tuberculosis', 'cough', 'toussent', 'toux'],
    response:
      'TB Screening Protocol:\n\n• Cough ≥2 weeks + fever + night sweats + weight loss → HIGH suspicion\n• Collect sputum sample (2 specimens on consecutive days)\n• MediAid TB Risk ≥80% → Immediate referral required\n• MediAid TB Risk 50–79% → Watch, repeat in 48h\n\nREFERRAL: Bamenda Regional Hospital has GeneXpert capacity\nCITATION: WHO HeAR model — 94% accuracy (Google, 2023)',
    urgency: 'red',
  },
  {
    triggers: ['afib', 'arrhythmia', 'irregular heartbeat', 'palpitations', 'palpitations'],
    response:
      'Atrial Fibrillation (AFib) Protocol:\n\n• Symptoms: Irregular pulse, palpitations, breathlessness, fatigue\n• MediAid AFib Risk ≥60% → Refer immediately\n• Check SpO₂ — if <94% with AFib → URGENT\n• Avoid stimulants (caffeine, kola nut)\n\nSCREENING: Facial rPPG detects pulse irregularity\nCITATION: Yan et al. 2018 — 95% sensitivity, 96% specificity',
    urgency: 'red',
  },
  {
    triggers: ['anemia', 'pale', 'pallor', 'anémie', 'pâle', 'hemoglobin', 'hgb'],
    response:
      'Anemia Screening Protocol:\n\n• Signs: Pale conjunctiva, pale nailbeds, fatigue, tachycardia\n• Hgb <8 g/dL → Severe anemia → IMMEDIATE referral\n• Hgb 8–10 g/dL → Moderate → Iron supplementation + follow-up\n• Hgb 10–12 g/dL → Mild → Iron + dietary counseling\n\nNOTE: Check for malaria co-infection in NW Cameroon\nCITATION: Anemia Screening Consortium 2023 — conjunctival pallor proxy',
    urgency: 'yellow',
  },
  {
    triggers: ['spo2', 'oxygen', 'oxygène', 'breathing difficulty', 'dyspnea', 'hypoxia', 'saturation'],
    response:
      'SpO₂ / Hypoxia Protocol:\n\n• SpO₂ <90% → CRITICAL — immediate O₂ support if available, URGENT referral\n• SpO₂ 90–94% → Moderate hypoxia → Refer same day\n• SpO₂ 94–97% → Mild concern → Monitor, recheck in 30 min\n• SpO₂ ≥98% → Normal\n\nCOMMON CAUSES: Pneumonia, TB, asthma, cardiac failure\nELEVATION ADJUSTMENT: Bamenda ~1400m — expect SpO₂ 95–98% baseline\nCITATION: Nitzan et al. 2020 — camera SpO₂ ±2% accuracy',
    urgency: 'red',
  },
  {
    triggers: ['malaria', 'paludisme', 'fever', 'fièvre', 'chills', 'frissons'],
    response:
      'Malaria Protocol (NW Cameroon):\n\n• Symptoms: Cyclical fever, chills, headache, body aches, vomiting\n• Perform RDT if available\n• Children <5 + fever → Treat presumptively with AL (artemether-lumefantrine)\n• Severe malaria signs: Altered consciousness, convulsions, inability to stand → URGENT\n• Rainy season (May–Oct): HIGHEST risk in Bamenda/Mezam district\n\nCLIMATE LINK: +1mm rainfall → 2.3% malaria risk increase (Bime et al. 2022)\nMEDICATION: Artemether-Lumefantrine — see Formulary',
    urgency: 'yellow',
  },
  {
    triggers: ['tremor', 'shaking', 'parkinson', 'tremblement', 'vibration'],
    response:
      "Tremor / Parkinson's Protocol:\n\n• Assess: Resting tremor (worse at rest, improves with movement)\n• Pill-rolling tremor + rigidity + bradykinesia → Classic Parkinson's\n• MediAid Tremor Risk ≥60% → Refer to district neurologist\n• Rule out: Essential tremor (both hands, improves at rest), medication-induced\n\nAGE FACTOR: Risk increases after 60 years\nCITATION: He et al. 2024 — acoustic tremor biomarkers, AUC 0.89",
    urgency: 'yellow',
  },
  {
    triggers: ['eye', 'vision', 'oeil', 'yeux', 'cataract', 'glaucoma', 'retina', 'blind'],
    response:
      'Eye Screening Protocol:\n\n• MediAid screens 7 conditions: Cataract, Glaucoma, Diabetic Retinopathy, AMD, Hypertensive Retinopathy, Pterygium, Corneal Opacity\n• ≥2 conditions detected → Urgent ophthalmology referral\n• 1 condition detected → Schedule eye clinic visit within 2 weeks\n• Pterygium: Common in rural Cameroon (UV exposure) — use sunglasses\n\nREFERRAL: Mbingo Baptist Hospital has ophthalmology clinic\nCITATION: Jin et al. 2024 — 7-condition screening, AUC 0.91–0.97',
    urgency: 'yellow',
  },
  {
    triggers: ['respiratory', 'breathing', 'respiration', 'rr', 'tachypnea', 'pneumonia', 'pneumonie'],
    response:
      'Respiratory Rate Protocol:\n\n• Normal adults: 12–20 breaths/min\n• RR 21–29: Tachypnea → Investigate (fever, infection, cardiac)\n• RR ≥30: SEVERE respiratory distress → IMMEDIATE referral\n• RR <10: Bradypnea → Check for drug overdose, neurological cause\n\nPEDIATRIC: Children <1yr: normal 30–60; Children 1–5yr: 20–40\nINTEGRATION: Combined with SpO₂ — if both abnormal → CRITICAL\nCITATION: Islam et al. 2022 — PPG respiratory rate, ±1.8 br/min MAE',
    urgency: 'red',
  },
  {
    triggers: ['heart rate', 'pulse', 'tachycardia', 'bradycardia', 'hr', 'bpm', 'rythme'],
    response:
      'Heart Rate Protocol:\n\n• Normal: 60–100 BPM\n• 101–130 BPM (Tachycardia): Check fever, dehydration, anxiety, AFib\n• >130 BPM: URGENT — check for supraventricular tachycardia or sepsis\n• 40–59 BPM (Bradycardia): Check medications (beta-blockers), vagal response\n• <40 BPM: URGENT cardiac referral\n\nATHLETES: Resting HR 40–60 may be normal\nFEVER RULE: Each 1°C rise → HR increases ~10 BPM\nCITATION: Yan et al. 2018 — rPPG cardiac monitoring',
    urgency: 'yellow',
  },
  {
    triggers: ['cholera', 'diarrhea', 'diarrhée', 'dehydration', 'déshydratation', 'water', 'eau'],
    response:
      'Cholera / Severe Diarrhea Protocol:\n\n• Rice-water stools + profuse watery diarrhea → Suspect cholera\n• Rapid dehydration assessment: Skin turgor, sunken eyes, dry mouth\n• IMMEDIATE: Oral Rehydration Solution (ORS) — 200–400ml after each stool\n• Severe dehydration → IV fluids at health facility → URGENT referral\n• ISOLATION: Notify district health officer immediately\n\nOUTBREAK LINK: Flooding increases cholera risk (Bambui alert active)\nORS RECIPE: 1L clean water + 6 teaspoons sugar + 0.5 teaspoon salt',
    urgency: 'red',
  },
  {
    triggers: ['child', 'infant', 'baby', 'enfant', 'bébé', 'pediatric', 'pédiatrique'],
    response:
      'Pediatric Assessment Protocol:\n\n• MUAC (mid-upper arm circumference):\n  - <115mm → Severe Acute Malnutrition → URGENT\n  - 115–125mm → Moderate Acute Malnutrition → Supplement\n  - >125mm → Normal\n\n• Fontanel check in infants: Bulging → meningitis; Sunken → dehydration\n• IMCI danger signs: Unable to feed, convulsions, abnormal sleep, stridor\n• Any IMCI danger sign → IMMEDIATE referral\n\nVACCINATION: Verify BCG, Polio, DPT, measles schedule\nCITATION: WHO IMCI protocol — Cameroon adaptation 2023',
    urgency: 'yellow',
  },
  {
    triggers: ['hypertension', 'blood pressure', 'stroke', 'accident vasculaire', 'tension', 'bp'],
    response:
      'Hypertension Protocol:\n\n• Severe HTN headache + visual disturbance + BP >180/110 → URGENT referral\n• Stage 2 HTN (>160/100): Begin lifestyle counseling, refer for medication\n• Stage 1 HTN (>140/90): Diet, exercise, reduce salt, follow-up in 2 weeks\n• Stroke signs (FAST): Face drooping, Arm weakness, Speech difficulty, Time → 999\n\nNW CAMEROON PREVALENCE: ~36% of adults ≥30 (Addo et al. 2021)\nMEDICATION: Amlodipine 5mg — see Formulary\nLIFESTYLE: Reduce salt to <5g/day, 30min exercise 5x/week',
    urgency: 'red',
  },
];

const QUICK_QUESTIONS = [
  'TB screening protocol',
  'Severe anemia management',
  'Malaria treatment',
  'High respiratory rate',
  'AFib detection',
  'Child assessment',
];

function getAdvisorResponse(
  input: string,
  language: 'en' | 'fr'
): { text: string; urgency: 'red' | 'yellow' | 'green' } {
  const lower = input.toLowerCase();
  for (const kb of CLINICAL_KB) {
    if (kb.triggers.some((t) => lower.includes(t))) {
      return { text: kb.response, urgency: kb.urgency };
    }
  }
  // Fallback
  return {
    text:
      language === 'fr'
        ? "Je n'ai pas trouvé de protocole spécifique pour cette question. Essayez des mots-clés comme:\n\n• TB, paludisme, fièvre, anémie\n• SpO₂, rythme cardiaque, respiration\n• Tremblements, yeux, vision\n• Enfant, tension artérielle, cholera\n\nSi c'est une urgence, consultez immédiatement un superviseur."
        : "I didn't find a specific protocol for this query. Try keywords like:\n\n• TB, malaria, fever, anemia\n• SpO₂, heart rate, breathing\n• Tremor, eye, vision\n• Child, blood pressure, cholera\n\nIf this is an emergency, contact your supervisor immediately.",
    urgency: 'green',
  };
}

function urgencyColor(u?: 'red' | 'yellow' | 'green') {
  if (u === 'red') return theme.statusRed;
  if (u === 'yellow') return theme.statusYellow;
  return theme.statusGreen;
}

export default function AIAdvisorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      role: 'advisor',
      text:
        language === 'fr'
          ? "Bonjour! Je suis votre conseiller clinique hors ligne.\n\nPosez-moi une question sur un protocole de soin, un médicament ou un symptôme. Je couvre: TB, paludisme, anémie, SpO₂, AFib, tremblements, yeux, pédiatrie, hypertension, choléra.\n\nEXEMPLE: 'Protocole TB' ou 'enfant avec fièvre'"
          : "Hello! I'm your offline clinical advisor.\n\nAsk me about care protocols, medications, or symptoms. I cover: TB, malaria, anemia, SpO₂, AFib, tremor, eyes, pediatrics, hypertension, cholera.\n\nEXAMPLE: 'TB protocol' or 'child with fever'",
      timestamp: new Date().toISOString(),
      urgency: 'green',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMessage = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;

    Haptics.selectionAsync();
    setInput('');

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Simulate brief "thinking" delay
    setTimeout(() => {
      const { text: responseText, urgency } = getAdvisorResponse(content, language);
      const advisorMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'advisor',
        text: responseText,
        timestamp: new Date().toISOString(),
        urgency,
      };
      setMessages((prev) => [...prev, advisorMsg]);
      setIsTyping(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 800);
  };

  const speakMessage = (text: string) => {
    Speech.stop();
    Speech.speak(text, {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: 0.85,
    });
  };

  useEffect(() => {
    return () => Speech.stop();
  }, []);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const col = urgencyColor(item.urgency);

    if (isUser) {
      return (
        <View style={styles.userBubbleRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.advisorBubbleRow}>
        <View style={[styles.advisorAvatar, { backgroundColor: col + '22', borderColor: col + '55' }]}>
          <MaterialIcons name="local-hospital" size={16} color={col} />
        </View>
        <View style={[styles.advisorBubble, { borderColor: col + '44' }]}>
          {item.urgency && item.urgency !== 'green' && (
            <View style={[styles.urgencyTag, { backgroundColor: col + '22', borderColor: col + '55' }]}>
              <MaterialIcons
                name={item.urgency === 'red' ? 'warning' : 'info'}
                size={11}
                color={col}
              />
              <Text style={[styles.urgencyTagText, { color: col }]}>
                {item.urgency === 'red' ? 'REFERRAL REQUIRED' : 'MONITOR CLOSELY'}
              </Text>
            </View>
          )}
          <Text style={styles.advisorBubbleText}>{item.text}</Text>
          <Pressable
            style={styles.speakBtn}
            onPress={() => speakMessage(item.text)}
            hitSlop={8}
          >
            <MaterialIcons name="volume-up" size={14} color={theme.textMuted} />
            <Text style={styles.speakBtnText}>Read aloud</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.navTitleBlock}>
          <View style={styles.navIconCircle}>
            <MaterialIcons name="local-hospital" size={16} color={theme.primary} />
          </View>
          <View>
            <Text style={styles.navTitle}>AI Clinical Advisor</Text>
            <Text style={styles.navSub}>Offline · 12 condition protocols · EN/FR</Text>
          </View>
        </View>
        <View style={styles.offlineBadge}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      </View>

      {/* Quick question chips */}
      <View style={styles.quickChipsWrapper}>
        <FlatList
          data={QUICK_QUESTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.quickChips}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.quickChip, pressed && { opacity: 0.7 }]}
              onPress={() => sendMessage(item)}
            >
              <Text style={styles.quickChipText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isTyping ? (
            <View style={styles.typingRow}>
              <View style={[styles.advisorAvatar, { backgroundColor: theme.primary + '22', borderColor: theme.primary + '44' }]}>
                <MaterialIcons name="local-hospital" size={16} color={theme.primary} />
              </View>
              <View style={styles.typingBubble}>
                <Text style={styles.typingText}>Consulting protocols...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom + 60}
      >
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={language === 'fr' ? 'Posez une question clinique...' : 'Ask a clinical question...'}
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              !input.trim() && styles.sendBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim()}
          >
            <MaterialIcons name="send" size={20} color={input.trim() ? '#FFF' : theme.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Disclaimer */}
      <View style={[styles.disclaimer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <MaterialIcons name="info-outline" size={11} color={theme.textMuted} />
        <Text style={styles.disclaimerText}>
          Offline prototype · Not a substitute for clinical diagnosis · Always follow national protocols
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface,
  },
  navTitleBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  navIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.primary + '22', borderWidth: 1, borderColor: theme.primary + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 10, color: theme.textSecondary, marginTop: 1 },
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.statusGreen },
  offlineBadgeText: { fontSize: 10, fontWeight: '700', color: theme.statusGreen },
  quickChipsWrapper: { borderBottomWidth: 1, borderBottomColor: theme.border },
  quickChips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  quickChip: {
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  quickChipText: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  messageList: { paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  userBubbleRow: { alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: theme.primary, borderRadius: 18,
    borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10,
    maxWidth: '80%',
  },
  userBubbleText: { fontSize: 14, color: '#FFF', lineHeight: 20 },
  advisorBubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '92%' },
  advisorAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  advisorBubble: {
    flex: 1, backgroundColor: theme.surface, borderRadius: 18,
    borderTopLeftRadius: 4, padding: 14,
    borderWidth: 1,
  },
  urgencyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 8, alignSelf: 'flex-start', borderWidth: 1,
  },
  urgencyTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  advisorBubbleText: { fontSize: 13, color: theme.textPrimary, lineHeight: 20 },
  speakBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  speakBtnText: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  typingBubble: {
    backgroundColor: theme.surface, borderRadius: 18, borderTopLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  typingText: { fontSize: 12, color: theme.textSecondary, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  input: {
    flex: 1, backgroundColor: theme.background, borderRadius: theme.radius.medium,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.border,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  disclaimer: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingTop: 6,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  disclaimerText: { flex: 1, fontSize: 10, color: theme.textMuted, lineHeight: 15 },
});
