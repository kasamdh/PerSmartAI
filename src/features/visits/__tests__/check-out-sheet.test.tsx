import { fireEvent, render, screen } from '@testing-library/react-native';

import { CheckOutSheet } from '../check-out-sheet';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

describe('CheckOutSheet', () => {
  it('builds a summary from quick phrases and checks out with it', async () => {
    const onConfirm = jest.fn();
    await render(
      <CheckOutSheet placeName="Rudra's home" onCancel={jest.fn()} onConfirm={onConfirm} />,
    );

    expect(screen.getByText("Check out of Rudra's home?")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add: All good!' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add: Good walk.' }));
    expect(screen.getByLabelText('How did it go?').props.value).toBe('All good! Good walk.');

    await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
    expect(onConfirm).toHaveBeenCalledWith('All good! Good walk.');
  });

  it('lets the sitter back out without checking out', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(
      <CheckOutSheet placeName="Rudra's home" onCancel={onCancel} onConfirm={onConfirm} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Not yet' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('is hidden when no visit is being checked out', async () => {
    await render(<CheckOutSheet placeName={null} onCancel={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.queryByText(/Check out of/)).toBeNull();
  });
});
