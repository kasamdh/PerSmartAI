'use client';

import { useEffect } from 'react';

import { signOut } from '@/app/actions';

// The admin site shows every client's address and entry codes, so a session left
// open on a shared computer signs itself out after this long without activity.
export const IDLE_MINUTES = 30;

const EVENTS = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const;

export function IdleSignOut({ minutes = IDLE_MINUTES }: { minutes?: number }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void signOut(), minutes * 60_000);
    };
    reset();
    for (const event of EVENTS) window.addEventListener(event, reset, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of EVENTS) window.removeEventListener(event, reset);
    };
  }, [minutes]);
  return null;
}
