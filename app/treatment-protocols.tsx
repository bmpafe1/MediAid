// MediAid — Offline Clinical Treatment Protocols
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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

type UrgencyLevel = 'Critical' | 'Urgent' | 'Routine';

interface TreatmentStep {
  step: number;
  action: string;
  detail: string;
  timing?: string;
  warning?: string;
}

interface Medication {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  notes?: string;
  contraindications?: string[];
}

interface Protocol {
  id: string;
  condition: string;
  icon: string;
  color: string;
  urgency: UrgencyLevel;
  tagline: string;
  redFlags: string[];
  referralCriteria: string[];
  steps: TreatmentStep[];
  medications: Medication[];
  monitoring: string[];
  patientCounseling: string[];
  citation: string;
}

const PROTOCOLS: Protocol[] = [
  {
    id: 'tb',
    condition: 'Tuberculosis (TB)',
    icon: 'air',
    color: theme.statusRed,
    urgency: 'Urgent',
    tagline: 'Suspect TB in patients with cough >2 weeks + fever + weight loss',
    redFlags: [
      'Coughing blood (haemoptysis)',
      'SpO₂ <90%',
      'Respiratory rate >30 breaths/min',
      'Altered consciousness',
      'Rapid weight loss >5kg/month',
    ],
    referralCriteria: [
      'MediAid TB Risk ≥70% — refer same day',
      'Any haemoptysis — immediate referral',
      'Suspected MDR-TB (treatment failure)',
      'HIV co-infection suspected',
      'Paediatric TB (<15 years)',
    ],
    steps: [
      { step: 1, action: 'Isolate Patient', detail: 'Ensure patient wears surgical mask. CHA wears N95 or 3-ply mask. Move to open-air or ventilated space.', timing: 'Immediately', warning: 'Do NOT expose other patients/family members' },
      { step: 2, action: 'Sputum Collection', detail: 'Instruct patient to take deep breath and cough deeply into labeled container. Collect ×3 samples (spot, morning, spot) for GeneXpert/smear microscopy.', timing: 'Within 24h' },
      { step: 3, action: 'Contact Tracing', detail: 'Identify all household contacts. Schedule screening for close contacts within 72 hours. Document on CBO register.', timing: 'Within 72h' },
      { step: 4, action: 'DOTS Referral', detail: 'Refer to nearest DOTS centre. Complete referral form with MediAid report and sputum results. Follow up in 2 weeks.', timing: 'Same day or next morning' },
      { step: 5, action: 'Nutritional Support', detail: 'Advise protein-rich diet: eggs, beans, groundnuts. Assess for food insecurity. Link to nutrition program if available.', timing: 'At initial visit' },
    ],
    medications: [
      { name: 'Rifampicin', dose: '600mg', route: 'Oral', frequency: 'Once daily', duration: '6 months (RHEZ regimen)', notes: 'First-line DOTS — dispense only at DOTS centre', contraindications: ['Severe liver disease', 'Rifampicin hypersensitivity'] },
      { name: 'Isoniazid (IPT)', dose: '5mg/kg (max 300mg)', route: 'Oral', frequency: 'Once daily', duration: '6 months preventive', notes: 'For contacts/latent TB — CHA can dispense with supervisor approval', contraindications: ['Acute liver disease', 'Isoniazid allergy'] },
      { name: 'Pyridoxine (B6)', dose: '25mg', route: 'Oral', frequency: 'Once daily', duration: 'Throughout TB treatment', notes: 'Co-administer with Isoniazid to prevent peripheral neuropathy' },
    ],
    monitoring: [
      'Sputum smear at 2 months, 5 months, 6 months',
      'Weight monthly — target ≥5% gain by month 2',
      'Liver function tests if symptoms of hepatotoxicity',
      'Vision check — Ethambutol can cause optic neuritis',
      'DOTS adherence monitoring — missed dose within 2 weeks = LOSS TO FOLLOW UP',
    ],
    patientCounseling: [
      'TB is curable — complete the full 6-month course',
      'Take medications on an empty stomach for best absorption',
      'Avoid alcohol — increases risk of liver toxicity',
      'Use mask indoors for first 2 weeks of treatment',
      'Do not share utensils or food with household members during active phase',
    ],
    citation: 'WHO TB Treatment Guidelines 2022 · Cameroon PNLT Protocol v4.1',
  },
  {
    id: 'malaria',
    condition: 'Malaria (P. falciparum)',
    icon: 'bug-report',
    color: theme.statusYellow,
    urgency: 'Urgent',
    tagline: 'Confirm with RDT before treatment. Treat within 24h of positive result.',
    redFlags: [
      'Altered consciousness / convulsions → SEVERE MALARIA',
      'Prostration (unable to sit/stand)',
      'Respiratory distress (RR >30)',
      'Repeated vomiting — cannot retain oral medication',
      'Haemoglobin <7 g/dL (severe anaemia)',
      'Parasitaemia >5%',
    ],
    referralCriteria: [
      'Any severe malaria sign — refer IMMEDIATELY',
      'Pregnant woman with malaria',
      'Child under 5 with Hgb <7 g/dL',
      'Failure to improve after 48h of ACT',
    ],
    steps: [
      { step: 1, action: 'Confirm Diagnosis', detail: 'Perform malaria RDT. Record lot number and expiry date. If RDT negative but clinical suspicion high, repeat or refer for microscopy.', timing: 'Immediately', warning: 'Never treat without positive RDT or microscopy' },
      { step: 2, action: 'Assess Severity', detail: 'Check consciousness (AVPU scale), respiratory rate, ability to drink/eat. Screen for danger signs. If any severe sign → refer immediately.', timing: 'Immediately' },
      { step: 3, action: 'Initiate ACT', detail: 'Dispense Artemether-Lumefantrine (AL). Confirm patient takes first dose in your presence. Advise to take with food/milk to improve absorption.', timing: 'Within 1 hour of positive RDT' },
      { step: 4, action: 'Temperature Management', detail: 'If fever >38.5°C: Paracetamol 500–1000mg. Tepid sponging. Ensure adequate hydration (oral rehydration salts if vomiting).', timing: 'Symptomatic' },
      { step: 5, action: 'Follow-Up', detail: 'Visit or call patient at 24h and 72h. If no improvement at 72h → refer. Document in MediAid and DHIS2.', timing: 'D1, D3, D7, D28' },
    ],
    medications: [
      { name: 'Artemether-Lumefantrine (AL)', dose: 'Weight-based: 5–14kg=1tab, 15–24kg=2tabs, 25–34kg=3tabs, >34kg=4tabs', route: 'Oral', frequency: 'Twice daily', duration: '3 days (6 doses total)', notes: 'Take with fatty food or milk. First dose must be observed.', contraindications: ['Severe malaria (IV artesunate needed)', 'First trimester pregnancy'] },
      { name: 'Paracetamol', dose: '500mg–1000mg adults / 15mg/kg children', route: 'Oral', frequency: 'Every 4–6 hours PRN', duration: 'Until fever resolves', notes: 'Do not exceed 4g/day. Avoid in severe liver disease.', contraindications: ['Severe hepatic impairment'] },
      { name: 'Sulfadoxine-Pyrimethamine (IPTp)', dose: '3 tablets (SP)', route: 'Oral', frequency: 'Each ANC visit from 13 weeks', duration: 'Pregnancy (min 3 doses)', notes: 'Intermittent Preventive Treatment in Pregnancy — CHA can dispense' },
    ],
    monitoring: [
      'Parasitaemia RDT at day 3 if not improving',
      'Temperature and clinical response at 24h, 48h, 72h',
      'Haemoglobin at day 14 if initial Hgb <10 g/dL',
      'Watch for ACT side effects: nausea, rash, QT prolongation (rarely)',
      'Pregnant women: weekly malaria check in first trimester',
    ],
    patientCounseling: [
      'Complete all 6 doses even if feeling better after 1–2 doses',
      'Use insecticide-treated bednets every night (no gaps in net)',
      'Drain standing water around home — mosquito breeding sites',
      'Seek care promptly if fever returns within 28 days',
      'Pregnant women must attend ANC for IPTp doses',
    ],
    citation: 'Cameroon MINSANTE Malaria Treatment Guidelines 2021 · WHO Malaria Treatment Guidelines 2022',
  },
  {
    id: 'afib',
    condition: 'Atrial Fibrillation (AFib)',
    icon: 'monitor-heart',
    color: theme.primary,
    urgency: 'Urgent',
    tagline: 'Irregular pulse + MediAid AFib ≥15% → confirm, assess, refer',
    redFlags: [
      'Chest pain with AFib → Acute coronary syndrome',
      'Severe shortness of breath at rest',
      'Sudden onset weakness/facial droop → Stroke',
      'Near-syncope or fainting',
      'Heart rate >150 BPM with haemodynamic instability',
    ],
    referralCriteria: [
      'Any new-onset AFib → refer to hospital same day',
      'AFib + stroke symptoms → 999/immediate emergency',
      'AFib + chest pain → immediate referral',
      'Heart rate >150 BPM at rest',
      'Known AFib not on anticoagulation',
    ],
    steps: [
      { step: 1, action: 'Confirm Irregular Pulse', detail: 'Manually palpate radial pulse for 60 seconds. Count rate and assess rhythm. Irregular rhythm = AFib suspected. Cross-reference MediAid AFib % score.', timing: 'Immediately' },
      { step: 2, action: 'Assess for Stroke Signs', detail: 'FAST screen: Face drooping, Arm weakness, Speech difficulty, Time to call. If any FAST sign positive → emergency referral IMMEDIATELY.', timing: 'Immediately', warning: 'FAST positive = stroke emergency — do not delay' },
      { step: 3, action: 'Record Vitals', detail: 'Document HR, BP (both arms if possible), SpO₂, RR. Note symptom duration: hours vs days vs chronic. Check medications.', timing: 'Within 10 minutes' },
      { step: 4, action: 'Patient Positioning', detail: 'Seat patient comfortably. Loosen tight clothing. Ensure adequate airway. Do NOT give food/water if altered consciousness.', timing: 'Immediately' },
      { step: 5, action: 'Emergency Referral', detail: 'Escort patient or arrange transport to Bamenda Regional Hospital cardiac unit. Call ahead (+237 233 362 450). Share MediAid report via SMS or printed.', timing: 'Same day — do not delay' },
    ],
    medications: [
      { name: 'Bisoprolol (Rate Control)', dose: '2.5–5mg', route: 'Oral', frequency: 'Once daily', duration: 'Ongoing — physician prescription only', notes: 'CHA: do NOT initiate. Physician-only. Document if patient is already on this.', contraindications: ['Asthma', 'Severe bradycardia', 'Cardiogenic shock'] },
      { name: 'Warfarin (Anticoagulation)', dose: 'Physician-adjusted (INR target 2–3)', route: 'Oral', frequency: 'Once daily', duration: 'Lifelong for high-risk AFib', notes: 'CHA: never initiate. Confirm INR compliance during home visits.', contraindications: ['Active bleeding', 'Uncontrolled hypertension', 'Pregnancy'] },
    ],
    monitoring: [
      'Pulse rate and rhythm at every CHA visit',
      'Assess for stroke symptoms at every visit (FAST screen)',
      'Medication adherence — warfarin/bisoprolol compliance',
      'Blood pressure monitoring — target <140/90',
      'Ankle oedema — sign of heart failure progression',
    ],
    patientCounseling: [
      'Never stop heart medications without doctor advice',
      'Report any sudden headache, weakness, or confusion immediately',
      'Avoid excessive alcohol — major AFib trigger',
      'Reduce caffeine — can trigger palpitations',
      'Carry a medical ID card noting AFib and current medications',
    ],
    citation: 'ESC AFib Guidelines 2020 · WHO CVD Management in Primary Care 2021',
  },
  {
    id: 'anemia',
    condition: 'Anaemia (Hgb <12 g/dL)',
    icon: 'opacity',
    color: '#EC4899',
    urgency: 'Urgent',
    tagline: 'Pallor of conjunctiva + Hgb <10 on MediAid → classify, treat, monitor',
    redFlags: [
      'Hgb <7 g/dL — severe anaemia requiring transfusion',
      'Heart rate >120 BPM at rest + anaemia',
      'SpO₂ <92% with severe anaemia',
      'Fainting / severe fatigue unable to walk',
      'Pregnant woman with Hgb <8 g/dL',
    ],
    referralCriteria: [
      'Severe anaemia (Hgb <7 g/dL) → refer for transfusion',
      'Pregnant woman with Hgb <8 g/dL',
      'Anaemia not responding to 3 months of treatment',
      'Suspected sickle cell disease',
      'Haematuria, rectal bleeding, menorrhagia',
    ],
    steps: [
      { step: 1, action: 'Classify Anaemia Severity', detail: 'Mild: Hgb 10–12 g/dL. Moderate: 7–10 g/dL. Severe: <7 g/dL. Check conjunctival pallor, nail beds, palms. Note MediAid haemoglobin estimate.', timing: 'At assessment' },
      { step: 2, action: 'Identify Cause', detail: 'Most common causes in NW Cameroon: malaria (treat first), iron deficiency (nutritional), hookworm, sickle cell. Ask about menstrual bleeding, diet, worm prevention.', timing: 'At assessment' },
      { step: 3, action: 'Treat Malaria if Positive', detail: 'If RDT positive, treat malaria first before iron supplementation. Malaria is the most common cause of anaemia in children under 5.', timing: 'Immediately if RDT+' },
      { step: 4, action: 'Iron Supplementation', detail: 'For iron-deficiency anaemia: Ferrous sulphate 200mg TID for 3 months. Advise take with orange juice (Vitamin C) to improve absorption.', timing: 'After malaria excluded/treated' },
      { step: 5, action: 'Deworming', detail: 'Mebendazole 500mg single dose for hookworm if >1 year old and no contraindications. Repeat at 6 months. Co-administer with iron if hookworm suspected.', timing: 'At initial visit' },
    ],
    medications: [
      { name: 'Ferrous Sulphate', dose: '200mg (65mg elemental iron)', route: 'Oral', frequency: '3× daily', duration: '3 months', notes: 'Take with Vitamin C or orange juice. Stools will be dark — normal. Avoid with tea/coffee.', contraindications: ['Haemolytic anaemia', 'Haemochromatosis'] },
      { name: 'Folic Acid', dose: '5mg', route: 'Oral', frequency: 'Once daily', duration: '3 months (lifelong in pregnancy)', notes: 'Always co-prescribe with iron. Essential in pregnancy and sickle cell.', contraindications: ['Vitamin B12 deficiency (masks neurological symptoms)'] },
      { name: 'Mebendazole', dose: '500mg', route: 'Oral', frequency: 'Single dose', duration: 'Repeat every 6 months', notes: 'WHO essential medicine for deworming. Safe from 1 year old.', contraindications: ['Under 1 year old', 'Known mebendazole allergy'] },
    ],
    monitoring: [
      'Haemoglobin check at 1 month and 3 months of treatment',
      'Clinical improvement: energy, pallor, exercise tolerance',
      'Side effects: GI upset, dark stools (iron), rash',
      'Pregnant women: monthly Hgb monitoring',
      'Target Hgb rise: ≥1 g/dL per month on iron therapy',
    ],
    patientCounseling: [
      'Iron-rich foods: red meat, liver, spinach, beans, moringa leaves',
      'Eat Vitamin C foods (oranges, tomatoes) with iron-rich meals',
      'Avoid tea and coffee within 1 hour of iron tablets',
      'Use insecticide-treated bednets to prevent malaria-related anaemia',
      'Pregnant women: attend all ANC visits for iron/folate refills',
    ],
    citation: 'WHO Anaemia Guidelines 2015 · Cameroon Anaemia Control Programme 2023',
  },
  {
    id: 'cholera',
    condition: 'Cholera / Acute Watery Diarrhoea',
    icon: 'water-drop',
    color: '#60A5FA',
    urgency: 'Critical',
    tagline: 'Profuse watery diarrhoea + vomiting + dehydration = cholera until proven otherwise',
    redFlags: [
      'Severe dehydration (sunken eyes, no skin turgor, no urine)',
      'Altered consciousness',
      'Shock (HR >120, cold clammy extremities, BP not measurable)',
      'Bloody stool (not classic cholera — suspect another pathogen)',
      'Multiple cases in same household/village → OUTBREAK',
    ],
    referralCriteria: [
      'Severe dehydration → emergency IV fluids at hospital',
      'Unable to drink (persistent vomiting)',
      'Altered consciousness',
      'Children <5 with any dehydration signs',
      '>3 cases in same area within 48h → report to DHO',
    ],
    steps: [
      { step: 1, action: 'Assess Dehydration', detail: 'No dehydration: able to drink, normal skin turgor. Some dehydration: 2 of these: restless, sunken eyes, drinks eagerly, slow skin pinch. Severe: 2+ with lethargic or unconscious → IMMEDIATE REFERRAL.', timing: 'Immediately' },
      { step: 2, action: 'Oral Rehydration Therapy (ORT)', detail: 'No/Some dehydration: ORS solution. Prepare 1 sachet in 1L boiled water. Adults: 200–400ml after each loose stool. Children: 50–100ml/kg over 4 hours. Continue until diarrhoea stops.', timing: 'Immediately', warning: 'Severe dehydration → IV fluids only, refer' },
      { step: 3, action: 'Prepare ORS if sachets unavailable', detail: 'Home solution: 1 litre boiled water + 6 teaspoons sugar + 0.5 teaspoon salt. Teach caregiver to prepare correctly.', timing: 'If sachets unavailable' },
      { step: 4, action: 'Zinc Supplementation (Children)', detail: 'Children <5: Zinc 20mg daily for 10 days. Zinc reduces duration and severity of diarrhoea. Dissolve tablet in small amount of breast milk or ORS.', timing: 'At presentation' },
      { step: 5, action: 'Disease Notification', detail: 'Report to District Health Officer if ≥3 cases in 48h. Activate community hygiene protocol: promote handwashing, safe water, proper food handling.', timing: 'Immediately on cluster detection' },
    ],
    medications: [
      { name: 'Oral Rehydration Salts (ORS)', dose: 'As needed to replace losses', route: 'Oral', frequency: 'After each loose stool', duration: 'Until diarrhoea resolves', notes: 'WHO standard ORS. Always prepare with boiled/treated water.' },
      { name: 'Zinc Sulphate', dose: '20mg (children), 40mg (adults)', route: 'Oral', frequency: 'Once daily', duration: '10 days', notes: 'WHO essential — reduces cholera duration by 25%.' },
      { name: 'Doxycycline', dose: '300mg single dose (adults)', route: 'Oral', frequency: 'Single dose', duration: 'Once', notes: 'Antibiotic for confirmed cholera — reduces severity and duration. Physician prescription.', contraindications: ['Pregnancy', 'Children <8 years', 'Doxycycline allergy'] },
    ],
    monitoring: [
      'Stool frequency and consistency every 4 hours',
      'Urine output — target >3 voids per day',
      'Skin turgor, sunken eyes, dry mouth — dehydration signs',
      'Ability to drink ORS without vomiting',
      'Weight monitoring in children — 5–10% weight loss = moderate dehydration',
    ],
    patientCounseling: [
      'Boil all drinking water or use chlorine tablets',
      'Wash hands with soap after latrine use and before eating',
      'Do not share food utensils with sick person',
      'Breastfeeding mothers: continue breastfeeding during diarrhoea',
      'Seek help immediately if diarrhoea is very frequent or child seems very sick',
    ],
    citation: 'WHO Cholera Guidelines 2017 · UNICEF WASH in Emergencies · Cameroon Emergency Response Plan 2024',
  },
  {
    id: 'meningitis',
    condition: 'Bacterial Meningitis',
    icon: 'psychology',
    color: '#F97316',
    urgency: 'Critical',
    tagline: 'Neck stiffness + fever + headache = meningitis until proven otherwise — EMERGENCY',
    redFlags: [
      'Classic triad: fever + neck stiffness + altered consciousness',
      'Purpuric rash (non-blanching purple spots) → meningococcaemia',
      'Photophobia (eye pain in light)',
      'Kernig sign (cannot extend knee when hip is flexed)',
      'Bulging fontanelle (in infants)',
    ],
    referralCriteria: [
      'ANY suspected meningitis → IMMEDIATE emergency referral',
      'Give pre-referral Benzylpenicillin IM before transport if >15min to hospital',
      'Do NOT perform lumbar puncture at community level',
      'Notify DHO immediately for outbreak surveillance',
    ],
    steps: [
      { step: 1, action: 'EMERGENCY Recognition', detail: 'Suspect meningitis: fever + severe headache + neck stiffness (cannot bend chin to chest). Assess consciousness (AVPU). Any altered consciousness = CRITICAL.', timing: 'Immediately', warning: 'This is a medical emergency — do not delay referral' },
      { step: 2, action: 'Pre-Referral Antibiotics', detail: 'If >15 minutes to hospital: Benzylpenicillin IM (adults: 1.2g; children: 300mg/kg/day divided 4-hourly). One dose only, then transport. Document dose and time.', timing: 'Before transport', warning: 'Only give if delay >15min to hospital — do not delay transport for antibiotic' },
      { step: 3, action: 'Emergency Transport', detail: 'Call Bamenda Regional Hospital (+237 233 362 450) to alert them. Position patient on their side if vomiting. Never leave patient alone. Notify DHO same day.', timing: 'Immediately' },
      { step: 4, action: 'Contact Tracing', detail: 'Identify all household contacts and close school contacts. Document for post-exposure chemoprophylaxis. DHO will coordinate Rifampicin distribution to close contacts.', timing: 'Within 24h' },
      { step: 5, action: 'Outbreak Reporting', detail: 'File immediate notification to District Health Officer. Prepare linelist of all suspected cases. Check vaccination status of community — meningococcal vaccination campaign may be needed.', timing: 'Immediately' },
    ],
    medications: [
      { name: 'Benzylpenicillin (Pre-referral)', dose: 'Adults: 1.2g; Children: 300,000 units/kg/day', route: 'IM injection', frequency: 'Single pre-referral dose', duration: 'One dose only — hospital continues', notes: 'ONLY give if >15min to hospital. Document dose and time clearly.', contraindications: ['Known penicillin allergy — use Chloramphenicol instead'] },
      { name: 'Rifampicin (Prophylaxis for contacts)', dose: 'Adults: 600mg BD ×2d; Children: 10mg/kg BD ×2d', route: 'Oral', frequency: 'Twice daily', duration: '2 days', notes: 'For close household contacts of confirmed meningococcal meningitis — DHO coordinates.' },
    ],
    monitoring: [
      'Hospital-only — CHA monitors after discharge',
      'Post-discharge: neurological deficits (deafness, weakness)',
      'Vaccination status of village contacts',
      'New fever cases in village — active surveillance',
      'Report any new cases to DHO within 24h',
    ],
    patientCounseling: [
      'Meningitis spreads through respiratory droplets — not casual contact',
      'Household contacts need preventive antibiotics — contact DHO',
      'Vaccination is the best prevention — check immunization records',
      'Survivors may need hearing tests and neurological follow-up',
      'Alert neighbors to seek care for any fever + severe headache',
    ],
    citation: 'WHO Meningitis Response 2015 · Cameroon Epidemic Meningitis Response Guidelines · CSM Belt Protocol',
  },
  {
    id: 'parkinsons',
    condition: "Parkinson's Disease / Tremor",
    icon: 'vibration',
    color: '#F59E0B',
    urgency: 'Routine',
    tagline: 'Resting tremor + bradykinesia + rigidity → Parkinson disease screening positive',
    redFlags: [
      'Sudden onset tremor (not Parkinson) → rule out stroke',
      'Falls with head injury',
      'Severe dysphagia (swallowing difficulty) → aspiration risk',
      'Acute confusion or psychosis (medication side effect)',
    ],
    referralCriteria: [
      'MediAid Tremor Risk ≥70% → neurology referral',
      'Progressive functional decline despite medication',
      'Suspected drug-induced parkinsonism (antipsychotics)',
      'Falls risk — physiotherapy assessment needed',
    ],
    steps: [
      { step: 1, action: 'Document Tremor Characteristics', detail: 'Resting tremor (worsens at rest, improves with movement) vs Essential tremor (worsens with movement). Parkinson: typically unilateral resting tremor, "pill-rolling."', timing: 'At assessment' },
      { step: 2, action: 'Functional Assessment', detail: 'Can patient: button shirts, write, walk without assistance, cook? Document functional limitations for neurology referral. Falls risk assessment.', timing: 'At assessment' },
      { step: 3, action: 'Medication Review', detail: 'Check for drug-induced parkinsonism: Metoclopramide, Haloperidol, Chlorpromazine all cause tremor. If identified → refer to prescribing physician to switch medication.', timing: 'At assessment' },
      { step: 4, action: 'Safety Assessment', detail: 'Assess fall risk: remove rugs, add grab bars, wear flat shoes, avoid stairs without railing. Schedule quarterly home safety assessments.', timing: 'At initial visit' },
      { step: 5, action: 'Caregiver Support', detail: 'Educate family on disease progression. Link to community support if available. Assess caregiver burden. Advise on exercise (daily walking improves motor function).', timing: 'Ongoing' },
    ],
    medications: [
      { name: 'Levodopa/Carbidopa', dose: '100/25mg', route: 'Oral', frequency: 'TID (with meals)', duration: 'Lifelong — dose titrated by neurologist', notes: 'Most effective PD medication. CHA monitors adherence and side effects. Physician prescribes.', contraindications: ['Angle-closure glaucoma', 'MAO inhibitors', 'Psychosis'] },
      { name: 'Biperiden (Anticholinergic)', dose: '2mg', route: 'Oral', frequency: 'TID', duration: 'Physician-prescribed', notes: 'Useful for tremor-dominant PD. Elderly patients: increased confusion risk. Physician only.', contraindications: ['Glaucoma', 'Urinary retention', 'Dementia'] },
    ],
    monitoring: [
      'Tremor severity — MediAid scan at each 3-month visit',
      'Falls diary — number of falls per week',
      'Medication side effects: dyskinesia, hallucinations, orthostatic hypotension',
      'Swallowing function — refer speech therapy if dysphagia',
      'Mood and cognition — Parkinson dementia is common late complication',
    ],
    patientCounseling: [
      'Exercise daily — walking, cycling, swimming slow disease progression',
      'Take Levodopa 30 minutes before meals for best absorption',
      'Never stop Parkinson medications suddenly — can cause dangerous rebound',
      'Home safety: remove trip hazards, use walking aids',
      'Parkinson is manageable — many people live independently for decades',
    ],
    citation: 'MDS Parkinson Guidelines 2023 · He et al. 2024 — Acoustic tremor biomarkers · WHO PD Care Guidelines',
  },
  {
    id: 'eye',
    condition: 'Eye Conditions (Screening)',
    icon: 'remove-red-eye',
    color: '#A78BFA',
    urgency: 'Routine',
    tagline: 'MediAid screens for 7 ocular conditions. Refer to ophthalmology for any positive finding.',
    redFlags: [
      'Sudden loss of vision in one eye → Retinal detachment EMERGENCY',
      'Severe eye pain with redness → Acute glaucoma EMERGENCY',
      'Chemical/trauma to eye',
      'Red eye + pus in newborn (<28 days) → Gonococcal conjunctivitis',
      'Leukocoria (white pupil in child) → Retinoblastoma',
    ],
    referralCriteria: [
      'Any MediAid eye condition detected → ophthalmology referral',
      'Visual acuity <6/18 in either eye → urgent referral',
      'Any sudden vision loss → emergency',
      'Cataracts affecting daily function → elective surgical referral',
    ],
    steps: [
      { step: 1, action: 'Visual Acuity Test', detail: 'Use Snellen chart at 6 metres. Test each eye separately. Record as fraction (6/6 = normal; 6/60 = severe). Note glasses prescription if worn.', timing: 'At screening' },
      { step: 2, action: 'External Eye Examination', detail: 'Check for: redness, discharge, corneal opacity, pterygium, eyelid lesions. Use pen torch. Assess pupil response to light (equal, round, reactive).', timing: 'At screening' },
      { step: 3, action: 'MediAid AI Screening', detail: 'Part E of 15-second front camera scan assesses 7 conditions: diabetic retinopathy, glaucoma, AMD, conjunctivitis, cataract, pterygium, trachoma.', timing: 'During scan' },
      { step: 4, action: 'Trachoma Active Case Finding', detail: 'Check for trachomatous inflammation (TF): ≥5 follicles in upper tarsal conjunctivum. Evert eyelid for examination. TF in >10% children → mass azithromycin treatment needed.', timing: 'Endemic area screening' },
      { step: 5, action: 'Referral Pathway', detail: 'Mbingo Baptist Hospital has ophthalmology unit (24.1 km). Bamenda Regional Hospital for emergencies. Provide referral letter with MediAid report.', timing: 'As indicated' },
    ],
    medications: [
      { name: 'Tetracycline 1% Eye Ointment', dose: 'Small ribbon to inner eyelid', route: 'Topical', frequency: 'BD for 6 weeks', duration: '6 weeks (trachoma)', notes: 'First-line for trachoma in endemic areas. CHA can apply and teach patient.', contraindications: ['Known tetracycline allergy'] },
      { name: 'Azithromycin', dose: '20mg/kg (max 1g)', route: 'Oral', frequency: 'Single dose', duration: 'Once (community MDA)', notes: 'Mass drug administration for trachoma elimination — ICTC programme. Physician-coordinated.', contraindications: ['Severe liver disease', 'Macrolide allergy'] },
      { name: 'Timolol 0.5% Eye Drops (Glaucoma)', dose: '1 drop each eye', route: 'Topical', frequency: 'BD', duration: 'Lifelong (physician prescription)', notes: 'CHA monitors adherence. Never stop suddenly — intraocular pressure rebound.', contraindications: ['Asthma', 'Bradycardia', 'Heart block'] },
    ],
    monitoring: [
      'Visual acuity at each screening visit — note progression',
      'Trachoma active inflammation response at 6 weeks of tetracycline',
      'Glaucoma medication adherence — adherence critical for IOP control',
      'Post-surgical cataract: vision recovery at 1 week and 1 month',
      'Screen children under 5 for refractive errors and amblyopia',
    ],
    patientCounseling: [
      'Wear UV-protective sunglasses outdoors — reduces cataract and pterygium',
      'Wash hands and face daily — prevents trachoma spread',
      'Diabetics must have annual eye exams — risk of blindness from retinopathy',
      'Report any sudden vision change, pain, or flashlights in vision',
      'Eye conditions caught early are usually treatable — encourage early screening',
    ],
    citation: 'Jin et al. 2024 — AUC 0.91–0.97 · WHO SAFE Strategy Trachoma · IAPB Vision Atlas Cameroon 2024',
  },
];

export default function TreatmentProtocolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'meds' | 'monitor' | 'counsel'>('steps');
  const [searchText, setSearchText] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const selectedProtocol = PROTOCOLS.find((p) => p.id === selectedId);

  const filtered = PROTOCOLS.filter(
    (p) =>
      !searchText ||
      p.condition.toLowerCase().includes(searchText.toLowerCase()) ||
      p.tagline.toLowerCase().includes(searchText.toLowerCase())
  );

  const urgencyColor = (u: UrgencyLevel) =>
    u === 'Critical' ? theme.statusRed : u === 'Urgent' ? theme.statusYellow : theme.statusGreen;

  const readProtocol = (p: Protocol) => {
    if (playingId === p.id) {
      Speech.stop();
      setPlayingId(null);
      return;
    }
    setPlayingId(p.id);
    const text = [
      `${p.condition} treatment protocol.`,
      `Urgency: ${p.urgency}.`,
      p.tagline,
      'Red flags:',
      p.redFlags.join('. '),
      'Clinical steps:',
      p.steps.map((s) => `Step ${s.step}: ${s.action}. ${s.detail}`).join('. '),
    ].join(' ');
    Speech.speak(text, {
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      rate: 0.85,
      onDone: () => setPlayingId(null),
      onStopped: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  useEffect(() => { return () => Speech.stop(); }, []);

  if (selectedProtocol) {
    const col = selectedProtocol.color;
    const urgCol = urgencyColor(selectedProtocol.urgency);

    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.navbar}>
          <Pressable style={styles.backBtn} onPress={() => { setSelectedId(null); setActiveTab('steps'); }}>
            <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle} numberOfLines={1}>{selectedProtocol.condition}</Text>
            <View style={[styles.urgencyBadge, { backgroundColor: urgCol + '22', borderColor: urgCol + '55' }]}>
              <View style={[styles.urgencyDot, { backgroundColor: urgCol }]} />
              <Text style={[styles.urgencyText, { color: urgCol }]}>{selectedProtocol.urgency}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.ttsBtn, { backgroundColor: col + '18', borderColor: col + '44' }, pressed && { opacity: 0.8 }]}
            onPress={() => readProtocol(selectedProtocol)}
          >
            <MaterialIcons name={playingId === selectedProtocol.id ? 'stop' : 'volume-up'} size={18} color={col} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.protocolHeader, { borderColor: col + '55', backgroundColor: col + '0E' }]}>
            <MaterialIcons name={selectedProtocol.icon as any} size={32} color={col} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.protocolHeaderTitle, { color: col }]}>{selectedProtocol.condition}</Text>
              <Text style={styles.protocolTagline}>{selectedProtocol.tagline}</Text>
            </View>
          </View>

          {/* Red flags */}
          <View style={styles.redFlagCard}>
            <View style={styles.redFlagHeader}>
              <MaterialIcons name="warning" size={16} color={theme.statusRed} />
              <Text style={styles.redFlagTitle}>RED FLAGS — REFER IMMEDIATELY</Text>
            </View>
            {selectedProtocol.redFlags.map((flag, i) => (
              <View key={i} style={styles.redFlagRow}>
                <MaterialIcons name="priority-high" size={14} color={theme.statusRed} />
                <Text style={styles.redFlagText}>{flag}</Text>
              </View>
            ))}
          </View>

          {/* Referral criteria */}
          <View style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <MaterialIcons name="local-hospital" size={14} color={theme.statusYellow} />
              <Text style={styles.referralTitle}>REFERRAL CRITERIA</Text>
            </View>
            {selectedProtocol.referralCriteria.map((c, i) => (
              <View key={i} style={styles.referralRow}>
                <MaterialIcons name="send" size={12} color={theme.statusYellow} />
                <Text style={styles.referralText}>{c}</Text>
              </View>
            ))}
          </View>

          {/* Tab selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { id: 'steps', label: 'Clinical Steps', icon: 'checklist' },
                { id: 'meds', label: 'Medications', icon: 'medication' },
                { id: 'monitor', label: 'Monitoring', icon: 'monitor' },
                { id: 'counsel', label: 'Counseling', icon: 'record-voice-over' },
              ] as const).map((tab) => (
                <Pressable
                  key={tab.id}
                  style={[styles.tabChip, activeTab === tab.id && { backgroundColor: col + '22', borderColor: col }]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <MaterialIcons name={tab.icon as any} size={13} color={activeTab === tab.id ? col : theme.textMuted} />
                  <Text style={[styles.tabChipText, activeTab === tab.id && { color: col }]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Steps */}
          {activeTab === 'steps' && selectedProtocol.steps.map((step) => (
            <View key={step.step} style={[styles.stepCard, { borderLeftColor: col }]}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepNum, { backgroundColor: col }]}>
                  <Text style={styles.stepNumText}>{step.step}</Text>
                </View>
                <Text style={styles.stepAction}>{step.action}</Text>
                {step.timing && (
                  <View style={styles.timingBadge}>
                    <MaterialIcons name="schedule" size={10} color={theme.textMuted} />
                    <Text style={styles.timingText}>{step.timing}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.stepDetail}>{step.detail}</Text>
              {step.warning && (
                <View style={styles.stepWarning}>
                  <MaterialIcons name="warning" size={13} color={theme.statusRed} />
                  <Text style={styles.stepWarningText}>{step.warning}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Medications */}
          {activeTab === 'meds' && selectedProtocol.medications.map((med, i) => (
            <View key={i} style={styles.medCard}>
              <View style={styles.medHeader}>
                <MaterialIcons name="medication" size={18} color={col} />
                <Text style={[styles.medName, { color: col }]}>{med.name}</Text>
              </View>
              <View style={styles.medGrid}>
                {[
                  { label: 'Dose', value: med.dose },
                  { label: 'Route', value: med.route },
                  { label: 'Frequency', value: med.frequency },
                  { label: 'Duration', value: med.duration },
                ].map((row) => (
                  <View key={row.label} style={styles.medRow}>
                    <Text style={styles.medRowLabel}>{row.label}</Text>
                    <Text style={styles.medRowValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
              {med.notes && (
                <View style={styles.medNote}>
                  <MaterialIcons name="info-outline" size={13} color={col} />
                  <Text style={[styles.medNoteText, { color: col + 'DD' }]}>{med.notes}</Text>
                </View>
              )}
              {med.contraindications && med.contraindications.length > 0 && (
                <View style={styles.medCI}>
                  <MaterialIcons name="block" size={13} color={theme.statusRed} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medCITitle}>Contraindications</Text>
                    {med.contraindications.map((ci, j) => (
                      <Text key={j} style={styles.medCIText}>• {ci}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Monitoring */}
          {activeTab === 'monitor' && (
            <View style={styles.listCard}>
              {selectedProtocol.monitoring.map((item, i) => (
                <View key={i} style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <View style={[styles.listDot, { backgroundColor: col }]} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Counseling */}
          {activeTab === 'counsel' && (
            <View style={styles.listCard}>
              {selectedProtocol.patientCounseling.map((item, i) => (
                <View key={i} style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <MaterialIcons name="record-voice-over" size={14} color={col} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.citationBox}>
            <MaterialIcons name="science" size={12} color={theme.textMuted} />
            <Text style={styles.citationText}>{selectedProtocol.citation}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Protocol List
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Treatment Protocols</Text>
          <Text style={styles.navSub}>8 WHO-based offline clinical guides</Text>
        </View>
        <View style={styles.offlineBadge}>
          <MaterialIcons name="cloud-off" size={12} color={theme.statusGreen} />
          <Text style={styles.offlineBadgeText}>Offline</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search conditions..."
            placeholderTextColor={theme.textMuted}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Urgency legend */}
        <View style={styles.legendRow}>
          {(['Critical', 'Urgent', 'Routine'] as const).map((u) => (
            <View key={u} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: urgencyColor(u) }]} />
              <Text style={styles.legendText}>{u}</Text>
            </View>
          ))}
        </View>

        {/* Protocol cards */}
        <Text style={styles.sectionTitle}>{filtered.length} PROTOCOLS — TAP TO OPEN</Text>
        {filtered.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [styles.protocolCard, { borderLeftColor: p.color }, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.selectionAsync();
              setSelectedId(p.id);
              setActiveTab('steps');
            }}
          >
            <View style={[styles.protocolIconCircle, { backgroundColor: p.color + '18', borderColor: p.color + '44' }]}>
              <MaterialIcons name={p.icon as any} size={22} color={p.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.protocolCardHeader}>
                <Text style={styles.protocolCardTitle}>{p.condition}</Text>
                <View style={[styles.urgencySmallBadge, { backgroundColor: urgencyColor(p.urgency) + '22', borderColor: urgencyColor(p.urgency) + '55' }]}>
                  <Text style={[styles.urgencySmallText, { color: urgencyColor(p.urgency) }]}>{p.urgency}</Text>
                </View>
              </View>
              <Text style={styles.protocolCardTagline} numberOfLines={2}>{p.tagline}</Text>
              <View style={styles.protocolCardMeta}>
                <Text style={styles.protocolCardMetaText}>
                  {p.steps.length} steps · {p.medications.length} meds · {p.redFlags.length} red flags
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        ))}

        <View style={styles.footerBox}>
          <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
          <Text style={styles.footerText}>
            All protocols based on WHO Essential Medicine Guidelines and Cameroon national treatment protocols. CHAs must follow national referral pathways. These are decision-support tools, not replacements for clinical judgment.
          </Text>
        </View>
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
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusGreenBg, borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  offlineBadgeText: { fontSize: 10, fontWeight: '700', color: theme.statusGreen },
  ttsBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, alignSelf: 'flex-start', marginTop: 2,
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 10, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: theme.border, marginTop: 14, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.textPrimary },

  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  sectionTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },

  protocolCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  protocolIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  protocolCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  protocolCardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  urgencySmallBadge: { borderRadius: theme.radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  urgencySmallText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  protocolCardTagline: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginBottom: 6 },
  protocolCardMeta: {},
  protocolCardMetaText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },

  footerBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginTop: 8, borderWidth: 1, borderColor: theme.border,
  },
  footerText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 17 },

  // Detail view
  protocolHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: theme.radius.medium, padding: 16,
    borderWidth: 1, marginTop: 16, marginBottom: 14,
  },
  protocolHeaderTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  protocolTagline: { fontSize: 13, color: theme.textSecondary, lineHeight: 20 },

  redFlagCard: {
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  redFlagHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  redFlagTitle: { fontSize: 11, fontWeight: '800', color: theme.statusRed, letterSpacing: 0.5 },
  redFlagRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  redFlagText: { flex: 1, fontSize: 13, color: theme.statusRed, lineHeight: 19, fontWeight: '500' },

  referralCard: {
    backgroundColor: theme.statusYellowBg, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: theme.statusYellow + '44',
  },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  referralTitle: { fontSize: 11, fontWeight: '800', color: theme.statusYellow, letterSpacing: 0.5 },
  referralRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  referralText: { flex: 1, fontSize: 13, color: theme.statusYellow, lineHeight: 19, fontWeight: '500' },

  tabChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.border,
  },
  tabChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },

  stepCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 4, borderWidth: 1, borderColor: theme.border,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  stepAction: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  timingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.background, borderRadius: theme.radius.full,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: theme.border,
  },
  timingText: { fontSize: 9, color: theme.textMuted, fontWeight: '600' },
  stepDetail: { fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
  stepWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.small,
    padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  stepWarningText: { flex: 1, fontSize: 12, color: theme.statusRed, fontWeight: '600', lineHeight: 18 },

  medCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: theme.border,
  },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  medName: { fontSize: 16, fontWeight: '700', flex: 1 },
  medGrid: { gap: 6, marginBottom: 8 },
  medRow: { flexDirection: 'row', gap: 10 },
  medRowLabel: { width: 80, fontSize: 11, color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  medRowValue: { flex: 1, fontSize: 13, color: theme.textPrimary, fontWeight: '500', lineHeight: 18 },
  medNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.background, borderRadius: theme.radius.small,
    padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: theme.border,
  },
  medNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  medCI: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.statusRedBg, borderRadius: theme.radius.small,
    padding: 10, borderWidth: 1, borderColor: theme.statusRed + '44',
  },
  medCITitle: { fontSize: 10, fontWeight: '800', color: theme.statusRed, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  medCIText: { fontSize: 12, color: theme.statusRed, lineHeight: 18 },

  listCard: {
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  listDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  listText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 20 },

  citationBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: theme.surface, borderRadius: theme.radius.medium,
    padding: 12, marginTop: 14,
    borderWidth: 1, borderColor: theme.border,
  },
  citationText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 17 },
});
