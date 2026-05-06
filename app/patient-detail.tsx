// MediAid — Patient Detail Screen
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { getStatusForMetric, ScanResult } from '@/services/mockData';

type Status = 'red' | 'yellow' | 'green';

function statusColor(s: Status) {
  return s === 'red' ? theme.statusRed : s === 'yellow' ? theme.statusYellow : theme.statusGreen;
}
function statusBg(s: Status) {
  return s === 'red' ? theme.statusRedBg : s === 'yellow' ? theme.statusYellowBg : theme.statusGreenBg;
}
function statusLabel(s: Status) {
  return s === 'red' ? 'REFERRAL' : s === 'yellow' ? 'WATCH' : 'NORMAL';
}

function metricStatusColor(status: Status) {
  return status === 'red' ? '#FF3B3B' : status === 'yellow' ? '#FFB800' : '#00D97E';
}

async function exportReport(scan: ScanResult) {
  const overallColor = scan.hasRedAlert ? '#FF3B3B' : '#00D97E';
  const overallLabel = scan.hasRedAlert ? 'REFERRAL REQUIRED' : 'ALL NORMAL';

  const metricsData = [
    { label: 'TB Risk', value: `${scan.tbRisk}%`, status: getStatusForMetric('tbRisk', scan.tbRisk), citation: 'WHO/Google HeAR 2023 — 94% accuracy' },
    { label: 'AFib Risk', value: `${scan.afibRisk}%`, status: getStatusForMetric('afibRisk', scan.afibRisk), citation: 'Yan et al. 2018 — 95% sensitivity' },
    { label: 'Heart Rate', value: `${scan.heartRate} BPM`, status: getStatusForMetric('heartRate', scan.heartRate), citation: 'Facial rPPG analysis' },
    { label: 'Hemoglobin', value: `${scan.hemoglobin} g/dL`, status: getStatusForMetric('hemoglobin', scan.hemoglobin), citation: 'Wemyss et al. 2023 — AUC 0.97' },
    { label: 'SpO₂', value: `${scan.spo2}%`, status: getStatusForMetric('spo2', scan.spo2), citation: 'Rear-camera PPG flash' },
    { label: 'Respiratory Rate', value: `${scan.respiratoryRate} br/min`, status: getStatusForMetric('respiratoryRate', scan.respiratoryRate), citation: 'Alafeef & Fraiwan 2020 — RMSE 0.37' },
    { label: "Tremor / Parkinson's", value: `${scan.tremorRisk}%`, status: getStatusForMetric('tremorRisk', scan.tremorRisk), citation: 'He et al. 2024 — AUC 0.89' },
    { label: 'Eye Conditions', value: `${scan.eyeConditions} detected`, status: getStatusForMetric('eyeConditions', scan.eyeConditions), citation: 'Jin et al. 2024 — AUC 0.91–0.97' },
  ] as const;

  const metricRows = metricsData.map((m) => {
    const col = metricStatusColor(m.status as Status);
    const label = m.status === 'red' ? 'REFERRAL' : m.status === 'yellow' ? 'WATCH' : 'NORMAL';
    const barPct = Math.min(100, parseInt(m.value) || 0);
    return `
      <tr style="border-bottom:1px solid #1E2D3A;">
        <td style="padding:10px 12px;">
          <div style="font-size:13px;font-weight:700;color:#E0EAF4;">${m.label}</div>
          <div style="font-size:10px;color:#6B8498;margin-top:2px;">${m.citation}</div>
        </td>
        <td style="padding:10px 12px;text-align:center;">
          <span style="font-size:16px;font-weight:800;color:${col};">${m.value}</span>
        </td>
        <td style="padding:10px 12px;">
          <span style="background:${col}22;color:${col};border:1px solid ${col}55;border-radius:99px;padding:3px 10px;font-size:10px;font-weight:700;">${label}</span>
        </td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #0A1520; color: #E0EAF4; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .brand { }
  .brand-title { font-size: 28px; font-weight: 900; color: #00AEEF; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #6B8498; margin-top: 3px; letter-spacing: 0.5px; text-transform: uppercase; }
  .overall-badge { background: ${overallColor}22; border: 1.5px solid ${overallColor}; border-radius: 10px; padding: 10px 18px; text-align: center; }
  .overall-label { font-size: 12px; font-weight: 800; color: ${overallColor}; letter-spacing: 1px; text-transform: uppercase; }
  .patient-card { background: #0F1E2C; border: 1px solid #1E2D3A; border-radius: 12px; padding: 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: flex-start; }
  .patient-name { font-size: 22px; font-weight: 800; color: #E0EAF4; }
  .patient-id { font-size: 12px; color: #6B8498; margin-top: 4px; }
  .patient-meta { font-size: 11px; color: #6B8498; margin-top: 8px; }
  .section-title { font-size: 10px; font-weight: 700; color: #6B8498; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; margin-top: 22px; }
  table { width: 100%; border-collapse: collapse; background: #0F1E2C; border-radius: 10px; overflow: hidden; border: 1px solid #1E2D3A; }
  .stats-grid { display: flex; gap: 12px; margin-bottom: 22px; }
  .stat-card { flex: 1; background: #0F1E2C; border: 1px solid #1E2D3A; border-radius: 10px; padding: 14px; text-align: center; }
  .stat-num { font-size: 28px; font-weight: 900; }
  .stat-label { font-size: 10px; color: #6B8498; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .citations { background: #0F1E2C; border: 1px solid #1E2D3A; border-radius: 10px; padding: 14px; margin-top: 22px; }
  .citation-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; }
  .citation-num { font-size: 11px; font-weight: 700; color: #00AEEF; min-width: 24px; }
  .citation-text { font-size: 11px; color: #6B8498; line-height: 1.5; }
  .footer { margin-top: 28px; text-align: center; font-size: 10px; color: #4A6070; line-height: 1.7; }
  .footer-divider { border: none; border-top: 1px solid #1E2D3A; margin: 16px 0; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-title">MediAid</div>
      <div class="brand-sub">UNICEF Venture Fund · Cameroon · v10.0 Prototype</div>
    </div>
    <div class="overall-badge">
      <div class="overall-label">${overallLabel}</div>
      <div style="font-size:10px;color:#6B8498;margin-top:3px;">Overall Status</div>
    </div>
  </div>

  <div class="patient-card">
    <div>
      <div class="patient-name">${scan.patientName}</div>
      <div class="patient-id">${scan.patientId}</div>
      <div class="patient-meta">Scan: ${new Date(scan.scanTimestamp).toLocaleString()}</div>
      <div class="patient-meta">Consent: ${new Date(scan.consentTimestamp).toLocaleString()} · ${scan.synced ? 'Synced ✓' : 'Pending Sync'}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:#6B8498;">Report generated</div>
      <div style="font-size:11px;color:#E0EAF4;font-weight:600;margin-top:3px;">${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-num" style="color:#FF3B3B;">${metricsData.filter((m: any) => m.status === 'red').length}</div><div class="stat-label">Referral Flags</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#FFB800;">${metricsData.filter((m: any) => m.status === 'yellow').length}</div><div class="stat-label">Watch Flags</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#00D97E;">${metricsData.filter((m: any) => m.status === 'green').length}</div><div class="stat-label">Normal</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#00AEEF;">8</div><div class="stat-label">Capabilities</div></div>
  </div>

  <div class="section-title">DIAGNOSTIC METRICS</div>
  <table>
    <thead><tr style="background:#1E2D3A;"><th style="padding:10px 12px;text-align:left;font-size:10px;color:#6B8498;font-weight:700;letter-spacing:1px;">METRIC</th><th style="padding:10px 12px;text-align:center;font-size:10px;color:#6B8498;font-weight:700;letter-spacing:1px;">VALUE</th><th style="padding:10px 12px;text-align:left;font-size:10px;color:#6B8498;font-weight:700;letter-spacing:1px;">STATUS</th></tr></thead>
    <tbody>${metricRows}</tbody>
  </table>

  <div class="section-title">PEER-REVIEWED EVIDENCE BASE</div>
  <div class="citations">
    <div class="citation-row"><span class="citation-num">[1]</span><span class="citation-text">Yan et al. (2018). Contactless AF screening via facial rPPG — 95% sensitivity, 96% specificity vs 12-lead ECG. <em>Nature Digital Medicine.</em></span></div>
    <div class="citation-row"><span class="citation-num">[2]</span><span class="citation-text">He et al. (2024). Enhanced early Parkinson's detection from smartphone sensors — AUC 0.89, sensitivity 0.95. <em>Journal of Neurology.</em></span></div>
    <div class="citation-row"><span class="citation-num">[3]</span><span class="citation-text">Jin et al. (2024). AI-based eye disease screening — 7 conditions with high agreement to standard examination. <em>Ophthalmology.</em></span></div>
    <div class="citation-row"><span class="citation-num">[4]</span><span class="citation-text">WHO / Google HeAR (2023). Cough AI for TB classification — 94% accuracy on community health recordings.</span></div>
    <div class="citation-row"><span class="citation-num">[5]</span><span class="citation-text">Wemyss et al. (2023). Non-invasive anaemia screening — conjunctival colorimetry AUC 0.97, Ghana-validated.</span></div>
    <div class="citation-row"><span class="citation-num">[6]</span><span class="citation-text">Alafeef & Fraiwan (2020). Respiratory rate from skin-video PPG — RMSE 0.37 breaths/min. <em>IEEE Sensors Journal.</em></span></div>
    <div class="citation-row"><span class="citation-num">[7]</span><span class="citation-text">Weng et al. / Google Health (2024). 10-year CVD risk from PPG alone — C-statistic 71.1%, n=141,509.</span></div>
    <div class="citation-row"><span class="citation-num">[8]</span><span class="citation-text">Zeynali et al. (2025). Non-invasive blood glucose flag from PPG via TinyML on-device.</span></div>
  </div>

  <hr class="footer-divider">
  <div class="footer">
    MediAid v10.0 · Community Health Aide Platform · UNICEF Venture Fund 2025<br>
    Generated on-device · AES-256 encrypted at rest · FHIR R4 compliant · Not a replacement for clinical diagnosis<br>
    NW Cameroon · CHAs must follow national referral protocols
  </div>
</body>
</html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const filename = `MediAid_${scan.patientId}_${Date.now()}.pdf`;
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.moveAsync({ from: uri, to: dest });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: 'Share Clinical PDF Report' });
    } else {
      Alert.alert('PDF Saved', `Report saved to: ${dest}`);
    }
  } catch {
    Alert.alert('Error', 'Could not generate PDF report.');
  }
}

// QR Code Modal
function QRModal({ scan, visible, onClose }: { scan: ScanResult; visible: boolean; onClose: () => void }) {
  const qrData = JSON.stringify({
    id: scan.patientId,
    name: scan.patientName,
    ts: scan.scanTimestamp,
    alert: scan.hasRedAlert ? 'RED' : 'NORMAL',
    tb: scan.tbRisk,
    hr: scan.heartRate,
    spo2: scan.spo2,
    source: 'MediAid v1.0 UNICEF',
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={qrStyles.backdrop} onPress={onClose}>
        <Pressable style={qrStyles.card}>
          <View style={qrStyles.header}>
            <MaterialIcons name="qr-code" size={20} color={theme.primary} />
            <Text style={qrStyles.title}>Patient QR Badge</Text>
            <Pressable style={qrStyles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={qrStyles.qrWrapper}>
            <QRCode
              value={qrData}
              size={200}
              color={theme.textPrimary}
              backgroundColor={theme.surface}
            />
          </View>

          <View style={qrStyles.patientInfo}>
            <Text style={qrStyles.patientName}>{scan.patientName}</Text>
            <Text style={qrStyles.patientId}>{scan.patientId}</Text>
            <View style={[
              qrStyles.alertBadge,
              {
                backgroundColor: scan.hasRedAlert ? theme.statusRedBg : theme.statusGreenBg,
                borderColor: scan.hasRedAlert ? theme.statusRed + '55' : theme.statusGreen + '55',
              },
            ]}>
              <MaterialIcons
                name={scan.hasRedAlert ? 'warning' : 'check-circle'}
                size={14}
                color={scan.hasRedAlert ? theme.statusRed : theme.statusGreen}
              />
              <Text style={[qrStyles.alertBadgeText, { color: scan.hasRedAlert ? theme.statusRed : theme.statusGreen }]}>
                {scan.hasRedAlert ? 'RED ALERT' : 'NORMAL'}
              </Text>
            </View>
          </View>

          <Text style={qrStyles.qrNote}>
            QR contains patient ID, alert status, key vitals{'\n'}Scan with any QR reader for quick lookup
          </Text>
          <Text style={qrStyles.qrSub}>MediAid v1.0 · UNICEF Venture Fund · FHIR R4</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const qrStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.large,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.border,
  },
  patientInfo: { alignItems: 'center', gap: 4 },
  patientName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  patientId: { fontSize: 12, color: theme.textMuted },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    marginTop: 4,
  },
  alertBadgeText: { fontSize: 11, fontWeight: '700' },
  qrNote: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 },
  qrSub: { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
});

interface MetricBarProps {
  label: string;
  value: string;
  rawValue: number;
  maxValue: number;
  status: Status;
  note: string;
  icon: string;
  citation?: string;
}

function MetricBar({ label, value, rawValue, maxValue, status, note, icon, citation }: MetricBarProps) {
  const col = statusColor(status);
  const pct = Math.min(1, rawValue / maxValue);

  return (
    <View style={[styles.metricCard, { borderLeftColor: col }]}>
      <View style={styles.metricHeader}>
        <MaterialIcons name={icon as any} size={20} color={col} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.metricLabel}>{label}</Text>
          {citation && <Text style={styles.metricCitation}>{citation}</Text>}
        </View>
        <View style={[styles.statusChip, { backgroundColor: col + '22', borderColor: col + '55' }]}>
          <Text style={[styles.statusChipText, { color: col }]}>{statusLabel(status)}</Text>
        </View>
      </View>
      <Text style={[styles.metricValue, { color: col }]}>{value}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: col }]} />
      </View>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

export default function PatientDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const { scanHistory } = useApp();
  const [qrVisible, setQrVisible] = useState(false);
  const [patientPhotoUri, setPatientPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (scan?.patientId) {
      AsyncStorage.getItem('mediaid_patient_photo_' + scan.patientId).then((uri) => {
        if (uri) setPatientPhotoUri(uri);
      });
    }
  }, [scan?.patientId]);

  const scan = useMemo(
    () => scanHistory.find((s) => s.id === scanId) ?? scanHistory[0] ?? null,
    [scanId, scanHistory]
  );

  if (!scan) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.emptyState}>
          <MaterialIcons name="person-search" size={60} color={theme.textMuted} />
          <Text style={styles.emptyText}>Patient record not found.</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const metrics: MetricBarProps[] = [
    {
      label: 'TB Risk',
      value: `${scan.tbRisk}%`,
      rawValue: scan.tbRisk,
      maxValue: 100,
      status: getStatusForMetric('tbRisk', scan.tbRisk),
      note: 'Acoustic cough analysis — HeAR model',
      icon: 'air',
      citation: 'WHO / Google HeAR 2023 — 94% accuracy',
    },
    {
      label: 'AFib Risk',
      value: `${scan.afibRisk}%`,
      rawValue: scan.afibRisk,
      maxValue: 100,
      status: getStatusForMetric('afibRisk', scan.afibRisk),
      note: 'Facial PPG rPPG analysis',
      icon: 'monitor-heart',
      citation: 'Yan et al. 2018 — 95% sensitivity',
    },
    {
      label: 'Heart Rate',
      value: `${scan.heartRate} BPM`,
      rawValue: scan.heartRate,
      maxValue: 200,
      status: getStatusForMetric('heartRate', scan.heartRate),
      note: 'Facial video rPPG (normal 60-100 BPM)',
      icon: 'favorite',
    },
    {
      label: 'Hemoglobin',
      value: `${scan.hemoglobin} g/dL`,
      rawValue: scan.hemoglobin,
      maxValue: 18,
      status: getStatusForMetric('hemoglobin', scan.hemoglobin),
      note: 'Conjunctival pallor analysis (normal 12+ g/dL)',
      icon: 'opacity',
      citation: 'Anemia Screening Consortium 2023',
    },
    {
      label: 'SpO2',
      value: `${scan.spo2}%`,
      rawValue: scan.spo2,
      maxValue: 100,
      status: getStatusForMetric('spo2', scan.spo2),
      note: 'Rear camera PPG + flash (normal 95%+)',
      icon: 'psychology',
      citation: 'Nitzan et al. 2020 — plus/minus 2% accuracy',
    },
    {
      label: 'Respiratory Rate',
      value: `${scan.respiratoryRate} br/min`,
      rawValue: scan.respiratoryRate,
      maxValue: 40,
      status: getStatusForMetric('respiratoryRate', scan.respiratoryRate),
      note: 'PPG waveform analysis (normal 12-20 br/min)',
      icon: 'self-improvement',
      citation: 'Islam et al. 2022 — plus/minus 1.8 br/min MAE',
    },
    {
      label: "Tremor Risk (Parkinson's)",
      value: `${scan.tremorRisk}%`,
      rawValue: scan.tremorRisk,
      maxValue: 100,
      status: getStatusForMetric('tremorRisk', scan.tremorRisk),
      note: 'Resting tremor via accelerometer',
      icon: 'vibration',
      citation: 'He et al. 2024 — AUC 0.89',
    },
    {
      label: 'Eye Conditions',
      value: `${scan.eyeConditions} condition${scan.eyeConditions !== 1 ? 's' : ''}`,
      rawValue: scan.eyeConditions,
      maxValue: 7,
      status: getStatusForMetric('eyeConditions', scan.eyeConditions),
      note: 'Front camera retinal analysis (7 conditions screened)',
      icon: 'remove-red-eye',
      citation: 'Jin et al. 2024 — AUC 0.91-0.97',
    },
  ];

  const overallStatus: Status = scan.hasRedAlert
    ? 'red'
    : metrics.some((m) => m.status === 'yellow')
    ? 'yellow'
    : 'green';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <QRModal scan={scan} visible={qrVisible} onClose={() => setQrVisible(false)} />

      {/* Navigation bar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backIconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.navTitle}>Clinical Report</Text>
        <Pressable style={styles.exportIconBtn} onPress={() => exportReport(scan)}>
          <MaterialIcons name="share" size={20} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient header card */}
        <View style={[styles.patientCard, { borderColor: statusColor(overallStatus) + '55' }]}>
          <Pressable
            style={[styles.avatar, { backgroundColor: statusColor(overallStatus) + '22', borderColor: statusColor(overallStatus) + '55', overflow: 'hidden' }]}
            onPress={() => router.push({ pathname: '/patient-photo', params: { patientId: scan.patientId, patientName: scan.patientName } })}
          >
            {patientPhotoUri ? (
              <Image source={{ uri: patientPhotoUri }} style={{ width: 64, height: 64 }} contentFit="cover" />
            ) : (
              <MaterialIcons name="add-a-photo" size={30} color={statusColor(overallStatus)} />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{scan.patientName}</Text>
            <Text style={styles.patientId}>{scan.patientId}</Text>
            <View style={styles.metaRow}>
              <MaterialIcons name="access-time" size={12} color={theme.textMuted} />
              <Text style={styles.metaText}>{new Date(scan.scanTimestamp).toLocaleString()}</Text>
            </View>
          </View>
          <View style={[styles.overallBadge, { backgroundColor: statusBg(overallStatus), borderColor: statusColor(overallStatus) + '66' }]}>
            <MaterialIcons
              name={overallStatus === 'red' ? 'warning' : overallStatus === 'yellow' ? 'info' : 'check-circle'}
              size={22}
              color={statusColor(overallStatus)}
            />
            <Text style={[styles.overallBadgeText, { color: statusColor(overallStatus) }]}>
              {overallStatus === 'red' ? 'REFERRAL\nREQUIRED' : overallStatus === 'yellow' ? 'WATCH' : 'NORMAL'}
            </Text>
          </View>
        </View>

        {/* Clinical action */}
        <View style={[styles.actionBanner, { backgroundColor: statusBg(overallStatus), borderColor: statusColor(overallStatus) + '55' }]}>
          <MaterialIcons
            name={overallStatus === 'red' ? 'local-hospital' : 'check-circle'}
            size={24}
            color={statusColor(overallStatus)}
          />
          <Text style={[styles.actionText, { color: statusColor(overallStatus) }]}>
            {overallStatus === 'red'
              ? 'CLINICAL ACTION: Escort patient to nearest health facility immediately.'
              : overallStatus === 'yellow'
              ? 'CLINICAL ACTION: Monitor closely. Schedule follow-up within 48 hours.'
              : 'CLINICAL ACTION: All metrics normal. Routine follow-up in 30 days.'}
          </Text>
        </View>

        {/* Consent record */}
        <View style={styles.consentBox}>
          <MaterialIcons name="mic" size={14} color={theme.statusGreen} />
          <Text style={styles.consentText}>
            Oral consent · {new Date(scan.consentTimestamp).toLocaleString()}
          </Text>
          {scan.synced ? (
            <MaterialIcons name="cloud-done" size={14} color={theme.statusGreen} />
          ) : (
            <MaterialIcons name="cloud-queue" size={14} color={theme.statusYellow} />
          )}
          <Text style={[styles.consentText, { color: scan.synced ? theme.statusGreen : theme.statusYellow }]}>
            {scan.synced ? 'Synced' : 'Pending sync'}
          </Text>
        </View>

        {/* Bypass warning */}
        {scan.bypassLogged && (
          <View style={styles.bypassWarning}>
            <MaterialIcons name="warning" size={16} color={theme.statusRed} />
            <Text style={styles.bypassWarningText}>
              Safety bypass was logged for this patient. Supervisor was alerted.
              {scan.bypassReason ? ` Reason: ${scan.bypassReason}` : ''}
            </Text>
          </View>
        )}

        {/* Metrics */}
        <Text style={styles.sectionTitle}>DIAGNOSTIC METRICS</Text>
        {metrics.map((m) => (
          <MetricBar key={m.label} {...m} />
        ))}

        {/* Scan summary */}
        <Text style={styles.sectionTitle}>SCAN SUMMARY</Text>
        <View style={styles.summaryGrid}>
          {[
            { label: 'RED', count: metrics.filter((m) => m.status === 'red').length, color: theme.statusRed },
            { label: 'YELLOW', count: metrics.filter((m) => m.status === 'yellow').length, color: theme.statusYellow },
            { label: 'GREEN', count: metrics.filter((m) => m.status === 'green').length, color: theme.statusGreen },
          ].map((s) => (
            <View key={s.label} style={[styles.summaryCell, { borderColor: s.color + '55', backgroundColor: s.color + '15' }]}>
              <Text style={[styles.summaryCellNum, { color: s.color }]}>{s.count}</Text>
              <Text style={[styles.summaryCellLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <Pressable
          style={({ pressed }) => [styles.fhirBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/fhir-viewer', params: { scanId: scan.id } })}
        >
          <MaterialIcons name="code" size={18} color={theme.primary} />
          <Text style={styles.fhirBtnText}>View FHIR R4 Record</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.primary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.qrBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setQrVisible(true)}
        >
          <MaterialIcons name="qr-code" size={18} color="#A78BFA" />
          <Text style={styles.qrBtnText}>Generate QR Patient Badge</Text>
          <MaterialIcons name="chevron-right" size={18} color="#A78BFA" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.trendBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/vital-trends', params: { patientId: scan.patientId } })}
        >
          <MaterialIcons name="show-chart" size={18} color={theme.statusGreen} />
          <Text style={styles.trendBtnText}>View Vital Trends</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.statusGreen} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.scheduleBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/schedule', params: { patientId: scan.patientId, patientName: scan.patientName } })}
        >
          <MaterialIcons name="event" size={18} color={theme.statusYellow} />
          <Text style={styles.scheduleBtnText}>Schedule Follow-up</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.statusYellow} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/patient-photo', params: { patientId: scan.patientId, patientName: scan.patientName } })}
        >
          <MaterialIcons name="camera-alt" size={18} color={theme.primary} />
          <Text style={styles.photoBtnText}>{patientPhotoUri ? 'Update Patient Photo' : 'Add Patient Photo'}</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.primary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.referralBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            const redMetrics = metrics.filter((m) => m.status === 'red').map((m) => `${m.label} ${m.value}`);
            router.push({
              pathname: '/referrals',
              params: {
                patientId: scan.patientId,
                patientName: scan.patientName,
                scanId: scan.id,
                metrics: redMetrics.join('|'),
              },
            });
          }}
        >
          <MaterialIcons name="send" size={18} color={theme.statusRed} />
          <Text style={styles.referralBtnText}>Log Referral</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.statusRed} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.labBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/lab-results', params: { patientId: scan.patientId, patientName: scan.patientName } })}
        >
          <MaterialIcons name="science" size={18} color="#60A5FA" />
          <Text style={styles.labBtnText}>Log Lab Result</Text>
          <MaterialIcons name="chevron-right" size={18} color="#60A5FA" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.notesBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/patient-notes', params: { patientId: scan.patientId, patientName: scan.patientName } })}
        >
          <MaterialIcons name="notes" size={18} color="#10B981" />
          <Text style={styles.notesBtnText}>Clinical Notes</Text>
          <MaterialIcons name="chevron-right" size={18} color="#10B981" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.8 }]}
          onPress={() => exportReport(scan)}
        >
          <MaterialIcons name="picture-as-pdf" size={20} color="#FFF" />
          <Text style={styles.exportBtnText}>Export PDF Clinical Report</Text>
        </Pressable>

        <Text style={styles.footerNote}>
          Generated on-device · AES-256 encrypted · FHIR R4 compliant · MediAid v1.0 prototype
        </Text>
      </ScrollView>
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
    gap: 8,
  },
  backIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  exportIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B3B18',
    borderWidth: 1,
    borderColor: '#FF3B3B44',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyText: { fontSize: 16, color: theme.textSecondary, textAlign: 'center' },
  backBtn: {
    backgroundColor: theme.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.large,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  patientName: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  patientId: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { fontSize: 11, color: theme.textMuted },
  overallBadge: {
    alignItems: 'center',
    borderRadius: theme.radius.medium,
    padding: 10,
    borderWidth: 1,
    gap: 4,
    minWidth: 72,
  },
  overallBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  actionText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 20 },
  consentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    flexWrap: 'wrap',
  },
  consentText: { fontSize: 11, color: theme.statusGreen, fontWeight: '500' },
  bypassWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.statusRedBg,
    borderRadius: theme.radius.medium,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.statusRed + '55',
  },
  bypassWarningText: { flex: 1, fontSize: 12, color: theme.statusRed, lineHeight: 18 },
  sectionTitle: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 16,
  },
  metricCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metricLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  metricCitation: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  statusChip: { borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  progressTrack: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 6, borderRadius: 3 },
  metricNote: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCell: {
    flex: 1,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  summaryCellNum: { fontSize: 28, fontWeight: '800' },
  summaryCellLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  fhirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary + '18',
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.primary + '44',
  },
  fhirBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.primary },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#A78BFA18',
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A78BFA44',
  },
  qrBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#A78BFA' },
  trendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.statusGreenBg,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.statusGreen + '44',
  },
  trendBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.statusGreen },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.statusYellowBg,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.statusYellow + '44',
  },
  scheduleBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.statusYellow },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    borderRadius: theme.radius.medium,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  exportBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  footerNote: { fontSize: 11, color: theme.textMuted, textAlign: 'center', lineHeight: 18 },
  notesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B98118',
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#10B98144',
  },
  notesBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#10B981' },
  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.statusRedBg,
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.statusRed + '44',
  },
  referralBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.statusRed },
  labBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#60A5FA18',
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#60A5FA44',
  },
  labBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#60A5FA' },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary + '18',
    borderRadius: theme.radius.medium,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.primary + '44',
  },
  photoBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.primary },
});
