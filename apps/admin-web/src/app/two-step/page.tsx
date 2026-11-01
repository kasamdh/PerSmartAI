import type { Metadata } from 'next';

import { TwoStepForm } from './two-step-form';

export const metadata: Metadata = { title: 'Two-step sign-in · Pet Sitter Admin' };

export default function TwoStepPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <TwoStepForm />
      </div>
    </main>
  );
}
