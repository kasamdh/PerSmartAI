import type { AppRole } from '@/types/models';

// Before the system's notification prompt (which can only be shown once), the app
// says in plain words what notifications are for. "Not now" waits a week before
// asking again, so the app doesn't nag on every launch.

export const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function pushExplanation(role: AppRole): { title: string; body: string } {
  switch (role) {
    case 'owner':
      return {
        title: 'Know when your sitter arrives',
        body: 'Get a notification when your sitter is on the way, arrives and finishes, with photos and the report card. Also for messages and booking updates.',
      };
    case 'sitter':
      return {
        title: 'Don’t miss a visit',
        body: 'Get reminders before visits, schedule changes from the business, and messages from owners.',
      };
    case 'admin':
      return {
        title: 'Stay on top of your business',
        body: 'Get a notification for new booking requests, late check-ins, incidents and messages.',
      };
  }
}

/**
 * Whether to show the explanation now: only while the system prompt can still be
 * shown, and not within a week of the person saying "Not now".
 */
export function shouldExplainPush(input: {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  declinedAt: number | null;
  now: number;
}): boolean {
  if (input.status !== 'undetermined' || !input.canAskAgain) return false;
  return input.declinedAt === null || input.now - input.declinedAt >= ASK_AGAIN_AFTER_MS;
}
