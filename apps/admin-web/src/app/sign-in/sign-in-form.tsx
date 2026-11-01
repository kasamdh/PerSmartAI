'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { TURNSTILE_SITE_KEY, Turnstile } from '@/components/turnstile';
import { Button, Field, inputClass } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Security check (Turnstile); tokens work once, so each attempt gets a new one.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Please wait a moment for the security check, then try again.');
      return;
    }
    setPending(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
      options: { captchaToken: captchaToken ?? undefined },
    });
    setCaptchaToken(null);
    setCaptchaRound((r) => r + 1);
    if (authError) {
      setPending(false);
      setError(
        authError.code === 'captcha_failed'
          ? 'The security check didn’t go through. Please try again.'
          : authError.status === 429
            ? 'Too many sign-in attempts. Wait a few minutes and try again.'
            : authError.message === 'Invalid login credentials'
              ? 'That email and password don’t match.'
              : authError.message,
      );
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      <Turnstile onToken={setCaptchaToken} round={captchaRound} />
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
