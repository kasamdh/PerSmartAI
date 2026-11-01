import { fireEvent, render, screen } from '@testing-library/react-native';

import SignInScreen from '../../../../app/(auth)/sign-in';
import { signIn } from '../api';

jest.mock('../api', () => ({ signIn: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const mockSignIn = jest.mocked(signIn);

describe('SignInScreen', () => {
  beforeEach(() => mockSignIn.mockReset());

  it('shows validation errors and does not call the API for an empty form', async () => {
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter your email')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('submits normalized credentials', async () => {
    mockSignIn.mockResolvedValue();
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), ' Olivia@Example.test ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'olivia@example.test',
      password: 'password123',
    });
  });

  it('shows the API error message when sign-in fails', async () => {
    mockSignIn.mockRejectedValue(new Error('Email or password is incorrect.'));
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'olivia@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });
});
