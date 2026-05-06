// Powered by OnSpace.AI
import { AppProvider } from '@/contexts/AppContext';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function RootNavigator() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initial boot: check onboarding, then check PIN lock
    const init = async () => {
      const done = await AsyncStorage.getItem('onboarding_done');
      if (!done) {
        setTimeout(() => router.replace('/onboarding'), 100);
        setChecked(true);
        return;
      }
      const lockEnabled = await AsyncStorage.getItem('mediaid_app_lock_enabled');
      if (lockEnabled === '1') {
        setTimeout(() => router.replace('/pin-lock'), 100);
      }
      setChecked(true);
    };
    init();
  }, []);

  useEffect(() => {
    // Re-lock when app goes to background for >30 seconds
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev === 'active' && nextState === 'background') {
        // Start 30-second lock timer
        lockTimerRef.current = setTimeout(async () => {
          const lockEnabled = await AsyncStorage.getItem('mediaid_app_lock_enabled');
          if (lockEnabled === '1') {
            router.replace('/pin-lock');
          }
        }, 30000);
      } else if (nextState === 'active') {
        // App returned to foreground — cancel timer
        if (lockTimerRef.current) {
          clearTimeout(lockTimerRef.current);
          lockTimerRef.current = null;
        }
      }
    });
    return () => {
      subscription.remove();
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="safety"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="scan-workflow"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="patient-detail"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="supervisor"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="fhir-viewer"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="patient-queue"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="training-quiz"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="alert-log"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="sms-escalation"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="vital-trends"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="schedule"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="ai-advisor"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="formulary"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="daily-report"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="pin-lock"
        options={{
          animation: 'fade',
          presentation: 'fullScreenModal',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="patient-photo"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="symptom-checker"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="village-dashboard"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="health-education"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="referrals"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="lab-results"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="impact-dashboard"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="emergency-directory"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="patient-notes"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="analytics"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="cha-profile"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="treatment-protocols"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="risk-calculator"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="llm-validation"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="biometric-identity"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="cha-professionalization"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="self-healing-ai"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
