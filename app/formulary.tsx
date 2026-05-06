// MediAid — Offline Drug Formulary
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

interface Drug {
  id: number;
  name: string;
  genericName: string;
  category: string;
  indication: string;
  dosingAdult: string;
  dosingChild: string;
  contraindications: string;
  warnings: string;
  whoEssential: boolean;
  stockUnit: string;
  stockColor: string;
}

const DRUGS: Drug[] = [
  {
    id: 1,
    name: 'Artemether-Lumefantrine (AL)',
    genericName: 'Coartem',
    category: 'Antimalarial',
    indication: 'Uncomplicated malaria, Plasmodium falciparum',
    dosingAdult: '4 tablets twice daily for 3 days (morning/evening)',
    dosingChild: '<5kg: Not recommended | 5–15kg: 1 tab BD×3 days | 15–25kg: 2 tabs BD×3 days | 25–35kg: 3 tabs BD×3 days',
    contraindications: 'Severe malaria (use IV artesunate), first trimester pregnancy, severe cardiac disease',
    warnings: 'Take with food or milk. Monitor for QT prolongation. Complete full course.',
    whoEssential: true,
    stockUnit: 'pack (24 tablets)',
    stockColor: theme.statusRed,
  },
  {
    id: 2,
    name: 'Amoxicillin',
    genericName: 'Amoxicillin 500mg',
    category: 'Antibiotic',
    indication: 'Respiratory infections, pneumonia, otitis media, UTI, skin infections',
    dosingAdult: '500mg 3× daily for 5–7 days',
    dosingChild: '25–50mg/kg/day divided every 8 hours for 5 days',
    contraindications: 'Penicillin allergy (severe anaphylaxis history)',
    warnings: 'Complete full course even if feeling better. Can cause diarrhea. Check for mononucleosis (rash risk).',
    whoEssential: true,
    stockUnit: 'bottle (30 capsules)',
    stockColor: theme.statusYellow,
  },
  {
    id: 3,
    name: 'Oral Rehydration Salts (ORS)',
    genericName: 'WHO-ORS',
    category: 'Rehydration',
    indication: 'Diarrhea, vomiting, dehydration, cholera',
    dosingAdult: '200–400ml after each loose stool. 1 sachet in 1L clean water.',
    dosingChild: '<2yrs: 50–100ml after each stool | 2–10yrs: 100–200ml after each stool',
    contraindications: 'Severe dehydration with altered consciousness (requires IV fluids)',
    warnings: 'Prepare fresh daily. Use only clean drinking water. Discard unused solution after 24h.',
    whoEssential: true,
    stockUnit: 'sachet',
    stockColor: theme.statusGreen,
  },
  {
    id: 4,
    name: 'Amoxicillin-Clavulanate',
    genericName: 'Co-amoxiclav 625mg',
    category: 'Antibiotic',
    indication: 'Community-acquired pneumonia, complicated UTI, animal bites, skin infections',
    dosingAdult: '625mg (500+125mg) twice daily for 5–7 days',
    dosingChild: '30mg/kg/day of amoxicillin component, divided every 12 hours',
    contraindications: 'Penicillin allergy, severe hepatic impairment, previous Co-amoxiclav jaundice',
    warnings: 'Take with meals to reduce GI upset. Monitor liver function in prolonged use.',
    whoEssential: false,
    stockUnit: 'pack (14 tablets)',
    stockColor: theme.statusYellow,
  },
  {
    id: 5,
    name: 'Ferrous Sulfate + Folic Acid',
    genericName: 'Iron 200mg + Folate 0.4mg',
    category: 'Nutrition / Anemia',
    indication: 'Iron-deficiency anemia, pregnancy supplementation, severe anemia (Hgb <10)',
    dosingAdult: '1 tablet twice daily between meals. Minimum 3 months treatment.',
    dosingChild: '3–6mg/kg/day elemental iron, divided 2–3 times daily',
    contraindications: 'Hemochromatosis, hemolytic anemia without deficiency',
    warnings: 'May cause dark stools, constipation, nausea. Avoid with antacids. Vitamin C improves absorption.',
    whoEssential: true,
    stockUnit: 'bottle (90 tablets)',
    stockColor: theme.statusYellow,
  },
  {
    id: 6,
    name: 'Amlodipine',
    genericName: 'Amlodipine 5mg',
    category: 'Antihypertensive',
    indication: 'Hypertension, chronic stable angina',
    dosingAdult: '5mg once daily. Can increase to 10mg if inadequate response.',
    dosingChild: '2.5–5mg once daily (6–17 years)',
    contraindications: 'Severe aortic stenosis, cardiogenic shock, hypotension',
    warnings: 'Monitor BP weekly initially. May cause ankle edema, facial flushing. Do not stop abruptly.',
    whoEssential: true,
    stockUnit: 'pack (30 tablets)',
    stockColor: theme.primary,
  },
  {
    id: 7,
    name: 'Metronidazole',
    genericName: 'Metronidazole 500mg',
    category: 'Antiprotozoal / Antibiotic',
    indication: 'Giardia, amoebiasis, bacterial vaginosis, trichomoniasis, anaerobic infections',
    dosingAdult: '400mg 3× daily for 7–10 days (intestinal amebiasis)',
    dosingChild: '7.5mg/kg 3× daily for 5–10 days',
    contraindications: 'First trimester pregnancy, known hypersensitivity',
    warnings: 'AVOID alcohol during and 48h after treatment (severe reaction). May cause metallic taste, nausea.',
    whoEssential: true,
    stockUnit: 'pack (21 tablets)',
    stockColor: theme.statusYellow,
  },
  {
    id: 8,
    name: 'Paracetamol (Acetaminophen)',
    genericName: 'Paracetamol 500mg',
    category: 'Analgesic / Antipyretic',
    indication: 'Fever, mild-to-moderate pain, headache, malaria fever management',
    dosingAdult: '500–1000mg every 4–6 hours. MAX 4g/day.',
    dosingChild: '10–15mg/kg every 4–6 hours. MAX 60mg/kg/day.',
    contraindications: 'Severe liver disease, alcohol misuse',
    warnings: 'Do not exceed maximum dose. Avoid concurrent use with other paracetamol-containing products. Safe in pregnancy.',
    whoEssential: true,
    stockUnit: 'pack (20 tablets)',
    stockColor: theme.statusGreen,
  },
  {
    id: 9,
    name: 'Cotrimoxazole (TMP-SMX)',
    genericName: 'Trimethoprim-Sulfamethoxazole 480mg',
    category: 'Antibiotic / Prophylaxis',
    indication: 'UTI, prophylaxis in HIV/AIDS, Pneumocystis pneumonia prevention',
    dosingAdult: '960mg twice daily for 5 days (UTI) or once daily (prophylaxis)',
    dosingChild: '4/20mg/kg twice daily',
    contraindications: 'Sulfa allergy, severe renal/hepatic disease, G6PD deficiency',
    warnings: 'Increased photosensitivity — use sunscreen. Monitor blood counts on long-term use. Adequate hydration important.',
    whoEssential: true,
    stockUnit: 'pack (20 tablets)',
    stockColor: theme.primary,
  },
  {
    id: 10,
    name: 'Zinc Sulfate',
    genericName: 'Zinc 20mg dispersible',
    category: 'Nutrition / Diarrhea',
    indication: 'Diarrhea in children <5 years (adjunct to ORS), malnutrition',
    dosingAdult: 'Not typically used in adults',
    dosingChild: '<6 months: 10mg once daily × 10 days | ≥6 months: 20mg once daily × 10 days',
    contraindications: 'Zinc hypersensitivity (rare)',
    warnings: 'Use WITH ORS, not instead of it. May cause nausea if taken on empty stomach. Reduces duration of diarrhea by ~25%.',
    whoEssential: true,
    stockUnit: 'pack (10 dispersible tablets)',
    stockColor: theme.statusGreen,
  },
];

const CATEGORIES = ['All', 'Antimalarial', 'Antibiotic', 'Rehydration', 'Antihypertensive', 'Antiprotozoal / Antibiotic', 'Analgesic / Antipyretic', 'Nutrition / Anemia', 'Nutrition / Diarrhea'];

const STOCK_KEY = 'mediaid_formulary_stock_v1';

interface StockData {
  [drugId: number]: number;
}

function DrugCard({ drug, stock, onUpdateStock }: {
  drug: Drug;
  stock: number;
  onUpdateStock: (amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { language } = useApp();
  const stockLow = stock < 5;
  const stockEmpty = stock === 0;

  const speakDrug = () => {
    const text = `${drug.name}. Used for: ${drug.indication}. Adult dosing: ${drug.dosingAdult}. Contraindications: ${drug.contraindications}.`;
    Speech.stop();
    Speech.speak(text, { language: language === 'fr' ? 'fr-FR' : 'en-US', rate: 0.85 });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, stockEmpty && styles.cardEmpty]}
      onPress={() => setExpanded((v) => !v)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.categoryTag, { backgroundColor: drug.stockColor + '20', borderColor: drug.stockColor + '44' }]}>
          <Text style={[styles.categoryTagText, { color: drug.stockColor }]}>{drug.category}</Text>
        </View>
        {drug.whoEssential && (
          <View style={styles.whoTag}>
            <MaterialIcons name="verified" size={11} color={theme.statusGreen} />
            <Text style={styles.whoTagText}>WHO Essential</Text>
          </View>
        )}
        <Pressable style={styles.speakBtn} onPress={speakDrug} hitSlop={8}>
          <MaterialIcons name="volume-up" size={16} color={theme.textMuted} />
        </Pressable>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.textMuted}
        />
      </View>

      <Text style={styles.drugName}>{drug.name}</Text>
      <Text style={styles.genericName}>{drug.genericName}</Text>
      <Text style={styles.indication} numberOfLines={expanded ? undefined : 2}>{drug.indication}</Text>

      {/* Stock tracker */}
      <View style={[styles.stockRow, stockLow && styles.stockRowLow]}>
        <MaterialIcons
          name={stockEmpty ? 'remove-shopping-cart' : stockLow ? 'warning' : 'inventory'}
          size={16}
          color={stockEmpty ? theme.statusRed : stockLow ? theme.statusYellow : theme.statusGreen}
        />
        <Text style={[
          styles.stockText,
          { color: stockEmpty ? theme.statusRed : stockLow ? theme.statusYellow : theme.statusGreen },
        ]}>
          {stockEmpty ? 'OUT OF STOCK' : `${stock} ${drug.stockUnit}${stock !== 1 ? 's' : ''}`}
          {stockLow && !stockEmpty ? ' — LOW' : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={styles.stockBtns}>
          <Pressable
            style={[styles.stockBtn, { borderColor: theme.statusRed + '55' }]}
            onPress={() => { onUpdateStock(-1); Haptics.selectionAsync(); }}
            disabled={stock <= 0}
            hitSlop={6}
          >
            <MaterialIcons name="remove" size={14} color={stock <= 0 ? theme.textMuted : theme.statusRed} />
          </Pressable>
          <Text style={styles.stockNum}>{stock}</Text>
          <Pressable
            style={[styles.stockBtn, { borderColor: theme.statusGreen + '55' }]}
            onPress={() => { onUpdateStock(1); Haptics.selectionAsync(); }}
            hitSlop={6}
          >
            <MaterialIcons name="add" size={14} color={theme.statusGreen} />
          </Pressable>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.dosingBlock}>
            <Text style={styles.dosingTitle}>ADULT DOSING</Text>
            <Text style={styles.dosingText}>{drug.dosingAdult}</Text>
          </View>
          <View style={styles.dosingBlock}>
            <Text style={styles.dosingTitle}>PEDIATRIC DOSING</Text>
            <Text style={styles.dosingText}>{drug.dosingChild}</Text>
          </View>
          <View style={[styles.warnBlock, { borderColor: theme.statusRed + '44', backgroundColor: theme.statusRedBg }]}>
            <MaterialIcons name="block" size={14} color={theme.statusRed} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warnTitle, { color: theme.statusRed }]}>CONTRAINDICATIONS</Text>
              <Text style={[styles.warnText, { color: theme.statusRed + 'CC' }]}>{drug.contraindications}</Text>
            </View>
          </View>
          <View style={[styles.warnBlock, { borderColor: theme.statusYellow + '44', backgroundColor: theme.statusYellowBg }]}>
            <MaterialIcons name="info-outline" size={14} color={theme.statusYellow} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warnTitle, { color: theme.statusYellow }]}>WARNINGS</Text>
              <Text style={[styles.warnText, { color: theme.statusYellow + 'DD' }]}>{drug.warnings}</Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function FormularyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [stock, setStock] = useState<StockData>({});

  useEffect(() => {
    AsyncStorage.getItem(STOCK_KEY).then((raw) => {
      if (raw) {
        try { setStock(JSON.parse(raw)); } catch {}
      } else {
        // Default stock
        const defaults: StockData = {};
        DRUGS.forEach((d) => { defaults[d.id] = 12; });
        setStock(defaults);
      }
    });
  }, []);

  const saveStock = async (updated: StockData) => {
    setStock(updated);
    await AsyncStorage.setItem(STOCK_KEY, JSON.stringify(updated));
  };

  const updateDrugStock = (drugId: number, delta: number) => {
    const current = stock[drugId] ?? 0;
    const next = { ...stock, [drugId]: Math.max(0, current + delta) };
    saveStock(next);
  };

  const filtered = useMemo(() => {
    let result = DRUGS;
    if (category !== 'All') result = result.filter((d) => d.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.indication.toLowerCase().includes(q) ||
          d.genericName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [query, category]);

  const outOfStock = DRUGS.filter((d) => (stock[d.id] ?? 0) === 0).length;
  const lowStock = DRUGS.filter((d) => { const s = stock[d.id] ?? 0; return s > 0 && s < 5; }).length;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Drug Formulary</Text>
          <Text style={styles.navSub}>
            {DRUGS.length} WHO Essential Medicines · Offline · NW Cameroon
          </Text>
        </View>
        {(outOfStock > 0 || lowStock > 0) && (
          <View style={styles.stockAlertBadge}>
            <MaterialIcons name="warning" size={12} color={outOfStock > 0 ? theme.statusRed : theme.statusYellow} />
            <Text style={[styles.stockAlertText, { color: outOfStock > 0 ? theme.statusRed : theme.statusYellow }]}>
              {outOfStock > 0 ? `${outOfStock} out` : `${lowStock} low`}
            </Text>
          </View>
        )}
      </View>

      {/* Stock summary */}
      <View style={styles.stockSummaryRow}>
        <View style={[styles.stockSummaryCard, { borderColor: theme.statusGreen + '44' }]}>
          <Text style={[styles.stockSummaryNum, { color: theme.statusGreen }]}>
            {DRUGS.filter((d) => (stock[d.id] ?? 0) >= 5).length}
          </Text>
          <Text style={styles.stockSummaryLabel}>In Stock</Text>
        </View>
        <View style={[styles.stockSummaryCard, { borderColor: theme.statusYellow + '44' }]}>
          <Text style={[styles.stockSummaryNum, { color: theme.statusYellow }]}>{lowStock}</Text>
          <Text style={styles.stockSummaryLabel}>Low Stock</Text>
        </View>
        <View style={[styles.stockSummaryCard, { borderColor: theme.statusRed + '44' }]}>
          <Text style={[styles.stockSummaryNum, { color: theme.statusRed }]}>{outOfStock}</Text>
          <Text style={styles.stockSummaryLabel}>Out of Stock</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={20} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={language === 'fr' ? 'Rechercher un médicament...' : 'Search drug or indication...'}
          placeholderTextColor={theme.textMuted}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Category filter */}
      <FlatList
        data={['All', 'Antimalarial', 'Antibiotic', 'Rehydration', 'Antihypertensive', 'Analgesic / Antipyretic', 'Nutrition / Anemia']}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.categoryChips}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.categoryChip, category === item && styles.categoryChipActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.categoryChipText, category === item && styles.categoryChipTextActive]}>
              {item}
            </Text>
          </Pressable>
        )}
        style={styles.categoryChipList}
      />

      {/* Drug list */}
      <FlatList
        data={filtered}
        keyExtractor={(d) => String(d.id)}
        renderItem={({ item }) => (
          <DrugCard
            drug={item}
            stock={stock[item.id] ?? 0}
            onUpdateStock={(delta) => updateDrugStock(item.id, delta)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="medication-liquid" size={48} color={theme.textMuted} />
            <Text style={styles.emptyText}>No drugs match your search</Text>
          </View>
        }
      />
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
  navSub: { fontSize: 10, color: theme.textSecondary, marginTop: 1 },
  stockAlertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  stockAlertText: { fontSize: 10, fontWeight: '800' },
  stockSummaryRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
  },
  stockSummaryCard: {
    flex: 1, backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, alignItems: 'center', borderWidth: 1,
  },
  stockSummaryNum: { fontSize: 24, fontWeight: '800' },
  stockSummaryLabel: { fontSize: 10, color: theme.textSecondary, fontWeight: '600', marginTop: 3 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.textPrimary },
  categoryChipList: { marginBottom: 4 },
  categoryChips: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  categoryChipActive: {
    backgroundColor: theme.primary + '22', borderColor: theme.primary,
  },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  categoryChipTextActive: { color: theme.primary },
  card: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, borderWidth: 1, borderColor: theme.border,
  },
  cardEmpty: { opacity: 0.6, borderColor: theme.statusRed + '55' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  categoryTag: {
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  categoryTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  whoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  whoTagText: { fontSize: 8, fontWeight: '700', color: theme.statusGreen },
  speakBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.background,
    marginLeft: 'auto',
  },
  drugName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  genericName: { fontSize: 12, color: theme.textMuted, fontStyle: 'italic', marginTop: 2 },
  indication: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 18 },
  stockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  stockRowLow: { borderTopColor: theme.statusYellow + '33' },
  stockText: { fontSize: 12, fontWeight: '700' },
  stockBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.background, borderWidth: 1,
  },
  stockNum: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, minWidth: 24, textAlign: 'center' },
  expandedSection: { marginTop: 14, gap: 10 },
  dosingBlock: {
    backgroundColor: theme.background, borderRadius: theme.radius.small, padding: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  dosingTitle: {
    fontSize: 9, fontWeight: '700', color: theme.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
  },
  dosingText: { fontSize: 13, color: theme.textPrimary, lineHeight: 19 },
  warnBlock: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: theme.radius.small, padding: 12, borderWidth: 1,
  },
  warnTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  warnText: { fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 15, color: theme.textSecondary },
});
