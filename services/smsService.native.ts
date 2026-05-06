// Native SMS service — expo-sms (iOS/Android only)
import * as SMS from 'expo-sms';

export async function isAvailableAsync(): Promise<boolean> {
  return SMS.isAvailableAsync();
}

export async function sendSMSAsync(
  addresses: string[],
  body: string
): Promise<{ result: 'sent' | 'cancelled' | 'unknown' }> {
  return SMS.sendSMSAsync(addresses, body);
}
