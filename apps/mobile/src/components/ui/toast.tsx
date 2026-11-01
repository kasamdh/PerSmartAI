import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type ToastOptions = {
  /** Plain words, e.g. "Max ate all his food". */
  message: string;
  /** Usually "Undo". */
  actionLabel?: string;
  onAction?: () => void;
  /** How long it stays (default 5 s). */
  durationMs?: number;
  /** Extra space above the bottom (e.g. to clear a bottom action bar). */
  bottomOffset?: number;
};

type ToastApi = { show: (options: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi>({ show: () => {}, hide: () => {} });

/** Show a short message with an optional Undo. One at a time; a new one replaces the old. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const theme = useTheme();

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      clearTimeout(timer.current);
      setToast({ ...options, id: Date.now() });
      // Screen readers hear it even though focus stays where it was.
      AccessibilityInfo.announceForAccessibility(
        options.actionLabel
          ? `${options.message}. ${options.actionLabel} available.`
          : options.message,
      );
      timer.current = setTimeout(() => setToast(null), options.durationMs ?? theme.motion.toastMs);
    },
    [theme.motion.toastMs],
  );

  useEffect(() => () => clearTimeout(timer.current), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: ToastOptions; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduceMotion ? FadeIn.duration(theme.motion.fast) : SlideInDown.duration(theme.motion.slow)
      }
      exiting={
        reduceMotion
          ? FadeOut.duration(theme.motion.fast)
          : SlideOutDown.duration(theme.motion.base)
      }
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + theme.space.md + (toast.bottomOffset ?? 88),
          left: theme.space.md,
          right: theme.space.md,
        },
      ]}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: theme.colors.toast,
            borderRadius: theme.radius.lg,
            paddingLeft: theme.space.md,
            paddingRight: theme.space.xxs,
            gap: theme.space.xs,
            minHeight: theme.size.control,
          },
          theme.elevation(2),
        ]}
      >
        <Text variant="callout" style={[styles.flex, { color: theme.colors.onToast }]}>
          {toast.message}
        </Text>
        {toast.actionLabel ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${toast.actionLabel}: ${toast.message}`}
            onPress={() => {
              toast.onAction?.();
              onDone();
            }}
            style={[
              styles.action,
              {
                minHeight: theme.size.tap,
                minWidth: theme.size.tap,
                paddingHorizontal: theme.space.sm,
              },
            ]}
          >
            <Text variant="label" style={{ color: theme.colors.toastAction }}>
              {toast.actionLabel}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  toast: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, paddingVertical: 12 },
  action: { alignItems: 'center', justifyContent: 'center' },
});
