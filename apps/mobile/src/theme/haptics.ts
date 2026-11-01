// Haptic feedback, in one place. Components call these on care taps, check-in,
// check-out and success. expo-haptics isn't installed yet (not approved), so they
// do nothing for now; to turn haptics on, install it and implement these three:
//   tap     -> Haptics.impactAsync(ImpactFeedbackStyle.Light)
//   success -> Haptics.notificationAsync(NotificationFeedbackType.Success)
//   warning -> Haptics.notificationAsync(NotificationFeedbackType.Warning)

export const haptics = {
  /** A care tap or a press that changes something. */
  tap(): void {},
  /** Check-in, check-out, a booking sent. */
  success(): void {},
  /** Something needs attention (late, blocked). */
  warning(): void {},
};
