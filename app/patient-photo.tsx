// MediAid — Patient Photo Capture
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

const PHOTO_STORAGE_PREFIX = 'mediaid_patient_photo_';

export const getPatientPhotoUri = async (patientId: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(PHOTO_STORAGE_PREFIX + patientId);
  } catch {
    return null;
  }
};

export default function PatientPhotoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="camera-alt" size={64} color={theme.primary} />
          <Text style={styles.permTitle}>Camera Permission Needed</Text>
          <Text style={styles.permSub}>
            To capture patient identity photos for clinical records, MediAid needs camera access.
          </Text>
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: false,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
      }
    } catch {
      Alert.alert('Capture Error', 'Could not take photo. Please try again.');
    }
    setCapturing(false);
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!photoUri || !patientId) return;
    try {
      await AsyncStorage.setItem(PHOTO_STORAGE_PREFIX + patientId, photoUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => router.back(), 1200);
    } catch {
      Alert.alert('Save Error', 'Could not save photo. Please try again.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Patient Photo</Text>
          <Text style={styles.navSub}>{patientName} · {patientId}</Text>
        </View>
        <View style={styles.privacyBadge}>
          <MaterialIcons name="lock" size={12} color={theme.statusGreen} />
          <Text style={styles.privacyBadgeText}>On-Device Only</Text>
        </View>
      </View>

      {/* Camera or Preview */}
      {photoUri ? (
        /* Photo preview */
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            contentFit="cover"
          />
          <View style={styles.previewOverlay}>
            <View style={styles.patientBadgeOverlay}>
              <MaterialIcons name="person" size={16} color="#FFF" />
              <Text style={styles.patientBadgeText}>{patientName}</Text>
            </View>
            <View style={styles.idBadgeOverlay}>
              <Text style={styles.idBadgeText}>{patientId}</Text>
            </View>
          </View>
        </View>
      ) : (
        /* Live camera */
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          >
            {/* Face guide overlay */}
            <View style={styles.faceGuide}>
              <View style={styles.faceOval} />
              <Text style={styles.faceGuideText}>Center patient's face</Text>
            </View>

            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </CameraView>
        </View>
      )}

      {/* Info card */}
      <View style={styles.infoCard}>
        <MaterialIcons name="info-outline" size={14} color={theme.primary} />
        <Text style={styles.infoText}>
          Photos are stored on-device only. Never transmitted. Used for identity verification during follow-up visits.
        </Text>
      </View>

      {/* Controls */}
      {photoUri ? (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.retakeBtn, pressed && { opacity: 0.8 }]}
            onPress={handleRetake}
          >
            <MaterialIcons name="refresh" size={20} color={theme.textSecondary} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              saved && { backgroundColor: theme.statusGreen },
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleSave}
            disabled={saved}
          >
            <MaterialIcons name={saved ? 'check-circle' : 'save'} size={22} color="#FFF" />
            <Text style={styles.saveBtnText}>
              {saved ? 'Saved to Record' : 'Save to Patient Record'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.captureBtn, capturing && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
            onPress={handleCapture}
            disabled={capturing}
          >
            <View style={styles.captureInner}>
              <MaterialIcons name="camera-alt" size={32} color="#FFF" />
            </View>
          </Pressable>
          <Text style={styles.captureHint}>
            {capturing ? 'Capturing...' : 'Tap to capture identity photo'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#000', gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  navSub: { fontSize: 11, color: '#999', marginTop: 1 },
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.statusGreen + '22', borderRadius: theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: theme.statusGreen + '44',
  },
  privacyBadgeText: { fontSize: 10, fontWeight: '700', color: theme.statusGreen },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  faceGuide: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  faceOval: {
    width: 200, height: 240, borderRadius: 100,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    borderStyle: 'dashed',
  },
  faceGuideText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: theme.primary, borderWidth: 3,
  },
  cornerTL: { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0 },
  previewContainer: { flex: 1, position: 'relative' },
  preview: { flex: 1 },
  previewOverlay: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    gap: 8,
  },
  patientBadgeOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: theme.radius.full,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  patientBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  idBadgeOverlay: {
    backgroundColor: theme.primary + 'CC', borderRadius: theme.radius.full,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  idBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#0D1A22', padding: 12,
    borderTopWidth: 1, borderTopColor: '#222',
  },
  infoText: { flex: 1, fontSize: 11, color: '#888', lineHeight: 16 },
  controls: {
    backgroundColor: '#0A0A0A', padding: 20,
    alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: '#222',
  },
  captureBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: theme.primary, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
  },
  captureInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  captureHint: { fontSize: 12, color: '#888' },
  retakeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A1A1A', borderRadius: theme.radius.medium,
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1, borderColor: '#333', width: '100%', justifyContent: 'center',
  },
  retakeBtnText: { fontSize: 14, fontWeight: '600', color: '#CCC' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, borderRadius: theme.radius.medium,
    paddingVertical: 16, width: '100%',
    shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: theme.background },
  permTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  permSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: theme.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  permBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  cancelBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: theme.radius.full, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
});
