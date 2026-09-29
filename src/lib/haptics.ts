/**
 * Safe haptic feedback utility.
 * Uses the Vibration API where supported (most Android browsers).
 * Silently no-ops on unsupported platforms (iOS Safari, desktops).
 *
 * @param duration Vibration duration in milliseconds (default 40ms — a crisp tap).
 */
export function triggerHaptic(duration = 40): void {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration);
  }
}
