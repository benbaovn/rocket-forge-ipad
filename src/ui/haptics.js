// Native iPadOS / iOS Haptics & StatusBar integration via Capacitor
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar } from '@capacitor/status-bar';

export const IS_NATIVE_IOS = Capacitor.isNativePlatform && Capacitor.isNativePlatform();

let lastHapticMs = 0;

export async function initNativePadShell() {
  if (!IS_NATIVE_IOS) return;
  try {
    await StatusBar.hide();
  } catch { /* ignore on unsupported targets */ }
}

export const haptics = {
  light() {
    if (!IS_NATIVE_IOS) return;
    const now = performance.now();
    if (now - lastHapticMs < 28) return;
    lastHapticMs = now;
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  medium() {
    if (!IS_NATIVE_IOS) return;
    const now = performance.now();
    if (now - lastHapticMs < 40) return;
    lastHapticMs = now;
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  heavy() {
    if (!IS_NATIVE_IOS) return;
    lastHapticMs = performance.now();
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  },
  success() {
    if (!IS_NATIVE_IOS) return;
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
  error() {
    if (!IS_NATIVE_IOS) return;
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  },
};
