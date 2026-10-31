import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/auth-provider';
import { petRouteFor } from '@/features/pets/routes';
import { formatTime, formatTimeRange } from '@/features/visits/time';
import { useVisitActionRunner } from '@/features/visits/use-sitter-visits';
import { primaryActionFor, statusLabel } from '@/features/visits/visit-actions';

import { CheckOutSheet } from '@/features/visits/check-out-sheet';
import type { VisitPet } from './api';
import { canLogCare, FED_AMOUNTS, type CareEventType } from './care-events';
import { CareTimeline } from './care-timeline';
import {
  useCareEvents,
  useDeleteCareEvent,
  useLogCareEvent,
  useUploadVisitPhoto,
  useVisitDetail,
  useVisitPhotos,
} from './hooks';
import { PetCarePanel } from './pet-care-panel';
import { PhotoGrid } from './photo-grid';

function showError(title: string) {
  return (error: Error) => Alert.alert(title, error.message || 'Please try again.');
}

export function VisitDetailScreen({ visitId }: { visitId: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const detail = useVisitDetail(visitId);
  const events = useCareEvents(visitId);
  const photos = useVisitPhotos(visitId);
  const logEvent = useLogCareEvent(visitId);
  const removeEvent = useDeleteCareEvent(visitId);
  const uploadPhoto = useUploadVisitPhoto(visitId);
  const { run, pendingFor, checkOutSheet } = useVisitActionRunner();
  const [note, setNote] = useState('');

  if (detail.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading visit" />
      </View>
    );
  }
  if (detail.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.sectionTitle}>{"Couldn't load this visit"}</Text>
        <BigButton label="Try again" onPress={() => detail.refetch()} />
      </View>
    );
  }

  const visit = detail.data;
  const household = visit.booking.household;
  // One row per household (unique), but PostgREST returns it as a list via the composite FK.
  const access = household.household_access[0] ?? null;
  const pets = visit.booking.booking_pets.map((bp) => bp.pet).filter((p) => p !== null);
  const placeName = household.name ?? household.address_line1;
  const loggable = canLogCare(visit.status);
  const primary = primaryActionFor(visit.status);

  const log = (pet: VisitPet, type: Exclude<CareEventType, 'note'>) => {
    const save = (value?: Record<string, string>) =>
      logEvent.mutate({ petId: pet.id, type, value }, { onError: showError("Couldn't save that") });
    if (type !== 'fed') {
      save();
      return;
    }
    Alert.alert(
      `How much did ${pet.name} eat?`,
      undefined,
      FED_AMOUNTS.map((a) => ({ text: a.label, onPress: () => save({ amount_eaten: a.value }) })),
      { cancelable: true },
    );
  };

  const addNote = () => {
    const text = note.trim();
    if (!text) {
      return;
    }
    logEvent.mutate(
      { petId: null, type: 'note', value: { text } },
      { onSuccess: () => setNote(''), onError: showError("Couldn't save the note") },
    );
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access in Settings to take visit photos.',
        );
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) {
      return;
    }
    uploadPhoto.mutate(
      {
        organizationId: visit.organization_id,
        petId: pets.length === 1 ? pets[0].id : null,
        uri: asset.uri,
        width: asset.width,
      },
      { onError: showError("Couldn't upload the photo") },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <CheckOutSheet {...checkOutSheet} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.time}>
            {formatTimeRange(visit.scheduled_start, visit.scheduled_end)} ·{' '}
            {statusLabel(visit.status)}
          </Text>
          <Text style={styles.place}>{placeName}</Text>
          <Text style={styles.body}>
            {[household.address_line1, household.address_line2, household.city]
              .filter(Boolean)
              .join(', ')}
          </Text>
          {visit.check_in_at ? (
            <Text style={styles.body}>
              Checked in {formatTime(visit.check_in_at)}
              {visit.check_out_at ? ` · out ${formatTime(visit.check_out_at)}` : ''}
            </Text>
          ) : null}
          {visit.booking.notes ? <Text style={styles.body}>{visit.booking.notes}</Text> : null}
        </View>

        {access ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Getting in</Text>
            {access.entry_instructions ? (
              <Text style={styles.body}>{access.entry_instructions}</Text>
            ) : null}
            {access.alarm_notes ? (
              <Text style={styles.body}>Alarm: {access.alarm_notes}</Text>
            ) : null}
            {access.wifi_name ? (
              <Text style={styles.body}>
                Wi-Fi: {access.wifi_name}
                {access.wifi_password ? ` / ${access.wifi_password}` : ''}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!loggable && visit.status !== 'completed' ? (
          <Text style={styles.hint}>Check in to start logging care.</Text>
        ) : null}

        {pets.map((pet) => (
          <PetCarePanel
            key={pet.id}
            pet={pet}
            onLog={loggable ? (type) => log(pet, type) : null}
            busy={logEvent.isPending}
            onOpenProfile={() => router.push(petRouteFor('sitter', pet.id))}
          />
        ))}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <PhotoGrid photos={photos.data} isLoading={photos.isPending} />
          {loggable ? (
            <View style={styles.actions}>
              <BigButton
                label="Take photo"
                onPress={() => addPhoto('camera')}
                loading={uploadPhoto.isPending}
              />
              <BigButton
                label="Choose from library"
                variant="secondary"
                onPress={() => addPhoto('library')}
                disabled={uploadPhoto.isPending}
              />
            </View>
          ) : null}
        </View>

        {loggable ? (
          <View style={styles.card}>
            <TextField
              label="Note for the owner"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Mochi hid under the bed but came out for treats"
              multiline
              style={styles.noteInput}
            />
            <BigButton
              label="Add note"
              variant="secondary"
              onPress={addNote}
              disabled={!note.trim() || logEvent.isPending}
            />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Care log</Text>
          <CareTimeline
            events={events.data ?? []}
            canRemove={(e) => loggable && e.created_by === session?.user.id}
            onRemove={(e) =>
              removeEvent.mutate(e.id, { onError: showError("Couldn't remove that entry") })
            }
          />
        </View>
      </ScrollView>

      {primary ? (
        <View style={styles.footer}>
          <BigButton
            label={primary.label}
            onPress={() => run({ id: visit.id, placeName }, primary.kind)}
            loading={pendingFor(visit.id) === primary.kind}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 6,
  },
  time: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0B5CAD',
  },
  place: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  body: {
    fontSize: 16,
    color: '#333333',
  },
  hint: {
    fontSize: 17,
    color: '#555555',
    textAlign: 'center',
    paddingVertical: 4,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  noteInput: {
    minHeight: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 4,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
  },
});
