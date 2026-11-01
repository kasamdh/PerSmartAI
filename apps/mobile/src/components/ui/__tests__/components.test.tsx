import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, size } from '@/theme';

import {
  AllergyBanner,
  BigActionButton,
  Button,
  EmptyState,
  ListItem,
  Select,
  StatusChip,
  ToastProvider,
  useToast,
} from '..';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
const flat = (el: { props: Record<string, unknown> }) =>
  StyleSheet.flatten(el.props.style as never);

describe('Button', () => {
  it('is a big, labelled button that calls onPress', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Book a visit" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Book a visit' });
    expect(flat(button).minHeight).toBeGreaterThanOrEqual(48);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('tells screen readers it is busy and ignores presses while loading', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('BigActionButton', () => {
  it('is thumb-sized and reads as one sentence', async () => {
    await wrap(
      <BigActionButton
        label="Fed"
        icon="food"
        detail="2× today"
        active
        onPress={() => {}}
        accessibilityLabel="Fed Max, ate all"
      />,
    );
    const button = screen.getByRole('button', { name: 'Fed Max, ate all' });
    expect(flat(button).minHeight).toBe(size.bigAction);
    expect(button.props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('StatusChip', () => {
  it.each([
    ['scheduled', 'Scheduled'],
    ['on_the_way', 'On the way'],
    ['arrived', 'Arrived'],
    ['in_progress', 'In progress'],
    ['completed', 'Completed'],
    ['missed', 'Missed'],
  ] as const)('shows %s in words, not just color', async (status, words) => {
    await wrap(<StatusChip status={status} />);
    expect(screen.getByLabelText(`Status: ${words}`)).toBeTruthy();
    expect(screen.getByText(words)).toBeTruthy();
  });
});

describe('AllergyBanner', () => {
  const allergies = [
    { allergen: 'Pollen', severity: 'mild' as const },
    { allergen: 'Chicken', severity: 'severe' as const },
  ];

  it('is always shown, severe first, for both sizes', async () => {
    await wrap(<AllergyBanner allergies={allergies} variant="compact" />);
    expect(screen.getByLabelText('Allergies: Chicken (severe), Pollen (mild)')).toBeTruthy();
    expect(flat(screen.getByText(/Chicken \(severe\)/)).fontWeight).toBe('800');
  });

  it('renders nothing for a pet without allergies', async () => {
    await wrap(<AllergyBanner allergies={[]} />);
    expect(screen.queryByTestId('allergy-banner')).toBeNull();
  });
});

describe('ListItem', () => {
  it('offers swipe actions to screen readers too', async () => {
    const onDelete = jest.fn();
    await wrap(
      <ListItem
        title="Walk with Max"
        subtitle="Tomorrow at 12:00"
        onPress={() => {}}
        swipeActions={[{ label: 'Cancel visit', icon: 'close', tone: 'danger', onPress: onDelete }]}
      />,
    );
    const row = screen.getByRole('button', { name: 'Walk with Max, Tomorrow at 12:00' });
    expect(row.props.accessibilityActions).toEqual([
      { name: 'Cancel visit', label: 'Cancel visit' },
    ]);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'Cancel visit' } });
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('has a friendly heading and one clear action', async () => {
    const onPress = jest.fn();
    await wrap(
      <EmptyState
        title="No pets yet"
        body="Add your first pet."
        action={{ label: 'Add a pet', onPress }}
      />,
    );
    expect(screen.getByRole('header', { name: 'No pets yet' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a pet' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Select', () => {
  it('opens the options and reports the choice', async () => {
    const onChange = jest.fn();
    await wrap(
      <Select
        label="Visit length"
        value="30"
        onChange={onChange}
        options={[
          { value: '30', label: '30 minutes' },
          { value: '60', label: '1 hour' },
        ]}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Visit length: 30 minutes' }));
    await fireEvent.press(screen.getByRole('radio', { name: '1 hour' }));
    expect(onChange).toHaveBeenCalledWith('60');
  });
});

describe('Toast', () => {
  function ShowOnMount({ onUndo }: { onUndo: () => void }) {
    const toast = useToast();
    useEffect(() => {
      toast.show({ message: 'Max ate all his food', actionLabel: 'Undo', onAction: onUndo });
    }, [toast, onUndo]);
    return null;
  }

  it('shows a plain message with Undo, then goes away by itself', async () => {
    jest.useFakeTimers();
    const onUndo = jest.fn();
    await wrap(
      <ToastProvider>
        <ShowOnMount onUndo={onUndo} />
      </ToastProvider>,
    );
    expect(screen.getByText('Max ate all his food')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo: Max ate all his food' }));
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText('Max ate all his food')).toBeNull();
    jest.useRealTimers();
  });

  it('disappears after five seconds', async () => {
    jest.useFakeTimers();
    await wrap(
      <ToastProvider>
        <ShowOnMount onUndo={() => {}} />
      </ToastProvider>,
    );
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(screen.queryByText('Max ate all his food')).toBeNull();
    jest.useRealTimers();
  });
});
