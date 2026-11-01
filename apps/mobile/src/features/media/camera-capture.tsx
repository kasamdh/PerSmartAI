import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';

import { MAX_PICK, MAX_VIDEO_SECONDS } from './media-logic';
import type { PickedMedia } from './prepare';

/** Full-screen camera: take several photos or 15 second videos, then Done. */
export function CameraCapture({
  visible,
  onCancel,
  onDone,
}: {
  visible: boolean;
  onCancel: () => void;
  onDone: (items: PickedMedia[]) => void;
}) {
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [micPermission, requestMic] = useMicrophonePermissions();
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [captured, setCaptured] = useState<PickedMedia[]>([]);
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (recordingSince === null) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - recordingSince) / 1000)),
      250,
    );
    return () => clearInterval(timer);
  }, [recordingSince]);

  const close = (items: PickedMedia[] | null) => {
    setCaptured([]);
    setRecordingSince(null);
    if (items) onDone(items);
    else onCancel();
  };

  const full = captured.length >= MAX_PICK;

  const takePhoto = async () => {
    if (!camera.current || busy || full) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 1 });
      setCaptured((list) => [
        ...list,
        { uri: photo.uri, type: 'photo', width: photo.width, height: photo.height },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (!camera.current) return;
    if (recordingSince !== null) {
      camera.current.stopRecording();
      return;
    }
    if (full) return;
    if (!micPermission?.granted) {
      const result = await requestMic();
      if (!result.granted) return;
    }
    const started = Date.now();
    setElapsed(0);
    setRecordingSince(started);
    try {
      const video = await camera.current.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (video?.uri) {
        setCaptured((list) => [
          ...list,
          {
            uri: video.uri,
            type: 'video',
            width: 0,
            height: 0,
            durationMs: Math.min(Date.now() - started, MAX_VIDEO_SECONDS * 1000),
          },
        ]);
      }
    } finally {
      setRecordingSince(null);
    }
  };

  const permissionMissing = !cameraPermission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => close(null)}>
      <SafeAreaView style={styles.safeArea}>
        {permissionMissing ? (
          <View style={styles.center}>
            <Text style={styles.message}>Allow the camera to take visit photos and videos.</Text>
            <BigButton label="Allow camera" onPress={() => void requestCamera()} />
            <BigButton label="Cancel" variant="secondary" onPress={() => close(null)} />
          </View>
        ) : (
          <>
            <CameraView ref={camera} style={styles.camera} facing="back" mode={mode} />
            <View style={styles.controls}>
              {recordingSince !== null ? (
                <Text style={styles.recording} accessibilityLiveRegion="polite">
                  ● {elapsed}s / {MAX_VIDEO_SECONDS}s
                </Text>
              ) : (
                <View style={styles.modes}>
                  {(['picture', 'video'] as const).map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="button"
                      accessibilityState={{ selected: mode === m }}
                      onPress={() => setMode(m)}
                      style={[styles.mode, mode === m && styles.modeSelected]}
                    >
                      <Text style={[styles.modeLabel, mode === m && styles.modeLabelSelected]}>
                        {m === 'picture' ? 'Photo' : 'Video'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.row}>
                <BigButton
                  label="Cancel"
                  variant="secondary"
                  style={styles.side}
                  disabled={recordingSince !== null}
                  onPress={() => close(null)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === 'picture'
                      ? 'Take photo'
                      : recordingSince !== null
                        ? 'Stop recording'
                        : 'Record video'
                  }
                  disabled={busy || (full && recordingSince === null)}
                  onPress={() => void (mode === 'picture' ? takePhoto() : toggleRecording())}
                  style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.shutterInner,
                      mode === 'video' && styles.shutterVideo,
                      recordingSince !== null && styles.shutterStop,
                    ]}
                  />
                </Pressable>
                <BigButton
                  label={`Done (${captured.length})`}
                  style={styles.side}
                  disabled={captured.length === 0 || recordingSince !== null}
                  onPress={() => close(captured)}
                />
              </View>
              {full ? (
                <Text style={styles.message}>That’s {MAX_PICK}; send these first.</Text>
              ) : null}
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  camera: { flex: 1 },
  controls: { padding: 16, gap: 12, backgroundColor: '#000000' },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  mode: {
    minHeight: MIN_TAP_TARGET - 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    justifyContent: 'center',
  },
  modeSelected: { backgroundColor: '#FFFFFF' },
  modeLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  modeLabelSelected: { color: '#000000' },
  recording: { color: '#FF5252', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  side: { flex: 1 },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  shutterVideo: { backgroundColor: '#E53935' },
  shutterStop: { width: 32, height: 32, borderRadius: 6 },
  message: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
});
