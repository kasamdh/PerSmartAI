import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';

import { monthGrid } from '../calendar';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type MonthCalendarProps = {
  year: number;
  /** 1–12 */
  month: number;
  /** "YYYY-MM-DD" */
  selected: string;
  today: string;
  /** Visits per date, shown as a count under the day number. */
  counts: ReadonlyMap<string, number>;
  onSelect: (date: string) => void;
  onChangeMonth: (delta: -1 | 1) => void;
};

/** A Monday-first month grid with visit counts; days are large tap targets. */
export function MonthCalendar({
  year,
  month,
  selected,
  today,
  counts,
  onSelect,
  onChangeMonth,
}: MonthCalendarProps) {
  const weeks = monthGrid(year, month);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BigButton
          label="‹"
          variant="secondary"
          accessibilityLabel="Previous month"
          onPress={() => onChangeMonth(-1)}
          style={styles.navButton}
        />
        <Text style={styles.title} accessibilityRole="header">
          {MONTHS[month - 1]} {year}
        </Text>
        <BigButton
          label="›"
          variant="secondary"
          accessibilityLabel="Next month"
          onPress={() => onChangeMonth(1)}
          style={styles.navButton}
        />
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].date} style={styles.row}>
          {week.map(({ date, inMonth }) => {
            const count = counts.get(date) ?? 0;
            const isSelected = date === selected;
            const day = Number(date.slice(8));
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${MONTHS[Number(date.slice(5, 7)) - 1]} ${day}${
                  count ? `, ${count} visit${count === 1 ? '' : 's'}` : ''
                }`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(date)}
                style={({ pressed }) => [
                  styles.day,
                  isSelected && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    !inMonth && styles.outside,
                    date === today && styles.today,
                    isSelected && styles.selectedText,
                  ]}
                >
                  {day}
                </Text>
                {count > 0 ? (
                  <Text style={[styles.count, isSelected && styles.selectedText]}>
                    {count > 9 ? '9+' : `●${count > 1 ? count : ''}`}
                  </Text>
                ) : (
                  <Text style={styles.count}> </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 8, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  navButton: { minWidth: 56, paddingHorizontal: 0 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, color: '#666666', paddingVertical: 4 },
  day: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  selected: { backgroundColor: '#208AEF' },
  pressed: { opacity: 0.6 },
  dayNumber: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  outside: { color: '#AAAAAA' },
  today: { color: '#0B5CAD', textDecorationLine: 'underline' },
  selectedText: { color: '#FFFFFF' },
  count: { fontSize: 12, color: '#0B5CAD', fontWeight: '700' },
});
