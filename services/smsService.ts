// Web fallback SMS service — expo-sms is not available on web
export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export async function sendSMSAsync(
  _addresses: string[],
  _body: string
): Promise<{ result: 'sent' | 'cancelled' | 'unknown' }> {
  return { result: 'unknown' };
}
