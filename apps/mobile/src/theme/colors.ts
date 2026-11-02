// Color tokens: Calm Teal, in light and dark. The only place colors are defined;
// screens and components read them through useTheme(). Every text/background pair
// meets WCAG AA (4.5:1), checked in __tests__/theme.test.ts.

export type ColorScheme = 'light' | 'dark';

export type Colors = {
  /** Screen background (warm off-white / deep green-black). */
  background: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** A second level on top of surface (pressed rows, chips). */
  surfaceMuted: string;
  border: string;
  /** Main text. */
  text: string;
  /** Secondary text (captions, hints). Still AA on background and surface. */
  textMuted: string;
  /** Text on dark/primary fills. */
  textInverse: string;

  primary: string;
  onPrimary: string;
  /** Tinted background for selected and soft buttons. */
  primarySoft: string;
  /** Primary as text or icon on background, surface and primarySoft. */
  primaryInk: string;
  /** Warm accent for small highlights (never body text). */
  accent: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  /** Allergies only: never reused for anything else, so it always means "allergy". */
  allergy: string;
  onAllergy: string;
  allergySoft: string;

  /** Toast / snackbar. */
  toast: string;
  onToast: string;
  toastAction: string;
  /** Backdrop behind sheets. */
  overlay: string;
  /** Shadow color (alpha baked in). */
  shadow: string;
  /** Skeleton placeholder. */
  skeleton: string;
};

export const lightColors: Colors = {
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EFEB',
  border: '#E6E2DC',
  text: '#1F2421',
  textMuted: '#5C6662',
  textInverse: '#FFFFFF',

  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  primarySoft: '#E3F2EF',
  primaryInk: '#0B5F58',
  accent: '#E8913A',

  success: '#1E7B4A',
  successSoft: '#E4F4EA',
  warning: '#8F5400',
  warningSoft: '#FDF1DE',
  danger: '#B42318',
  dangerSoft: '#FCEBE9',
  onDanger: '#FFFFFF',
  allergy: '#C8102E',
  onAllergy: '#FFFFFF',
  allergySoft: '#FDECEE',

  toast: '#1F2421',
  onToast: '#F2F4F3',
  toastAction: '#7EE3D6',
  overlay: 'rgba(16, 20, 18, 0.45)',
  shadow: 'rgba(31, 36, 33, 0.10)',
  skeleton: '#ECE9E4',
};

export const darkColors: Colors = {
  background: '#121715',
  surface: '#1B2220',
  surfaceMuted: '#242C2A',
  border: '#2E3835',
  text: '#F2F4F3',
  textMuted: '#A9B4B0',
  textInverse: '#121715',

  primary: '#4FD1C1',
  onPrimary: '#0B1F1C',
  primarySoft: '#173532',
  primaryInk: '#7EE3D6',
  accent: '#F2A65A',

  success: '#5DD39A',
  successSoft: '#16302A',
  warning: '#F2B85B',
  warningSoft: '#33281A',
  danger: '#FF8A80',
  dangerSoft: '#3A1A18',
  onDanger: '#1A0806',
  allergy: '#FF5A6E',
  onAllergy: '#1A0508',
  allergySoft: '#3A1218',

  toast: '#F2F4F3',
  onToast: '#1F2421',
  toastAction: '#0B5F58',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: 'rgba(0, 0, 0, 0.35)',
  skeleton: '#26302D',
};

/** Pairs that must meet WCAG AA, as [foreground, background, minimum]. Used by tests. */
export const CONTRAST_PAIRS: [keyof Colors, keyof Colors, number][] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surfaceMuted', 4.5],
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['primaryInk', 'surface', 4.5],
  ['primaryInk', 'background', 4.5],
  ['primaryInk', 'primarySoft', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'successSoft', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'warningSoft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'dangerSoft', 4.5],
  ['onDanger', 'danger', 4.5],
  ['onAllergy', 'allergy', 4.5],
  ['allergy', 'allergySoft', 4.5],
  ['allergy', 'surface', 4.5],
  ['onToast', 'toast', 4.5],
  ['toastAction', 'toast', 4.5],
  ['textMuted', 'surfaceMuted', 4.5],
  // Borders and icons only need 3:1 against what they sit on.
  ['primary', 'surface', 3],
];
