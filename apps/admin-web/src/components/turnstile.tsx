'use client';

import { useEffect, useRef } from 'react';

// Cloudflare Turnstile for the sign-in form (Supabase Auth CAPTCHA). Off when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set (local development).

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Couldn’t load the security check'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Renders the widget and reports tokens (null when one expires). Change `round`
 * to get a fresh token after each sign-in attempt (tokens work once).
 */
export function Turnstile({
  onToken,
  round,
}: {
  onToken: (token: string | null) => void;
  round: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let id: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: 'interaction-only',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [round]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} aria-label="Security check" className="flex justify-center" />;
}
