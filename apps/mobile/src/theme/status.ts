import type { Colors } from './colors';

// How each visit status looks: color + icon + words, so status never relies on
// color alone (color-blind people and screen readers get the same information).

export type VisitStatus =
  'scheduled' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'missed' | 'cancelled';

export type StatusIcon = 'clock' | 'car' | 'mapPin' | 'paw' | 'check' | 'alert' | 'ban';

export type StatusLook = {
  label: string;
  icon: StatusIcon;
  /** Background and text/icon color tokens. */
  background: keyof Colors;
  foreground: keyof Colors;
};

export const STATUS_LOOK: Record<VisitStatus, StatusLook> = {
  scheduled: {
    label: 'Scheduled',
    icon: 'clock',
    background: 'surfaceMuted',
    foreground: 'textMuted',
  },
  on_the_way: {
    label: 'On the way',
    icon: 'car',
    background: 'primarySoft',
    foreground: 'primaryInk',
  },
  arrived: {
    label: 'Arrived',
    icon: 'mapPin',
    background: 'primarySoft',
    foreground: 'primaryInk',
  },
  in_progress: {
    label: 'In progress',
    icon: 'paw',
    background: 'primarySoft',
    foreground: 'primaryInk',
  },
  completed: {
    label: 'Completed',
    icon: 'check',
    background: 'successSoft',
    foreground: 'success',
  },
  missed: { label: 'Missed', icon: 'alert', background: 'dangerSoft', foreground: 'danger' },
  cancelled: {
    label: 'Cancelled',
    icon: 'ban',
    background: 'surfaceMuted',
    foreground: 'textMuted',
  },
};
