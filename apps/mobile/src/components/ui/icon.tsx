import {
  Ban,
  Bell,
  CalendarDays,
  Camera,
  Car,
  Cat,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Dog,
  Droplet,
  Footprints,
  Heart,
  House,
  ListChecks,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  PawPrint,
  Phone,
  Pill,
  Plus,
  Search,
  Settings,
  Sun,
  Timer,
  TriangleAlert,
  Undo2,
  User,
  Utensils,
  X,
} from 'lucide-react-native';

import { useTheme, type Colors } from '@/theme';

// The one icon set (lucide). Screens use these names, never lucide directly, so
// the set stays consistent and is easy to swap.
const ICONS = {
  alert: TriangleAlert,
  ban: Ban,
  bell: Bell,
  calendar: CalendarDays,
  camera: Camera,
  car: Car,
  cat: Cat,
  check: CircleCheck,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chat: MessageCircle,
  clock: Clock,
  close: X,
  dog: Dog,
  done: Check,
  food: Utensils,
  heart: Heart,
  home: House,
  info: CircleAlert,
  list: ListChecks,
  logout: LogOut,
  mapPin: MapPin,
  meds: Pill,
  moon: Moon,
  paw: PawPrint,
  phone: Phone,
  plus: Plus,
  search: Search,
  settings: Settings,
  sun: Sun,
  timer: Timer,
  undo: Undo2,
  user: User,
  walk: Footprints,
  water: Droplet,
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  /** Token size or points. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** A theme color role. */
  color?: keyof Colors;
  /**
   * Icons are decorative by default (the button or text next to them carries the
   * meaning). Give a label only when the icon stands alone.
   */
  accessibilityLabel?: string;
};

export function Icon({ name, size = 'md', color = 'text', accessibilityLabel }: IconProps) {
  const theme = useTheme();
  const Component = ICONS[name];
  const points = typeof size === 'number' ? size : theme.size.icon[size];
  return (
    <Component
      size={points}
      color={theme.colors[color]}
      strokeWidth={2.2}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
