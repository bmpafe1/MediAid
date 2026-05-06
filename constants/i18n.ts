// MediAid — English / French translations
import { Language } from '@/contexts/AppContext';

type Translations = {
  // Home
  home_scan_btn: string;
  home_scan_sub_demo: string;
  home_scan_sub_full: string;
  home_today_scans: string;
  home_red_alerts: string;
  home_pending_sync: string;
  home_what_we_detect: string;
  home_recent_patients: string;
  home_footer_note: string;
  home_demo_banner: string;

  // Consent
  consent_state_name: string;
  consent_name_placeholder: string;
  consent_question: string;
  consent_yes: string;
  consent_yes_sub: string;
  consent_no: string;
  consent_no_sub: string;
  consent_note: string;

  // Scan parts
  partA_instruction: string;
  partA_sub: string;
  partB_instruction: string;
  partB_sub: string;
  partC_instruction: string;
  partC_sub: string;
  partD_instruction: string;
  partD_sub: string;
  partE_instruction: string;
  partE_sub: string;
  partA_label: string;
  partB_label: string;
  partC_label: string;
  partD_label: string;
  partE_label: string;

  // Processing
  processing_title: string;
  processing_sub: string;
  processing_facial: string;
  processing_cough: string;
  processing_spo2: string;
  processing_report: string;

  // Results
  results_dashboard: string;
  results_action_red: string;
  results_action_green: string;
  results_sensor_results: string;
  results_view_alert: string;
  results_no_scans: string;
  results_go_scanner: string;
  results_consent_logged: string;

  // Safety
  safety_title: string;
  safety_subtitle: string;
  safety_escort_btn: string;
  safety_escort_sub: string;
  safety_bypass_locked: string;
  safety_bypass_unlocked: string;
  safety_bypass_confirm_title: string;
  safety_bypass_confirm_sub: string;
  safety_bypass_cancel: string;
  safety_bypass_confirm: string;
  safety_escort_logged: string;
  safety_escort_logged_sub: string;

  // History
  history_title: string;
  history_search: string;
  history_filter_all: string;
  history_filter_red: string;
  history_filter_yellow: string;
  history_filter_green: string;
  history_no_results: string;
  history_empty: string;

  // Sync
  sync_title: string;
  sync_btn: string;
  sync_btn_syncing: string;
  sync_demo_mode: string;
  sync_demo_desc: string;
  sync_language: string;
  sync_language_desc: string;

  // Radar
  radar_title: string;
  radar_climate_toggle: string;
  radar_outbreak_alerts: string;

  // Metric labels
  metric_tb: string;
  metric_afib: string;
  metric_hr: string;
  metric_hgb: string;
  metric_spo2: string;
  metric_rr: string;
  metric_tremor: string;
  metric_eye: string;

  // Status chips
  status_referral: string;
  status_watch: string;
  status_normal: string;

  // TTS voice prompts (spoken aloud)
  tts_consent_prompt: string;
  tts_partA_prompt: string;
  tts_partB_prompt: string;
  tts_partC_prompt: string;
  tts_partD_prompt: string;
  tts_partE_prompt: string;
  tts_processing: string;
  tts_red_alert: string;
};

const en: Translations = {
  home_scan_btn: 'SCAN PATIENT',
  home_scan_sub_demo: '10-second demo · Voice guided · Offline',
  home_scan_sub_full: '90-second full scan · Voice guided · Offline',
  home_today_scans: "Today's\nScans",
  home_red_alerts: 'Red\nAlerts',
  home_pending_sync: 'Pending\nSync',
  home_what_we_detect: 'WHAT WE DETECT',
  home_recent_patients: 'RECENT PATIENTS',
  home_footer_note: 'All data processed on-device. No internet required for clinical functions.',
  home_demo_banner: 'Demo Mode ON — 90 sec scan compressed to 10 sec',

  consent_state_name: 'State patient name or ID',
  consent_name_placeholder: 'Patient name or ID...',
  consent_question: 'Do you consent to this health scan?',
  consent_yes: 'YES',
  consent_yes_sub: 'I consent',
  consent_no: 'NO',
  consent_no_sub: 'Cancel',
  consent_note: 'Oral consent will be timestamp-logged per ethical protocol (Camara et al. 2021)',

  partA_instruction: 'Look at the phone. Hold still.',
  partA_sub: 'Front camera scanning · Heart rate · AFib risk · Hemoglobin',
  partB_instruction: 'Take a deep breath. Cough 3 times.',
  partB_sub: 'Microphone recording · TB risk classification (HeAR model)',
  partC_instruction: 'Place finger on the rear camera lens.',
  partC_sub: 'Rear camera + flash · SpO₂ · Respiratory rate',
  partD_instruction: 'Hold phone loosely. Rest your hand.',
  partD_sub: 'Accelerometer detects resting tremor — He et al. 2024 (AUC 0.89)',
  partE_instruction: 'Open eyes wide. Look at the camera.',
  partE_sub: 'Front camera retinal analysis · 7 ocular conditions — Jin et al. 2024',
  partA_label: 'Facial Video',
  partB_label: 'Cough Analysis',
  partC_label: 'Finger Sensor',
  partD_label: 'Tremor Screen',
  partE_label: 'Eye Screening',

  processing_title: 'Analysing Results',
  processing_sub: 'On-device AI inference · TensorFlow Lite · No data transmitted',
  processing_facial: 'Facial PPG analysis',
  processing_cough: 'Cough classification',
  processing_spo2: 'SpO₂ / RR calculation',
  processing_report: 'Generating report',

  results_dashboard: 'DIAGNOSTIC DASHBOARD',
  results_action_red: 'RED detected. Escort patient to clinic immediately.',
  results_action_green: 'All metrics within normal range. Continue monitoring.',
  results_sensor_results: 'SENSOR RESULTS',
  results_view_alert: 'VIEW ALERT',
  results_no_scans: 'No Scans Yet',
  results_go_scanner: 'Go to Scanner',
  results_consent_logged: 'Oral consent recorded',

  safety_title: 'LIFE-THREATENING\nCONDITION DETECTED',
  safety_subtitle: 'YOU MUST ESCORT THIS PATIENT TO THE NEAREST CLINIC IMMEDIATELY.',
  safety_escort_btn: 'I AM ESCORTING THE PATIENT',
  safety_escort_sub: 'Logs timestamp · Closes alert',
  safety_bypass_locked: 'BYPASS — Locked for {n}s',
  safety_bypass_unlocked: 'BYPASS (Supervisor will be alerted)',
  safety_bypass_confirm_title: 'Confirm bypass?',
  safety_bypass_confirm_sub: 'Supervisor will be alerted via SMS immediately.',
  safety_bypass_cancel: 'Cancel',
  safety_bypass_confirm: 'Confirm Bypass',
  safety_escort_logged: 'Escort Logged',
  safety_escort_logged_sub: 'Timestamp recorded. Safe travels with your patient.',

  history_title: 'Patient History',
  history_search: 'Search by name or ID...',
  history_filter_all: 'All',
  history_filter_red: 'Red Alerts',
  history_filter_yellow: 'Watch',
  history_filter_green: 'Normal',
  history_no_results: 'No patients match your search.',
  history_empty: 'No scans yet. Tap Scan Patient on the Home tab.',

  sync_title: 'Data Sync',
  sync_btn: 'Sync Now (DHIS2 / FHIR R4)',
  sync_btn_syncing: 'Syncing DHIS2 / FHIR R4...',
  sync_demo_mode: 'Demo Mode (10-sec scan)',
  sync_demo_desc: 'Compresses 90-sec scan to 10 sec for presentations',
  sync_language: 'Language / Langue',
  sync_language_desc: 'Switch between English and French',

  radar_title: 'District Health Intelligence',
  radar_climate_toggle: 'Climate Layer (Rainfall Anomaly)',
  radar_outbreak_alerts: 'CURRENT OUTBREAK ALERTS',

  metric_tb: 'TB Risk',
  metric_afib: 'AFib Risk',
  metric_hr: 'Heart Rate',
  metric_hgb: 'Hemoglobin',
  metric_spo2: 'SpO₂',
  metric_rr: 'Resp. Rate',
  metric_tremor: 'Tremor',
  metric_eye: 'Eye',

  status_referral: 'REFERRAL REQUIRED',
  status_watch: 'WATCH',
  status_normal: 'NORMAL',

  tts_consent_prompt: 'Please state the patient name or ID, then tap Yes to consent.',
  tts_partA_prompt: 'Part A. Look at the phone. Hold still. Do not move.',
  tts_partB_prompt: 'Part B. Take a deep breath. Now cough three times.',
  tts_partC_prompt: 'Part C. Place your finger on the rear camera lens. Hold still.',
  tts_partD_prompt: 'Part D. Hold the phone loosely. Rest your hand. Do not grip.',
  tts_partE_prompt: 'Part E. Open your eyes wide and look directly at the camera.',
  tts_processing: 'Scan complete. Analysing your results now.',
  tts_red_alert: 'Warning. A life-threatening condition has been detected. You must escort this patient to the clinic.',
};

const fr: Translations = {
  home_scan_btn: 'SCANNER LE PATIENT',
  home_scan_sub_demo: 'Démo 10 secondes · Guidé par voix · Hors ligne',
  home_scan_sub_full: 'Scan complet 90 sec · Guidé par voix · Hors ligne',
  home_today_scans: "Scans\naujourd'hui",
  home_red_alerts: 'Alertes\nRouges',
  home_pending_sync: 'En attente\nde sync',
  home_what_we_detect: 'CE QUE NOUS DÉTECTONS',
  home_recent_patients: 'PATIENTS RÉCENTS',
  home_footer_note: "Toutes les données traitées sur l'appareil. Pas d'internet requis pour les fonctions cliniques.",
  home_demo_banner: 'Mode Démo ACTIF — Scan 90 sec compressé à 10 sec',

  consent_state_name: "Dites le nom ou l'ID du patient",
  consent_name_placeholder: 'Nom ou ID du patient...',
  consent_question: 'Consentez-vous à ce bilan de santé?',
  consent_yes: 'OUI',
  consent_yes_sub: 'Je consens',
  consent_no: 'NON',
  consent_no_sub: 'Annuler',
  consent_note: "Le consentement oral sera horodaté selon le protocole éthique (Camara et al. 2021)",

  partA_instruction: 'Regardez le téléphone. Restez immobile.',
  partA_sub: 'Caméra frontale · Fréquence cardiaque · Risque FAB · Hémoglobine',
  partB_instruction: 'Inspirez profondément. Toussez 3 fois.',
  partB_sub: 'Enregistrement micro · Classification de la toux (modèle HeAR)',
  partC_instruction: "Placez votre doigt sur l'objectif arrière.",
  partC_sub: 'Caméra arrière + flash · SpO₂ · Fréquence respiratoire',
  partD_instruction: 'Tenez le téléphone lâchement. Reposez votre main.',
  partD_sub: "L'accéléromètre détecte le tremblement de repos — He et al. 2024",
  partE_instruction: "Ouvrez grand les yeux. Regardez la caméra.",
  partE_sub: "Analyse rétinienne caméra frontale · 7 conditions — Jin et al. 2024",
  partA_label: 'Vidéo Faciale',
  partB_label: 'Analyse de Toux',
  partC_label: 'Capteur Doigt',
  partD_label: 'Dépistage Tremblements',
  partE_label: 'Dépistage Oculaire',

  processing_title: 'Analyse en cours...',
  processing_sub: 'Inférence IA sur appareil · TensorFlow Lite · Aucune donnée transmise',
  processing_facial: 'Analyse PPG faciale',
  processing_cough: 'Classification de la toux',
  processing_spo2: 'Calcul SpO₂ / FR',
  processing_report: 'Génération du rapport',

  results_dashboard: 'TABLEAU DE BORD CLINIQUE',
  results_action_red: 'ROUGE détecté. Escortez le patient en clinique immédiatement.',
  results_action_green: 'Tous les indicateurs sont dans la plage normale. Continuer la surveillance.',
  results_sensor_results: 'RÉSULTATS CAPTEURS',
  results_view_alert: "VOIR L'ALERTE",
  results_no_scans: 'Aucun Scan',
  results_go_scanner: 'Aller au Scanner',
  results_consent_logged: 'Consentement oral enregistré',

  safety_title: 'CONDITION POTENTIELLEMENT\nMORTELLE DÉTECTÉE',
  safety_subtitle: 'VOUS DEVEZ ESCORTER CE PATIENT VERS LA CLINIQUE LA PLUS PROCHE IMMÉDIATEMENT.',
  safety_escort_btn: "J'ESCORTE LE PATIENT",
  safety_escort_sub: "Horodatage enregistré · Ferme l'alerte",
  safety_bypass_locked: 'IGNORER — Verrouillé pour {n}s',
  safety_bypass_unlocked: 'IGNORER (Le superviseur sera alerté)',
  safety_bypass_confirm_title: "Confirmer l'ignorance?",
  safety_bypass_confirm_sub: 'Le superviseur sera alerté par SMS immédiatement.',
  safety_bypass_cancel: 'Annuler',
  safety_bypass_confirm: "Confirmer l'ignorance",
  safety_escort_logged: 'Escorte Enregistrée',
  safety_escort_logged_sub: 'Horodatage enregistré. Bon courage avec votre patient.',

  history_title: 'Historique des Patients',
  history_search: 'Rechercher par nom ou ID...',
  history_filter_all: 'Tous',
  history_filter_red: 'Alertes Rouges',
  history_filter_yellow: 'Surveillance',
  history_filter_green: 'Normal',
  history_no_results: 'Aucun patient ne correspond à votre recherche.',
  history_empty: "Aucun scan. Appuyez sur 'Scanner le Patient' dans l'onglet Accueil.",

  sync_title: 'Synchronisation',
  sync_btn: 'Synchroniser (DHIS2 / FHIR R4)',
  sync_btn_syncing: 'Synchronisation DHIS2 / FHIR R4...',
  sync_demo_mode: 'Mode Démo (scan 10 sec)',
  sync_demo_desc: 'Compresse le scan de 90 sec à 10 sec pour les présentations',
  sync_language: 'Langue / Language',
  sync_language_desc: "Basculer entre l'anglais et le français",

  radar_title: 'Intelligence de Santé du District',
  radar_climate_toggle: 'Couche Climatique (Anomalie Pluviométrique)',
  radar_outbreak_alerts: "ALERTES D'ÉPIDÉMIES EN COURS",

  metric_tb: 'Risque TB',
  metric_afib: 'Risque FAB',
  metric_hr: 'Fréquence Cardiaque',
  metric_hgb: 'Hémoglobine',
  metric_spo2: 'SpO₂',
  metric_rr: 'Fréquence Respiratoire',
  metric_tremor: 'Tremblements',
  metric_eye: 'Oculaire',

  status_referral: 'RÉFÉRENCE REQUISE',
  status_watch: 'SURVEILLANCE',
  status_normal: 'NORMAL',

  tts_consent_prompt: "Veuillez indiquer le nom ou l'ID du patient, puis appuyez sur Oui pour consentir.",
  tts_partA_prompt: 'Partie A. Regardez le téléphone. Restez immobile. Ne bougez pas.',
  tts_partB_prompt: 'Partie B. Inspirez profondément. Toussez maintenant trois fois.',
  tts_partC_prompt: "Partie C. Placez votre doigt sur l'objectif arrière. Restez immobile.",
  tts_partD_prompt: 'Partie D. Tenez le téléphone lâchement. Reposez votre main. Ne serrez pas.',
  tts_partE_prompt: 'Partie E. Ouvrez grands les yeux et regardez directement la caméra.',
  tts_processing: 'Scan terminé. Analyse de vos résultats en cours.',
  tts_red_alert: "Attention. Une condition potentiellement mortelle a été détectée. Vous devez escorter ce patient à la clinique.",
};

const translations: Record<Language, Translations> = { en, fr };

export function t(key: keyof Translations, lang: Language, vars?: Record<string, string | number>): string {
  let str = translations[lang][key] ?? translations['en'][key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
  }
  return str;
}
