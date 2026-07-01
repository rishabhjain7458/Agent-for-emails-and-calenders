import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const sessionTokenKey = 'sessionToken';

export async function getSessionToken() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await SecureStoragePlugin.get({ key: sessionTokenKey });
    return result.value || null;
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string) {
  if (!Capacitor.isNativePlatform()) return;
  await SecureStoragePlugin.set({ key: sessionTokenKey, value: token });
  localStorage.removeItem(sessionTokenKey);
}

export async function clearSessionToken() {
  localStorage.removeItem(sessionTokenKey);
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SecureStoragePlugin.remove({ key: sessionTokenKey });
  } catch {
    // Missing keys are fine; logout should be idempotent.
  }
}
