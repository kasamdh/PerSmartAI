import { fireEvent, render, screen } from '@testing-library/react-native';

import { BigButton, MIN_TAP_TARGET } from '../big-button';

describe('BigButton', () => {
  it('renders an accessible button that handles presses', async () => {
    const onPress = jest.fn();
    await render(<BigButton label="Check in" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps tap targets large enough for one-handed use', () => {
    expect(MIN_TAP_TARGET).toBeGreaterThanOrEqual(48);
  });
});
