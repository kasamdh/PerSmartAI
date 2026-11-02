import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** A saved item with large Edit / Remove actions, used by the allergy, medication, and contact editors. */
export function EditableRow({
  title,
  subtitle,
  emphasized,
  onEdit,
  onRemove,
  extra,
}: {
  title: string;
  subtitle?: string | null;
  emphasized?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  extra?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[styles.title, emphasized && styles.emphasized]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {extra}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title}`}
        onPress={onEdit}
        style={styles.action}
      >
        <Text style={styles.edit}>Edit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${title}`}
        onPress={onRemove}
        style={styles.action}
      >
        <Text style={styles.remove}>Remove</Text>
      </Pressable>
    </View>
  );
}

export function EditorCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  emphasized: { color: '#B71C1C', fontWeight: '800' },
  subtitle: { fontSize: 15, color: '#555555' },
  action: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10 },
  edit: { fontSize: 16, fontWeight: '600', color: '#0B5CAD' },
  remove: { fontSize: 16, fontWeight: '600', color: '#C62828' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
});
