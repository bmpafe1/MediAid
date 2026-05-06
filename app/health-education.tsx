// MediAid — Health Education Cards with TTS narration (EN/FR)
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
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

interface EducationCard {
  id: string;
  topic: string;
  icon: string;
  color: string;
  audience: 'patient' | 'cha' | 'both';
  keyMessages: string[];
  doList: string[];
  dontList: string[];
  citation: string;
  en: {
    title: string;
    summary: string;
    narration: string;
  };
  fr: {
    title: string;
    summary: string;
    narration: string;
  };
}

const EDUCATION_CARDS: EducationCard[] = [
  {
    id: 'malaria',
    topic: 'Malaria Prevention',
    icon: 'bug-report',
    color: '#F59E0B',
    audience: 'patient',
    keyMessages: ['Sleep under treated bednets every night', 'Remove stagnant water near home', 'Seek care within 24h of fever'],
    doList: ['Use insecticide-treated nets (ITN)', 'Take full ACT course if RDT positive', 'Report fever to CHA immediately'],
    dontList: ['Do not delay treatment', 'Do not share malaria medication', 'Do not use expired RDTs'],
    citation: 'WHO Global Malaria Report 2023 — bednet efficacy 80%+',
    en: {
      title: 'Malaria Prevention & Treatment',
      summary: 'Malaria is caused by mosquito bites. Sleep under treated bednets. Seek care within 24 hours of fever.',
      narration: 'Malaria is a serious disease spread by mosquito bites. Always sleep under a treated bednet. If you or your child has a fever, see your community health worker within 24 hours. Take all your malaria medicine even if you feel better. Remove standing water near your home to stop mosquitoes from breeding.',
    },
    fr: {
      title: 'Prévention et Traitement du Paludisme',
      summary: 'Le paludisme est causé par les piqûres de moustiques. Dormez sous moustiquaire. Consultez en cas de fièvre dans les 24 heures.',
      narration: 'Le paludisme est une maladie grave transmise par les piqûres de moustiques. Dormez toujours sous une moustiquaire imprégnée. Si vous ou votre enfant avez de la fièvre, consultez votre agent de santé communautaire dans les 24 heures. Prenez tous vos médicaments contre le paludisme même si vous vous sentez mieux.',
    },
  },
  {
    id: 'tb',
    topic: 'Tuberculosis (TB)',
    icon: 'air',
    color: theme.statusRed,
    audience: 'both',
    keyMessages: ['TB is curable with 6 months of treatment', 'Cover mouth when coughing', 'Ventilate your home'],
    doList: ['Complete full 6-month TB treatment', 'Take medications every day', 'Report cough >2 weeks to CHA'],
    dontList: ['Do not stop treatment early', 'Do not share cups or utensils', 'Do not spit in public'],
    citation: 'WHO TB Guidelines 2023 — 85% cure rate with DOTS',
    en: {
      title: 'Tuberculosis (TB) Awareness',
      summary: 'TB is a lung infection spread through the air. A cough lasting more than 2 weeks may be TB. TB is fully curable.',
      narration: 'Tuberculosis, or TB, is an infection that spreads through the air when an infected person coughs. If you have had a cough for more than two weeks, night sweats, or unexplained weight loss, please see your health worker today. TB is curable. You must take your medicines every day for six months without stopping. Stopping early can make the disease worse and untreatable.',
    },
    fr: {
      title: 'Sensibilisation à la Tuberculose (TB)',
      summary: 'La TB est une infection pulmonaire qui se propage dans l\'air. Une toux de plus de 2 semaines peut être la TB. La TB est guérissable.',
      narration: 'La tuberculose se propage dans l\'air quand une personne infectée tousse. Si vous toussez depuis plus de deux semaines, si vous avez des sueurs nocturnes ou une perte de poids inexpliquée, consultez votre agent de santé aujourd\'hui. La TB est guérissable. Vous devez prendre vos médicaments chaque jour pendant six mois sans arrêter.',
    },
  },
  {
    id: 'handwashing',
    topic: 'Handwashing & Hygiene',
    icon: 'wash',
    color: theme.primary,
    audience: 'patient',
    keyMessages: ['Wash hands with soap for 20 seconds', 'Wash before eating and after toilet', 'Clean water prevents diarrhea'],
    doList: ['Use soap and clean water', 'Wash before preparing food', 'Boil or treat drinking water'],
    dontList: ['Do not use dirty water for cooking', 'Do not defecate near water sources', 'Do not share towels during illness'],
    citation: 'WHO WASH Guidelines 2021 — handwashing reduces diarrhea 40%',
    en: {
      title: 'Handwashing & Hygiene',
      summary: 'Washing hands with soap for 20 seconds prevents most infections including cholera and diarrhea.',
      narration: 'Washing your hands with soap and clean water for at least 20 seconds is one of the most powerful ways to prevent disease. Wash your hands before eating, before preparing food, and after using the toilet. Clean drinking water is essential. If water is not clean, boil it or use water treatment tablets before drinking.',
    },
    fr: {
      title: 'Hygiène et Lavage des Mains',
      summary: 'Se laver les mains avec du savon pendant 20 secondes prévient la plupart des infections.',
      narration: 'Se laver les mains avec du savon et de l\'eau propre pendant au moins 20 secondes est l\'un des moyens les plus puissants de prévenir les maladies. Lavez-vous les mains avant de manger, avant de préparer les aliments et après être allé aux toilettes. L\'eau potable propre est essentielle.',
    },
  },
  {
    id: 'nutrition',
    topic: 'Nutrition & Anemia',
    icon: 'restaurant',
    color: '#10B981',
    audience: 'patient',
    keyMessages: ['Eat iron-rich foods: dark leafy greens, liver, beans', 'Vitamin C helps iron absorption', 'Pallor in eyes or lips = see CHA'],
    doList: ['Eat varied diet with protein', 'Give children vitamin A supplements', 'Breastfeed exclusively for 6 months'],
    dontList: ['Do not skip meals during illness', 'Do not give sugary drinks instead of food', 'Do not ignore pallor signs in children'],
    citation: 'WHO Nutrition Guidelines 2022 — iron deficiency affects 42% of Cameroonian women',
    en: {
      title: 'Nutrition & Anemia Prevention',
      summary: 'Anemia from iron deficiency is common. Eat dark leafy vegetables, beans, and liver. Paleness in eyes means low blood.',
      narration: 'Anemia means you do not have enough iron in your blood. Eat dark green leafy vegetables, beans, fish, and liver to get more iron. Vitamin C from fruits like oranges helps your body absorb iron. If your child is pale in the eyes or lips, or is very tired, bring them to your community health worker. Breastfeed your baby exclusively for the first six months.',
    },
    fr: {
      title: 'Nutrition et Prévention de l\'Anémie',
      summary: 'L\'anémie par carence en fer est fréquente. Mangez des légumes verts foncés, des haricots et du foie.',
      narration: 'L\'anémie signifie que vous n\'avez pas assez de fer dans le sang. Mangez des légumes verts foncés, des haricots, du poisson et du foie pour obtenir plus de fer. La vitamine C des fruits comme les oranges aide votre corps à absorber le fer. Si votre enfant a les yeux ou les lèvres pâles, consultez votre agent de santé.',
    },
  },
  {
    id: 'antenatal',
    topic: 'Antenatal Care',
    icon: 'pregnant-woman',
    color: '#EC4899',
    audience: 'patient',
    keyMessages: ['Visit clinic at least 4 times during pregnancy', 'Take iron and folic acid daily', 'Deliver at a health facility'],
    doList: ['Attend all prenatal check-ups', 'Sleep under bednet during pregnancy', 'Report any bleeding or severe headache immediately'],
    dontList: ['Do not deliver at home without skilled birth attendant', 'Do not take herbal medicines without consulting CHA', 'Do not ignore reduced fetal movement'],
    citation: 'WHO ANC Guidelines 2022 — 4+ visits reduce maternal mortality 32%',
    en: {
      title: 'Antenatal Care for Pregnant Women',
      summary: 'Pregnant women should visit the clinic at least 4 times. Take iron and folic acid every day. Deliver at a health facility.',
      narration: 'If you are pregnant, visit the health clinic at least four times during your pregnancy. Take your iron and folic acid tablets every day to prevent anemia. Always sleep under a treated bednet to protect yourself and your baby from malaria. If you have severe headache, vision problems, bleeding, or reduced baby movement, go to the clinic immediately.',
    },
    fr: {
      title: 'Soins Prénatals pour les Femmes Enceintes',
      summary: 'Les femmes enceintes doivent visiter la clinique au moins 4 fois. Prenez du fer et de l\'acide folique chaque jour.',
      narration: 'Si vous êtes enceinte, visitez la clinique de santé au moins quatre fois pendant votre grossesse. Prenez vos comprimés de fer et d\'acide folique chaque jour pour prévenir l\'anémie. Dormez toujours sous une moustiquaire traitée pour vous protéger du paludisme.',
    },
  },
  {
    id: 'cholera',
    topic: 'Cholera & Diarrhea',
    icon: 'water-drop',
    color: '#3B82F6',
    audience: 'both',
    keyMessages: ['Drink only boiled or treated water', 'Use ORS for diarrhea — not soda', 'Wash hands after defecation'],
    doList: ['Give ORS immediately for diarrhea', 'Continue breastfeeding during diarrhea', 'Seek care if diarrhea lasts >3 days'],
    dontList: ['Do not use unclean water for drinking', 'Do not give anti-diarrheal medication to children', 'Do not delay ORS if child is vomiting'],
    citation: 'WHO Cholera Outbreak Protocol 2023',
    en: {
      title: 'Cholera & Diarrhea Prevention',
      summary: 'Cholera spreads through contaminated water. Drink only clean water. Give ORS immediately for diarrhea.',
      narration: 'Cholera and diarrhea are caused by bacteria in dirty water and food. Drink only boiled or treated water. Wash your hands with soap after using the toilet and before preparing food. If someone has diarrhea, start Oral Rehydration Salt solution immediately. Mix one ORS packet with one liter of clean water. Seek care if diarrhea lasts more than three days or there is blood in the stool.',
    },
    fr: {
      title: 'Prévention du Choléra et de la Diarrhée',
      summary: 'Le choléra se propage par l\'eau contaminée. Ne buvez que de l\'eau propre. Donnez du SRO immédiatement pour la diarrhée.',
      narration: 'Le choléra et la diarrhée sont causés par des bactéries dans l\'eau et les aliments contaminés. Ne buvez que de l\'eau bouillie ou traitée. Lavez-vous les mains avec du savon après les toilettes. Si quelqu\'un a la diarrhée, commencez immédiatement la solution de réhydratation orale.',
    },
  },
  {
    id: 'afib',
    topic: 'Heart Health & AFib',
    icon: 'monitor-heart',
    color: '#F472B6',
    audience: 'cha',
    keyMessages: ['Irregular heartbeat may be AFib', 'AFib increases stroke risk 5×', 'Use MediAid PPG for rapid screening'],
    doList: ['Check pulse rhythm monthly in elderly', 'Refer irregular pulse to clinic', 'Avoid excessive salt and alcohol'],
    dontList: ['Do not ignore palpitations in elderly', 'Do not give aspirin without medical advice', 'Do not delay referral for chest pain + palpitations'],
    citation: 'Yan et al. 2018 — rPPG AFib detection 95% sensitivity',
    en: {
      title: 'Heart Health & Atrial Fibrillation',
      summary: 'AFib is an irregular heartbeat that increases stroke risk. MediAid screens for AFib using facial video. Refer all cases.',
      narration: 'Atrial fibrillation, or AFib, is an irregular heartbeat that can cause stroke and heart failure. Check the pulse of elderly patients monthly. If the pulse feels irregular or there are palpitations, use MediAid to record the heart rhythm and refer the patient to the clinic. Avoid too much salt and alcohol, which worsen heart conditions.',
    },
    fr: {
      title: 'Santé Cardiaque et Fibrillation Auriculaire',
      summary: 'La fibrillation auriculaire est un rythme cardiaque irrégulier qui augmente le risque d\'AVC. MediAid dépiste la FA.',
      narration: 'La fibrillation auriculaire est un rythme cardiaque irrégulier qui peut causer un AVC et une insuffisance cardiaque. Vérifiez le pouls des patients âgés chaque mois. Si le pouls semble irrégulier, utilisez MediAid pour enregistrer le rythme cardiaque et référez le patient à la clinique.',
    },
  },
  {
    id: 'eye_health',
    topic: 'Eye Health',
    icon: 'remove-red-eye',
    color: '#A78BFA',
    audience: 'both',
    keyMessages: ['Blurred vision may signal diabetes or glaucoma', 'Eye screening identifies 7 conditions', 'Protect eyes from dust and UV'],
    doList: ['Screen eyes with MediAid front camera', 'Refer blurred vision immediately', 'Use protective eyewear in dusty areas'],
    dontList: ['Do not use traditional eye drops', 'Do not rub eyes with dirty hands', 'Do not ignore sudden vision loss'],
    citation: 'Jin et al. 2024 — 7 ocular conditions, AUC 0.91–0.97',
    en: {
      title: 'Eye Health & Vision Screening',
      summary: 'MediAid screens for 7 eye conditions including glaucoma, cataracts and diabetic retinopathy. Refer all vision complaints.',
      narration: 'Good vision is essential for work and school. MediAid can screen for seven eye conditions including glaucoma, cataracts, and diabetic retinopathy using the front camera. If you notice blurred vision, pain in the eyes, or sudden vision loss, see a health worker immediately. Never use traditional eye drops which can cause blindness. Protect your eyes from dust and direct sunlight.',
    },
    fr: {
      title: 'Santé Oculaire et Dépistage de la Vision',
      summary: 'MediAid dépiste 7 conditions oculaires. Référez toutes les plaintes de vision.',
      narration: 'MediAid peut dépister sept maladies oculaires dont le glaucome, la cataracte et la rétinopathie diabétique. Si vous remarquez une vision floue, des douleurs aux yeux ou une perte soudaine de vision, consultez immédiatement un agent de santé. Ne jamais utiliser de gouttes oculaires traditionnelles qui peuvent causer la cécité.',
    },
  },
];

function AudienceBadge({ audience }: { audience: 'patient' | 'cha' | 'both' }) {
  const col = audience === 'patient' ? theme.statusGreen : audience === 'cha' ? theme.primary : '#A78BFA';
  const label = audience === 'patient' ? 'Patient Info' : audience === 'cha' ? 'CHA Training' : 'Both';
  return (
    <View style={[abStyles.badge, { backgroundColor: col + '18', borderColor: col + '44' }]}>
      <MaterialIcons name={audience === 'patient' ? 'person' : audience === 'cha' ? 'school' : 'groups'} size={10} color={col} />
      <Text style={[abStyles.badgeText, { color: col }]}>{label}</Text>
    </View>
  );
}
const abStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '700' },
});

function EducationCardView({ card, expanded, onToggle, isPlaying, onPlay, onStop, language }: {
  card: EducationCard;
  expanded: boolean;
  onToggle: () => void;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  language: string;
}) {
  const content = language === 'fr' ? card.fr : card.en;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  return (
    <Pressable
      style={[edStyles.card, { borderLeftColor: card.color }, isPlaying && edStyles.cardPlaying]}
      onPress={onToggle}
    >
      {/* Header */}
      <View style={edStyles.header}>
        <View style={[edStyles.iconCircle, { backgroundColor: card.color + '22' }]}>
          <MaterialIcons name={card.icon as any} size={24} color={card.color} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[edStyles.topicTitle, { color: card.color }]}>{content.title}</Text>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <AudienceBadge audience={card.audience} />
          </View>
        </View>
        {/* TTS play button */}
        <Animated.View style={isPlaying ? { transform: [{ scale: pulseAnim }] } : {}}>
          <Pressable
            style={[edStyles.playBtn, isPlaying && { backgroundColor: card.color }]}
            onPress={isPlaying ? onStop : onPlay}
            hitSlop={8}
          >
            <MaterialIcons
              name={isPlaying ? 'stop' : 'volume-up'}
              size={18}
              color={isPlaying ? '#FFF' : card.color}
            />
          </Pressable>
        </Animated.View>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22} color={theme.textMuted}
        />
      </View>

      {/* Summary */}
      <Text style={edStyles.summary} numberOfLines={expanded ? undefined : 2}>
        {content.summary}
      </Text>

      {isPlaying && (
        <View style={[edStyles.playingBar, { backgroundColor: card.color + '18', borderColor: card.color + '44' }]}>
          <MaterialIcons name="graphic-eq" size={14} color={card.color} />
          <Text style={[edStyles.playingText, { color: card.color }]}>Narrating in {language === 'fr' ? 'French' : 'English'}...</Text>
        </View>
      )}

      {expanded && (
        <View style={edStyles.expandedContent}>
          {/* Key messages */}
          <Text style={edStyles.sectionLabel}>KEY MESSAGES</Text>
          {card.keyMessages.map((m, i) => (
            <View key={i} style={edStyles.messageRow}>
              <View style={[edStyles.msgDot, { backgroundColor: card.color }]} />
              <Text style={edStyles.messageText}>{m}</Text>
            </View>
          ))}

          {/* Do / Don't */}
          <View style={edStyles.dosDontsRow}>
            <View style={edStyles.dosCol}>
              <View style={edStyles.dosHeader}>
                <MaterialIcons name="check-circle" size={14} color={theme.statusGreen} />
                <Text style={[edStyles.dosTitle, { color: theme.statusGreen }]}>DO</Text>
              </View>
              {card.doList.map((d, i) => (
                <View key={i} style={edStyles.doRow}>
                  <MaterialIcons name="check" size={12} color={theme.statusGreen} />
                  <Text style={edStyles.doText}>{d}</Text>
                </View>
              ))}
            </View>
            <View style={edStyles.dontsCol}>
              <View style={edStyles.dosHeader}>
                <MaterialIcons name="cancel" size={14} color={theme.statusRed} />
                <Text style={[edStyles.dosTitle, { color: theme.statusRed }]}>DON'T</Text>
              </View>
              {card.dontList.map((d, i) => (
                <View key={i} style={edStyles.doRow}>
                  <MaterialIcons name="close" size={12} color={theme.statusRed} />
                  <Text style={edStyles.doText}>{d}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Narration text */}
          <View style={[edStyles.narrationBox, { borderColor: card.color + '33' }]}>
            <View style={edStyles.narrationHeader}>
              <MaterialIcons name="record-voice-over" size={14} color={card.color} />
              <Text style={[edStyles.narrationLabel, { color: card.color }]}>NARRATION SCRIPT ({language === 'fr' ? 'FR' : 'EN'})</Text>
            </View>
            <Text style={edStyles.narrationText}>{content.narration}</Text>
          </View>

          {/* Play full narration */}
          <Pressable
            style={[edStyles.playNarrationBtn, { borderColor: card.color + '44', backgroundColor: card.color + '12' }]}
            onPress={isPlaying ? onStop : onPlay}
          >
            <MaterialIcons name={isPlaying ? 'stop' : 'play-circle'} size={18} color={card.color} />
            <Text style={[edStyles.playNarrationText, { color: card.color }]}>
              {isPlaying ? 'Stop Narration' : 'Play Full Narration Aloud'}
            </Text>
          </Pressable>

          {/* Citation */}
          <View style={edStyles.citationRow}>
            <MaterialIcons name="science" size={11} color={theme.textMuted} />
            <Text style={edStyles.citationText}>{card.citation}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const edStyles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  cardPlaying: { borderWidth: 1.5, borderColor: 'rgba(0,194,255,0.4)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  topicTitle: { fontSize: 15, fontWeight: '700' },
  playBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1.5, borderColor: theme.border,
    marginRight: 4,
  },
  summary: { fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
  playingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: theme.radius.small, paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 8, borderWidth: 1,
  },
  playingText: { fontSize: 11, fontWeight: '600' },
  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  msgDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  messageText: { flex: 1, fontSize: 13, color: theme.textPrimary, lineHeight: 19 },
  dosDontsRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 12 },
  dosCol: { flex: 1 },
  dontsCol: { flex: 1 },
  dosHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  dosTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  doRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 5 },
  doText: { flex: 1, fontSize: 11, color: theme.textSecondary, lineHeight: 16 },
  narrationBox: {
    backgroundColor: theme.background, borderRadius: theme.radius.small,
    padding: 12, borderWidth: 1, marginBottom: 10,
  },
  narrationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  narrationLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  narrationText: { fontSize: 12, color: theme.textSecondary, lineHeight: 19 },
  playNarrationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: theme.radius.medium, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 10, borderWidth: 1,
  },
  playNarrationText: { fontSize: 13, fontWeight: '600' },
  citationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  citationText: { fontSize: 10, color: theme.textMuted, flex: 1 },
});

export default function HealthEducationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'patient' | 'cha'>('all');

  const filtered = EDUCATION_CARDS.filter(
    (c) => audienceFilter === 'all' || c.audience === audienceFilter || c.audience === 'both'
  );

  const playCard = (card: EducationCard) => {
    Speech.stop();
    Haptics.selectionAsync();
    setPlayingId(card.id);
    const content = language === 'fr' ? card.fr : card.en;
    Speech.speak(content.narration, {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: 0.82,
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const stopSpeech = () => {
    Speech.stop();
    setPlayingId(null);
  };

  useEffect(() => { return () => Speech.stop(); }, []);

  const playAll = () => {
    if (playingId) { stopSpeech(); return; }
    let idx = 0;
    const readNext = () => {
      if (idx >= filtered.length) { setPlayingId(null); return; }
      const card = filtered[idx++];
      setPlayingId(card.id);
      const content = language === 'fr' ? card.fr : card.en;
      Speech.speak(content.narration, {
        language: language === 'fr' ? 'fr-FR' : 'en-US',
        rate: 0.82,
        onDone: readNext,
        onStopped: () => setPlayingId(null),
        onError: readNext,
      });
    };
    readNext();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => { Speech.stop(); router.back(); }}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Health Education</Text>
          <Text style={styles.navSub}>8 topics · EN/FR TTS narration</Text>
        </View>
        <Pressable
          style={[styles.playAllBtn, playingId && { backgroundColor: theme.statusRed }]}
          onPress={playAll}
        >
          <MaterialIcons name={playingId ? 'stop' : 'playlist-play'} size={18} color="#FFF" />
          <Text style={styles.playAllText}>{playingId ? 'Stop' : 'Play All'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <MaterialIcons name="menu-book" size={32} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Community Health Education</Text>
            <Text style={styles.heroSub}>
              Use these cards to educate patients and community members.
              Tap the speaker icon to play narration in {language === 'fr' ? 'French' : 'English'}.
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Topics', value: EDUCATION_CARDS.length, color: theme.primary },
            { label: 'Languages', value: 2, color: theme.statusGreen },
            { label: 'With TTS', value: EDUCATION_CARDS.length, color: '#A78BFA' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + '33' }]}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Audience filter */}
        <View style={styles.filterRow}>
          {(['all', 'patient', 'cha'] as const).map((f) => {
            const col = f === 'all' ? theme.primary : f === 'patient' ? theme.statusGreen : '#60A5FA';
            const label = f === 'all' ? 'All Topics' : f === 'patient' ? 'Patient Info' : 'CHA Training';
            return (
              <Pressable
                key={f}
                style={[styles.filterChip, audienceFilter === f && { backgroundColor: col + '22', borderColor: col }]}
                onPress={() => setAudienceFilter(f)}
              >
                <Text style={[styles.filterChipText, audienceFilter === f && { color: col, fontWeight: '700' }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Cards */}
        <Text style={styles.sectionTitle}>{filtered.length} EDUCATION CARDS</Text>
        {filtered.map((card) => (
          <EducationCardView
            key={card.id}
            card={card}
            expanded={expandedId === card.id}
            onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
            isPlaying={playingId === card.id}
            onPlay={() => playCard(card)}
            onStop={stopSpeech}
            language={language}
          />
        ))}

        <Text style={styles.footer}>
          Sources: WHO, UNICEF, MSF · MediAid v1.0 · Community Health Aide Training Program
        </Text>
      </ScrollView>
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
  navTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  navSub: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  playAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  playAllText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  heroCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 16, marginTop: 16, marginBottom: 12,
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  heroIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.primary + '44',
  },
  heroTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  heroSub: { fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, alignItems: 'center', borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600', marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, backgroundColor: theme.surface,
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.border,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
  },
  footer: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
