import { StyleSheet, Text, View } from 'react-native';

import type { ReportCard } from '@/features/care/report-card';
import { reportCardLines } from '@/features/care/report-card';

/** After check-out: what each pet ate, potty, walks, meds, notes, and the sitter's summary. */
export function ReportCardView({
  card,
  summary,
  sitterName,
}: {
  card: ReportCard;
  summary: string | null;
  sitterName: string | null;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Report card
      </Text>
      {card.pets.map((pet) => (
        <View key={pet.petId} style={styles.pet}>
          <Text style={styles.petName}>{pet.name}</Text>
          {reportCardLines(pet).map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
          {pet.notes.map((note) => (
            <Text key={note} style={styles.note}>
              “{note}”
            </Text>
          ))}
        </View>
      ))}
      {card.notes.map((note) => (
        <Text key={note} style={styles.note}>
          “{note}”
        </Text>
      ))}
      {summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>From {sitterName ?? 'your sitter'}</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2E7D32',
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1B5E20' },
  pet: { gap: 2 },
  petName: { fontSize: 19, fontWeight: '700', color: '#1A1A1A' },
  line: { fontSize: 17, color: '#333333' },
  note: { fontSize: 16, color: '#555555', fontStyle: 'italic' },
  summary: { backgroundColor: '#F3FAF3', borderRadius: 12, padding: 12, gap: 4 },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: '#1B5E20' },
  summaryText: { fontSize: 17, color: '#1A1A1A' },
});
