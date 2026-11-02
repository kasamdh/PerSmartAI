import { contrastRatio } from '@petsitter/shared/branding';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AllergyBanner,
  BigActionButton,
  BottomSheet,
  Button,
  Card,
  DatePicker,
  EmptyState,
  Icon,
  IconButton,
  ListItem,
  PetAvatar,
  PressableScale,
  SectionHeader,
  Select,
  Skeleton,
  SkeletonList,
  StatusChip,
  TabBar,
  Text,
  TextField,
  TimePicker,
  TimeWindowPicker,
  useToast,
  type TimeWindow,
} from '@/components/ui';
import { OwnerHomeView } from '@/features/owner/owner-home-view';
import { ThemeProvider, useTheme, type ColorScheme, type Colors, type TypeVariant } from '@/theme';

import { samplePets, sampleVisitGroups } from './sample-data';

// Dev-only: every token and component in light or dark, to review the look on a
// phone. Opened from the welcome and profile screens in development builds.

export function DesignPreviewScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  return (
    <ThemeProvider scheme={scheme}>
      <PreviewBody scheme={scheme} onScheme={setScheme} />
    </ThemeProvider>
  );
}

function PreviewBody({
  scheme,
  onScheme,
}: {
  scheme: ColorScheme;
  onScheme: (s: ColorScheme) => void;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.md,
          gap: theme.space.lg,
          paddingBottom: theme.space.xxl,
        }}
      >
        <View style={{ gap: theme.space.xs }}>
          <Text variant="display">Design system</Text>
          <Text variant="body" tone="muted">
            Calm Teal · system font. Switch modes below; try the phone&apos;s largest text size and
            Reduce Motion too.
          </Text>
          <Segmented
            value={scheme}
            onChange={onScheme}
            options={[
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ]}
          />
        </View>
        <ColorsSection />
        <TypeSection />
        <ShapeSection />
        <ButtonsSection />
        <CareSection />
        <StatusSection />
        <PetSection />
        <FormsSection />
        <ListsSection />
        <OverlaysSection />
        <StatesSection />
        <TabBarSection />
        <HomeSampleSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: 'sun' | 'moon' }[];
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.row,
        { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill, padding: 4 },
      ]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.label} mode`}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              {
                minHeight: theme.size.tap,
                borderRadius: theme.radius.pill,
                backgroundColor: on ? theme.colors.surface : 'transparent',
                gap: theme.space.xs,
              },
            ]}
          >
            <Icon name={o.icon} size="sm" color={on ? 'primaryInk' : 'textMuted'} />
            <Text variant="label" tone={on ? 'primary' : 'muted'}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const SWATCHES: { token: keyof Colors; on?: keyof Colors }[] = [
  { token: 'background', on: 'text' },
  { token: 'surface', on: 'text' },
  { token: 'surfaceMuted', on: 'textMuted' },
  { token: 'primary', on: 'onPrimary' },
  { token: 'primarySoft', on: 'primaryInk' },
  { token: 'accent' },
  { token: 'successSoft', on: 'success' },
  { token: 'warningSoft', on: 'warning' },
  { token: 'dangerSoft', on: 'danger' },
  { token: 'allergy', on: 'onAllergy' },
  { token: 'allergySoft', on: 'allergy' },
  { token: 'toast', on: 'onToast' },
];

function ColorsSection() {
  const theme = useTheme();
  return (
    <Section title="Colors">
      <View style={[styles.wrap, { gap: theme.space.xs }]}>
        {SWATCHES.map(({ token, on }) => (
          <View
            key={token}
            style={[
              styles.swatch,
              {
                backgroundColor: theme.colors[token],
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: theme.colors[on ?? 'text'] }}>
              {token}
            </Text>
            <Text variant="caption" style={{ color: theme.colors[on ?? 'text'] }}>
              {theme.colors[token]}
              {on ? ` · ${contrastRatio(theme.colors[on], theme.colors[token]).toFixed(1)}:1` : ''}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

const TYPE_STEPS: TypeVariant[] = [
  'display',
  'title',
  'heading',
  'subheading',
  'body',
  'bodyStrong',
  'callout',
  'caption',
  'label',
];

function TypeSection() {
  const theme = useTheme();
  return (
    <Section title="Typography">
      <Card>
        {TYPE_STEPS.map((step) => (
          <View key={step}>
            <Text variant="caption" tone="muted">
              {step} · {theme.type[step].fontSize}/{theme.type[step].lineHeight}
            </Text>
            <Text variant={step}>Max ate all his food</Text>
          </View>
        ))}
      </Card>
    </Section>
  );
}

function ShapeSection() {
  const theme = useTheme();
  return (
    <Section title="Spacing, corners, shadows">
      <Card>
        {Object.entries(theme.space).map(([name, value]) => (
          <View key={name} style={[styles.row, { gap: theme.space.sm }]}>
            <Text variant="caption" tone="muted" style={{ width: 64 }}>
              {name} {value}
            </Text>
            <View
              style={{
                width: value * 3,
                height: 12,
                borderRadius: 4,
                backgroundColor: theme.colors.primary,
              }}
            />
          </View>
        ))}
      </Card>
      <View style={[styles.wrap, { gap: theme.space.sm }]}>
        {([0, 1, 2, 3] as const).map((level) => (
          <View
            key={level}
            style={[
              styles.shadowBox,
              { backgroundColor: theme.colors.surface, borderRadius: theme.radius.card },
              theme.elevation(level),
            ]}
          >
            <Text variant="caption" tone="muted">
              Elevation {level}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function ButtonsSection() {
  const theme = useTheme();
  return (
    <Section title="Buttons">
      <View style={{ gap: theme.space.xs }}>
        <Button label="Book a visit" icon="plus" onPress={() => {}} />
        <Button label="Messages" variant="secondary" icon="chat" onPress={() => {}} />
        <Button label="Not now" variant="ghost" onPress={() => {}} />
        <Button label="Cancel booking" variant="danger" onPress={() => {}} />
        <Button label="Saving" loading onPress={() => {}} />
        <Button label="Disabled" disabled onPress={() => {}} />
        <View style={[styles.row, { gap: theme.space.sm }]}>
          <IconButton icon="chat" accessibilityLabel="Messages" badge={3} onPress={() => {}} />
          <IconButton icon="user" accessibilityLabel="My profile" onPress={() => {}} />
          <IconButton icon="phone" accessibilityLabel="Call" tone="primary" onPress={() => {}} />
        </View>
      </View>
    </Section>
  );
}

function CareSection() {
  const theme = useTheme();
  const toast = useToast();
  const [fed, setFed] = useState(false);
  const [walking, setWalking] = useState(false);
  return (
    <Section title="Sitter care buttons">
      <AllergyBanner allergies={samplePets[0].pet_allergies} variant="compact" />
      <View style={[styles.row, { gap: theme.space.xs }]}>
        <BigActionButton
          label="Fed"
          icon="food"
          active={fed}
          detail={fed ? 'All' : undefined}
          accessibilityLabel={fed ? 'Fed Max, ate all' : 'Log that Max ate'}
          onPress={() => {
            setFed(true);
            toast.show({
              message: 'Max ate all his food',
              actionLabel: 'Undo',
              onAction: () => setFed(false),
            });
          }}
        />
        <BigActionButton
          label="Water"
          icon="water"
          onPress={() => toast.show({ message: 'Fresh water for Max' })}
        />
      </View>
      <View style={[styles.row, { gap: theme.space.xs }]}>
        <BigActionButton
          label={walking ? 'Stop walk' : 'Start walk'}
          icon="walk"
          active={walking}
          detail={walking ? '12 min' : undefined}
          onPress={() => setWalking((w) => !w)}
        />
        <BigActionButton label="Photo" icon="camera" onPress={() => {}} />
      </View>
    </Section>
  );
}

function StatusSection() {
  const theme = useTheme();
  return (
    <Section title="Status chips">
      <View style={[styles.wrap, { gap: theme.space.xs }]}>
        {(
          [
            'scheduled',
            'on_the_way',
            'arrived',
            'in_progress',
            'completed',
            'missed',
            'cancelled',
          ] as const
        ).map((s) => (
          <StatusChip key={s} status={s} />
        ))}
        <StatusChip status="scheduled" label="Late · 12 min" />
      </View>
    </Section>
  );
}

function PetSection() {
  const theme = useTheme();
  return (
    <Section title="Pets and allergies">
      <View style={[styles.row, { gap: theme.space.md }]}>
        <PetAvatar name="Max" species="dog" size="lg" />
        <PetAvatar name="Luna" species="cat" size="md" />
        <PetAvatar name="Pip" size="sm" />
      </View>
      <AllergyBanner allergies={samplePets[0].pet_allergies} />
    </Section>
  );
}

function FormsSection() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [length, setLength] = useState<'30' | '45' | '60'>('30');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [window, setWindow] = useState<TimeWindow>({ start: '11:00', end: '14:00' });
  return (
    <Section title="Forms">
      <View style={{ gap: theme.space.md }}>
        <TextField
          label="Pet's name"
          value={name}
          onChangeText={setName}
          hint="As your sitter will call them"
        />
        <TextField
          label="Email"
          value="ana@"
          error="Enter an email like ana@example.com"
          onChangeText={() => {}}
        />
        <Select
          label="Visit length"
          value={length}
          onChange={setLength}
          options={[
            { value: '30', label: '30 minutes', description: 'A quick check-in' },
            { value: '45', label: '45 minutes' },
            { value: '60', label: '1 hour', description: 'Time for a longer walk' },
          ]}
        />
        <DatePicker label="First day" value={date} onChange={setDate} />
        <TimePicker label="Time" value={time} onChange={setTime} />
        <TimeWindowPicker
          label="When should the sitter arrive?"
          value={window}
          onChange={setWindow}
        />
      </View>
    </Section>
  );
}

function ListsSection() {
  const toast = useToast();
  return (
    <Section title="Cards and lists">
      <SectionHeader title="Coming up" action={{ label: 'All bookings', onPress: () => {} }} />
      <Card padding="sm" style={{ paddingHorizontal: 0, overflow: 'hidden' }}>
        <ListItem
          title="Walk · Max"
          subtitle="Tomorrow, 12:00 – 12:30 PM · Monika"
          leading={<PetAvatar name="Max" species="dog" size="sm" />}
          trailing={<StatusChip status="scheduled" />}
          onPress={() => {}}
          swipeActions={[
            {
              label: 'Cancel visit',
              icon: 'close',
              tone: 'danger',
              onPress: () => toast.show({ message: 'Visit cancelled', actionLabel: 'Undo' }),
            },
          ]}
        />
        <ListItem
          title="Home & emergency contacts"
          subtitle="Entry, Wi-Fi, who to call"
          leading={<Icon name="home" color="primaryInk" />}
          trailing="chevron"
          onPress={() => {}}
        />
      </Card>
      <Text variant="caption" tone="muted">
        Swipe the walk left for its action.
      </Text>
    </Section>
  );
}

function OverlaysSection() {
  const theme = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <Section title="Sheets and toasts">
      <View style={{ gap: theme.space.xs }}>
        <Button label="Open a bottom sheet" variant="secondary" onPress={() => setOpen(true)} />
        <Button
          label="Show a toast with Undo"
          variant="secondary"
          onPress={() => toast.show({ message: 'Max ate all his food', actionLabel: 'Undo' })}
        />
      </View>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="How much did Max eat?"
        footer={<Button label="Done" onPress={() => setOpen(false)} />}
      >
        <Text variant="body" tone="muted">
          Swipe down, tap outside, or press Close to dismiss.
        </Text>
      </BottomSheet>
    </Section>
  );
}

function StatesSection() {
  const theme = useTheme();
  return (
    <Section title="Loading and empty">
      <SkeletonList rows={2} />
      <View style={{ gap: theme.space.xs }}>
        <Skeleton width="70%" height={20} />
        <Skeleton width="45%" />
      </View>
      <Card>
        <EmptyState
          icon="calendar"
          title="No visits booked yet"
          body="When you book a visit, it shows up here."
          action={{ label: 'Book a visit', onPress: () => {} }}
        />
      </Card>
    </Section>
  );
}

function TabBarSection() {
  const [index, setIndex] = useState(0);
  const routes = [
    { key: 'today', name: 'today', title: 'Today' },
    { key: 'week', name: 'week', title: 'Week' },
    { key: 'hours', name: 'hours', title: 'Hours' },
    { key: 'off', name: 'off', title: 'Time off' },
    { key: 'messages', name: 'messages', title: 'Messages', badge: 2 },
  ];
  return (
    <Section title="Tab bar">
      <TabBar
        state={{ index, routes }}
        descriptors={
          Object.fromEntries(
            routes.map((r) => [r.key, { options: { title: r.title, tabBarBadge: r.badge } }]),
          ) as never
        }
        navigateToTab={(key) => setIndex(routes.findIndex((r) => r.key === key))}
        emitter={{} as never}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
        icons={{ today: 'home', week: 'calendar', hours: 'clock', off: 'sun', messages: 'chat' }}
      />
    </Section>
  );
}

function HomeSampleSection() {
  const theme = useTheme();
  return (
    <Section title="Sample: owner home">
      <View
        style={{
          height: 760,
          borderRadius: theme.radius.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <OwnerHomeView
          firstName="Rudra"
          business={{ name: 'Happy Paws Pet Care', logoUrl: null }}
          visits={{ state: 'ready', data: sampleVisitGroups }}
          pets={{ state: 'ready', data: samplePets }}
          unreadMessages={2}
          now={new Date()}
          refreshing={false}
          onRefresh={() => {}}
          renderPetAvatar={(pet) => <PetAvatar name={pet.name} species={pet.species} />}
          onOpenVisit={() => {}}
          onOpenPet={() => {}}
          onAddPet={() => {}}
          onBook={() => {}}
          onAllBookings={() => {}}
          onMessages={() => {}}
          onProfile={() => {}}
          onHousehold={() => {}}
          onNotifications={() => {}}
          onSignOut={() => {}}
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  swatch: {
    width: '48%',
    minHeight: 64,
    padding: 10,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  shadowBox: { width: 140, height: 72, alignItems: 'center', justifyContent: 'center' },
});
