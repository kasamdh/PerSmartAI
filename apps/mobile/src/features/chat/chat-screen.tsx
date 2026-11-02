import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { ErrorView, LoadingView } from '@/components/query-states';
import { useAuth } from '@/features/auth/auth-provider';
import { MediaViewer } from '@/features/media/media-viewer';
import { useOrgSettings } from '@/features/scheduling/hooks';
import { formatTime } from '@/features/visits/time';
import { formatDateLabel } from '@/lib/wall-clock';
import { cachedImageSource } from '@/lib/image-cache';

import type { ChatMessage } from './api';
import { daySeparators, readReceipt } from './chat-logic';
import { useMarkRead, useMessages, useReads, useSendPhoto, useSendText } from './hooks';

const ROLE_LABELS = { owner: 'Owner', sitter: 'Sitter', admin: 'Business' } as const;

/** One household's conversation: newest at the bottom, older pages load as you scroll up. */
export function ChatScreen({ householdId }: { householdId: string }) {
  const me = useAuth().session?.user.id ?? '';
  const org = useOrgSettings();
  const messages = useMessages(householdId);
  const reads = useReads(householdId);
  const markRead = useMarkRead(householdId);
  const sendText = useSendText(householdId);
  const sendPhoto = useSendPhoto(householdId);
  const [draft, setDraft] = useState('');
  const [viewing, setViewing] = useState<ChatMessage | null>(null);

  const list = useMemo(() => messages.data?.pages.flat() ?? [], [messages.data]);
  const separators = useMemo(() => daySeparators(list), [list]);
  const newestId = list[0]?.id;
  const myLatestId = list.find((m) => m.sender_id === me)?.id;

  // Opening the chat, and each new message while it's open, marks it read.
  const { mutate: mark } = markRead;
  useEffect(() => {
    if (newestId) mark();
  }, [newestId, mark]);

  if (messages.isPending) return <LoadingView label="Loading messages" />;
  if (messages.isError) return <ErrorView onRetry={() => messages.refetch()} />;

  const send = () => {
    const text = draft;
    setDraft('');
    sendText.mutate(text, {
      onError: () => {
        setDraft(text);
        Alert.alert('Not sent', 'Check your connection and try again.');
      },
    });
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    if (!org.data) return;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to send photos.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    sendPhoto.mutate(
      { organizationId: org.data.id, uri: asset.uri, width: asset.width },
      { onError: () => Alert.alert('Photo not sent', 'Check your connection and try again.') },
    );
  };

  const choosePhoto = () =>
    Alert.alert('Send a photo', undefined, [
      { text: 'Take photo', onPress: () => void pickPhoto('camera') },
      { text: 'Choose from library', onPress: () => void pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <FlashList
          inverted
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
          }}
          ListFooterComponent={
            messages.isFetchingNextPage ? (
              <ActivityIndicator
                style={styles.loadingMore}
                accessibilityLabel="Loading older messages"
              />
            ) : !messages.hasNextPage && list.length > 0 ? (
              <Text style={styles.start}>Start of the conversation</Text>
            ) : undefined
          }
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello!</Text>}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            const day = separators.get(item.id);
            const receipt = item.id === myLatestId ? readReceipt(item, reads.data ?? [], me) : null;
            return (
              <View>
                {day ? <Text style={styles.day}>{formatDateLabel(day)}</Text> : null}
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    {!mine ? (
                      <Text style={styles.sender}>
                        {item.sender?.full_name ?? 'Former member'}
                        {item.sender ? ` · ${ROLE_LABELS[item.sender.role]}` : ''}
                      </Text>
                    ) : null}
                    {item.thumbUrl ? (
                      <Pressable
                        accessibilityRole="imagebutton"
                        accessibilityLabel="Open photo"
                        onPress={() => setViewing(item)}
                      >
                        <Image
                          accessible={false}
                          source={cachedImageSource(item.thumbUrl)}
                          cachePolicy="memory-disk"
                          style={styles.photo}
                          contentFit="cover"
                        />
                      </Pressable>
                    ) : null}
                    {item.body ? (
                      <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
                    ) : null}
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
                {receipt ? <Text style={styles.receipt}>{receipt}</Text> : null}
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send a photo"
            onPress={choosePhoto}
            disabled={sendPhoto.isPending || !org.data}
            style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
          >
            {sendPhoto.isPending ? <ActivityIndicator /> : <Text style={styles.photoIcon}>📷</Text>}
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            accessibilityLabel="Message"
            multiline
            maxLength={4000}
            style={styles.input}
          />
          <BigButton
            label="Send"
            onPress={send}
            disabled={!draft.trim()}
            loading={sendText.isPending}
            style={styles.send}
          />
        </View>
      </KeyboardAvoidingView>

      <MediaViewer
        items={
          viewing?.photoUrl
            ? [
                {
                  id: viewing.id,
                  type: 'photo',
                  url: viewing.photoUrl,
                  caption: viewing.body,
                  hearts: 0,
                  media_reactions: [],
                },
              ]
            : []
        }
        index={viewing?.photoUrl ? 0 : null}
        viewerId={me}
        canReact={false}
        onToggleHeart={() => {}}
        onChangeIndex={() => {}}
        onClose={() => setViewing(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  flex: { flex: 1 },
  list: { padding: 12, gap: 6, flexGrow: 1 },
  loadingMore: { padding: 12 },
  start: { textAlign: 'center', color: '#666666', fontSize: 14, padding: 12 },
  empty: {
    textAlign: 'center',
    color: '#555555',
    fontSize: 17,
    padding: 24,
    transform: [{ scaleY: -1 }],
  },
  day: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
    fontWeight: '600',
    marginVertical: 8,
  },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  mine: { backgroundColor: '#1565C0', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  sender: { fontSize: 13, fontWeight: '700', color: '#0B5CAD' },
  photo: { width: 220, height: 165, borderRadius: 10, backgroundColor: '#DDDDDD' },
  body: { fontSize: 17, color: '#1A1A1A' },
  bodyMine: { color: '#FFFFFF' },
  time: { fontSize: 12, color: '#666666', alignSelf: 'flex-end' },
  timeMine: { color: '#E3F0FD' },
  receipt: { fontSize: 12, color: '#666666', textAlign: 'right', marginTop: 2, marginRight: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDDDDD',
  },
  photoButton: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    borderRadius: 14,
    backgroundColor: '#E3F0FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  photoIcon: { fontSize: 24 },
  input: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    maxHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  send: { paddingHorizontal: 16 },
});
