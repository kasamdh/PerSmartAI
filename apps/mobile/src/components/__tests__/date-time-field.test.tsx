import { fireEvent, render, screen } from '@testing-library/react-native';

import { DateTimeField } from '../date-time-field';

// The native picker, reduced to a button that "picks" mockPicked.
let mockPicked = new Date(2026, 10, 20, 18, 45);
const mockPickerProps = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: { onValueChange: (e: unknown, d: Date) => void; onDismiss: () => void }) => {
    mockPickerProps(props);
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <>
        <Pressable accessibilityRole="button" onPress={() => props.onValueChange({}, mockPicked)}>
          <Text>pick</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => props.onDismiss()}>
          <Text>dismiss</Text>
        </Pressable>
      </>
    );
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPicked = new Date(2026, 10, 20, 18, 45);
});

describe('DateTimeField', () => {
  it('shows the chosen date and opens the picker on tap', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Date" mode="date" value="2026-11-03" onChange={onChange} />);
    expect(screen.queryByText('pick')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Date: Tue, Nov 3, 2026' }));
    await fireEvent.press(screen.getByText('pick'));
    expect(onChange).toHaveBeenCalledWith('2026-11-20');
  });

  it('returns 24-hour times and starts the picker at the current value', async () => {
    const onChange = jest.fn();
    await render(<DateTimeField label="Arrives" mode="time" value="19:00" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Arrives: 7:00 PM' }));

    const { value } = mockPickerProps.mock.calls[0][0] as { value: Date };
    expect([value.getHours(), value.getMinutes()]).toEqual([19, 0]);

    await fireEvent.press(screen.getByText('pick'));
    expect(onChange).toHaveBeenCalledWith('18:45');
  });

  it('starts an empty date at the minimum and passes it to the picker', async () => {
    await render(
      <DateTimeField
        label="Until"
        mode="date"
        value=""
        onChange={jest.fn()}
        minimumDate="2026-12-01"
        placeholder="No end date"
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Until: No end date' }));
    const props = mockPickerProps.mock.calls[0][0] as { value: Date; minimumDate: Date };
    expect(props.value.toDateString()).toBe(new Date(2026, 11, 1).toDateString());
    expect(props.minimumDate.toDateString()).toBe(new Date(2026, 11, 1).toDateString());
  });

  it('closes on Done or dismiss', async () => {
    await render(<DateTimeField label="Date" mode="date" value="" onChange={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Date: Choose' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('pick')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Date: Choose' }));
    await fireEvent.press(screen.getByText('dismiss'));
    expect(screen.queryByText('pick')).toBeNull();
  });

  it('lets optional fields be cleared, and shows errors', async () => {
    const onChange = jest.fn();
    await render(
      <DateTimeField
        label="Latest arrival"
        mode="time"
        value="11:00"
        onChange={onChange}
        clearable
        error="Latest arrival must be after the earliest"
      />,
    );
    expect(screen.getByText('Latest arrival must be after the earliest')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
