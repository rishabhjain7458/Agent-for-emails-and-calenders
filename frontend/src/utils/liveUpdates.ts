import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export async function initializeLiveUpdates() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await CapacitorUpdater.notifyAppReady();
    await CapacitorUpdater.triggerUpdateCheck();
  } catch (error) {
    console.warn('Live update readiness check failed.', error);
  }
}
