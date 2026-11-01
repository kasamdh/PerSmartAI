import type { Metadata } from 'next';

import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in · Pet Sitter Admin' };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Pet Sitter Admin</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in with your business admin account.</p>
        <SignInForm />
      </div>
    </main>
  );
}
