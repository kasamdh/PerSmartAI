'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { signOut } from '@/app/actions';
import { Button, Field, inputClass } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';

// Admins sign in with a password plus a code from an authenticator app (TOTP).
// The database only grants admin access to two-step sessions (aal2), so this is
// required, not optional. First time: scan the QR code; after that: enter a code.

type State =
  | { kind: 'loading' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qrCode: string; secret: string }
  | { kind: 'error'; message: string };

export function TwoStepForm() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setState({ kind: 'error', message: listError.message });
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) {
        if (!cancelled) setState({ kind: 'verify', factorId: verified.id });
        return;
      }
      // Drop half-finished setups, then start a new one.
      for (const f of data.all.filter((f) => f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      });
      if (enrollError) return setState({ kind: 'error', message: enrollError.message });
      if (!cancelled) {
        setState({
          kind: 'enroll',
          factorId: enrolled.id,
          qrCode: enrolled.totp.qr_code,
          secret: enrolled.totp.secret,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.kind !== 'verify' && state.kind !== 'enroll') return;
    setPending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code: code.replace(/\s/g, ''),
    });
    if (verifyError) {
      setPending(false);
      setError(
        verifyError.status === 429
          ? 'Too many tries. Wait a minute and try again.'
          : 'That code didn’t work. Check the time on your phone and try the newest code.',
      );
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Two-step sign-in</h1>
      {state.kind === 'loading' ? <p className="mt-4 text-sm text-gray-600">Loading…</p> : null}
      {state.kind === 'error' ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      {state.kind === 'enroll' ? (
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p>
            Admins protect their clients’ details with a code from an authenticator app (such as
            Google Authenticator, Microsoft Authenticator or 1Password). Scan this once:
          </p>
          {/* Supabase returns the QR code as an SVG data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.qrCode}
            alt="QR code for your authenticator app"
            className="mx-auto h-48 w-48"
          />
          <p>
            Can’t scan? Enter this key:{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 break-all">{state.secret}</code>
          </p>
        </div>
      ) : null}
      {state.kind === 'verify' ? (
        <p className="mt-3 text-sm text-gray-700">
          Enter the 6-digit code from your authenticator app.
        </p>
      ) : null}
      {state.kind === 'verify' || state.kind === 'enroll' ? (
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="6-digit code">
            <input
              className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Checking…' : state.kind === 'enroll' ? 'Turn on and continue' : 'Continue'}
          </Button>
        </form>
      ) : null}
      <form action={signOut} className="mt-6 text-center">
        <button type="submit" className="text-sm text-gray-600 underline">
          Sign out
        </button>
      </form>
    </>
  );
}
