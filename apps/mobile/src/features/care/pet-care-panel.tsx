import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { TextField } from '@/components/text-field';
import { AllergyBanner } from '@/features/pets/allergy-banner';
import { formatTimeLabel } from '@/lib/wall-clock';

import type { VisitPet } from './api';
import { careButtonsFor, FED_AMOUNTS, walkElapsed, type FedAmount } from './care-events';
import type { ChecklistTask } from './checklist';

export type SimpleCare = 'water' | 'pee' | 'poop' | 'play' | 'vomit';

type PetCarePanelProps = {
  pet: VisitPet;
  /** This pet's checklist for the visit. */
  tasks: ChecklistTask[];
  /** The walk under way for this pet, if any. */
  walk: { startedAt: string } | null;
  now: Date;
  /** False before check-in and after check-out: details only, no buttons. */
  enabled: boolean;
  busy?: boolean;
  onFed: (amount: FedAmount, task: ChecklistTask | null) => void;
  onMeds: (task: ChecklistTask | null, skipReason?: string) => void;
  onLog: (type: SimpleCare) => void;
  onWalk: () => void;
  onNote: (text: string) => void;
  /** Opens the full pet profile. */
  onOpenProfile?: () => void;
};

const SIMPLE_LABELS: Record<SimpleCare, string> = {
  water: 'Water',
  pee: 'Pee',
  poop: 'Poop',
  play: 'Play',
  vomit: 'Vomit',
};

function formatTimes(times: readonly string[]): string {
  return times.map((t) => t.slice(0, 5)).join(', ');
}

export function PetCarePanel({
  pet,
  tasks,
  walk,
  now,
  enabled,
  busy = false,
  onFed,
  onMeds,
  onLog,
  onWalk,
  onNote,
  onOpenProfile,
}: PetCarePanelProps) {
  const buttons = careButtonsFor(pet.species, pet.pet_medications.length > 0).map((b) => b.type);
  const [note, setNote] = useState<string | null>(null);
  const simple = buttons.filter((t): t is SimpleCare => t in SIMPLE_LABELS);
  const nextFeeding = tasks.find((t) => t.kind === 'feeding' && t.status === 'open') ?? null;
  const nextMeds = tasks.find((t) => t.kind === 'medication' && t.status === 'open') ?? null;

  return (
    <View style={styles.panel}>
      <AllergyBanner allergies={pet.pet_allergies} />

      <Text style={styles.name} accessibilityRole="header">
        {pet.name}
        <Text style={styles.breed}>
          {'  '}
          {[pet.species, pet.breed].filter(Boolean).join(' · ')}
        </Text>
      </Text>

      {pet.feeding_plans.map((f) => (
        <Text key={f.id} style={styles.detail}>
          🍽 {[f.amount, f.unit].filter(Boolean).join(' ')} {f.food_brand ?? ''}
          {f.times.length ? ` at ${formatTimes(f.times)}` : ''}
          {f.treats_allowed ? '' : ' · no treats'}
          {f.notes ? ` · ${f.notes}` : ''}
        </Text>
      ))}
      {pet.pet_medications.map((m) => (
        <Text key={m.id} style={styles.detail}>
          💊 {m.name}
          {m.dose ? ` ${m.dose}` : ''}
          {m.schedule_times.length ? ` at ${formatTimes(m.schedule_times)}` : ''}
          {m.instructions ? ` · ${m.instructions}` : ''}
        </Text>
      ))}
      {pet.temperament_notes ? <Text style={styles.detail}>{pet.temperament_notes}</Text> : null}

      {onOpenProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Full profile for ${pet.name}: vet, emergency contacts`}
          onPress={onOpenProfile}
          style={styles.profileLink}
        >
          <Text style={styles.profileLabel}>Full profile, vet & emergency contacts ›</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Tasks this visit</Text>
      {tasks.length === 0 ? (
        <Text style={styles.detail}>No feedings or medications due now.</Text>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={task.key}
            task={task}
            enabled={enabled}
            busy={busy}
            onFed={(amount) => onFed(amount, task)}
            onMeds={(reason) => onMeds(task, reason)}
          />
        ))
      )}

      {enabled ? (
        <>
          <Text style={styles.section}>Log care</Text>
          <Text style={styles.fedLabel}>Fed{nextFeeding ? ` (${nextFeeding.title})` : ''}</Text>
          <View style={styles.row}>
            {FED_AMOUNTS.map((a) => (
              <CareButton
                key={a.value}
                label={a.label}
                accessibilityLabel={`Fed ${pet.name}, ate ${a.label.toLowerCase()}`}
                busy={busy}
                onPress={() => onFed(a.value, nextFeeding)}
              />
            ))}
          </View>
          <View style={styles.grid}>
            {simple.map((type) => (
              <CareButton
                key={type}
                label={SIMPLE_LABELS[type]}
                accessibilityLabel={`${SIMPLE_LABELS[type]}, ${pet.name}`}
                busy={busy}
                onPress={() => onLog(type)}
              />
            ))}
            {buttons.includes('walk') ? (
              <CareButton
                label={walk ? `Stop walk ${walkElapsed(walk.startedAt, now)}` : 'Start walk'}
                accessibilityLabel={
                  walk ? `Stop walk with ${pet.name}` : `Start walk with ${pet.name}`
                }
                busy={busy}
                active={!!walk}
                onPress={onWalk}
              />
            ) : null}
            {buttons.includes('meds_given') ? (
              <CareButton
                label="Meds given"
                accessibilityLabel={`Meds given to ${pet.name}${nextMeds ? `: ${nextMeds.title}` : ''}`}
                busy={busy}
                onPress={() => onMeds(nextMeds)}
              />
            ) : null}
            <CareButton
              label="Note"
              accessibilityLabel={`Note about ${pet.name}`}
              busy={busy}
              onPress={() => setNote(note === null ? '' : null)}
            />
          </View>
          {note !== null ? (
            <View style={styles.noteBox}>
              <TextField
                label={`Note about ${pet.name}`}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Hid under the bed, came out for treats"
                multiline
                maxLength={500}
              />
              <BigButton
                label="Save note"
                variant="secondary"
                disabled={!note.trim() || busy}
                onPress={() => {
                  onNote(note);
                  setNote(null);
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function TaskRow({
  task,
  enabled,
  busy,
  onFed,
  onMeds,
}: {
  task: ChecklistTask;
  enabled: boolean;
  busy: boolean;
  onFed: (amount: FedAmount) => void;
  onMeds: (skipReason?: string) => void;
}) {
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState('');
  const open = task.status === 'open';
  const icon = task.status === 'done' ? '✅' : task.status === 'skipped' ? '⏭' : '⬜';

  return (
    <View style={[styles.task, !open && styles.taskDone]}>
      <Text style={styles.taskTitle}>
        {icon} {formatTimeLabel(task.dueTime)} · {task.title}
      </Text>
      {task.detail ? <Text style={styles.detail}>{task.detail}</Text> : null}
      {open && enabled && task.kind === 'feeding' ? (
        <View style={styles.row}>
          {FED_AMOUNTS.map((a) => (
            <CareButton
              key={a.value}
              label={a.label}
              accessibilityLabel={`${task.title}: ate ${a.label.toLowerCase()}`}
              busy={busy}
              onPress={() => onFed(a.value)}
            />
          ))}
        </View>
      ) : null}
      {open && enabled && task.kind === 'medication' && !skipping ? (
        <View style={styles.row}>
          <CareButton
            label="Given"
            accessibilityLabel={`${task.title} given`}
            busy={busy}
            onPress={() => onMeds()}
          />
          <CareButton
            label="Skip…"
            accessibilityLabel={`Skip ${task.title}`}
            busy={busy}
            onPress={() => setSkipping(true)}
          />
        </View>
      ) : null}
      {skipping && open ? (
        <View style={styles.noteBox}>
          <TextField
            label="Why was it skipped?"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Refused it, vomited earlier"
            maxLength={200}
          />
          <View style={styles.row}>
            <BigButton
              label="Cancel"
              variant="secondary"
              style={styles.flex}
              onPress={() => setSkipping(false)}
            />
            <BigButton
              label="Save skip"
              style={styles.flex}
              disabled={!reason.trim() || busy}
              onPress={() => {
                onMeds(reason.trim());
                setSkipping(false);
                setReason('');
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CareButton({
  label,
  accessibilityLabel,
  busy,
  active = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  busy: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.careButton,
        active && styles.careButtonActive,
        pressed && styles.careButtonPressed,
        busy && styles.careButtonBusy,
      ]}
    >
      <Text style={[styles.careLabel, active && styles.careLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 6,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
  breed: { fontSize: 16, fontWeight: '400', color: '#555555' },
  detail: { fontSize: 16, color: '#333333' },
  section: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 10 },
  fedLabel: { fontSize: 16, fontWeight: '600', color: '#333333' },
  profileLink: { minHeight: 48, justifyContent: 'center' },
  profileLabel: { fontSize: 16, fontWeight: '600', color: '#0B5CAD' },
  task: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E4F5',
    backgroundColor: '#F7FAFE',
    padding: 10,
    gap: 6,
  },
  taskDone: { backgroundColor: '#F3F8F3', borderColor: '#D5EAD6' },
  taskTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  careButton: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: MIN_TAP_TARGET + 8,
    borderRadius: 14,
    backgroundColor: '#E3F0FD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  careButtonActive: { backgroundColor: '#2E7D32' },
  careButtonPressed: { backgroundColor: '#C7E0FA' },
  careButtonBusy: { opacity: 0.6 },
  careLabel: { fontSize: 18, fontWeight: '700', color: '#0B5CAD', textAlign: 'center' },
  careLabelActive: { color: '#FFFFFF' },
  noteBox: { gap: 8 },
});
