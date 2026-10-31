// Notification wording for owner push messages. Pure TypeScript with no imports,
// shared by the notify-owner Edge Function (Deno) and the app's Jest tests.

export type PushEvent =
  | { type: 'visit_status'; visit_id: string; status: string }
  | { type: 'visit_photo'; visit_id: string; media_id: string }
  | { type: 'incident'; visit_id: string; incident_id: string };

export type PushContext = {
  sitterName: string | null;
  petNames: string[];
};

export type PushMessage = {
  title: string;
  body: string;
  data: { visitId: string; type: PushEvent['type'] };
};

/** "Biscuit", "Biscuit & Mochi", "Biscuit, Mochi & Rex"; "your pets" when empty. */
export function joinNames(names: string[]): string {
  if (names.length === 0) return 'your pets';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function buildPushMessage(event: PushEvent, context: PushContext): PushMessage | null {
  const sitter = context.sitterName?.split(' ')[0] || 'Your sitter';
  const pets = joinNames(context.petNames);
  const data = { visitId: event.visit_id, type: event.type };

  switch (event.type) {
    case 'visit_status':
      switch (event.status) {
        case 'on_the_way':
          return { title: `${sitter} is on the way`, body: `Heading over to see ${pets}.`, data };
        case 'in_progress':
          return {
            title: `${sitter} checked in`,
            body: `${pets} ${context.petNames.length === 1 ? 'is' : 'are'} in good hands.`,
            data,
          };
        case 'completed':
          return {
            title: 'Visit finished',
            body: `${sitter} checked out. See how ${pets} did.`,
            data,
          };
        default:
          return null;
      }
    case 'visit_photo':
      return { title: `New photo of ${pets}`, body: `From ${sitter}. Tap to see it.`, data };
    case 'incident':
      return {
        title: 'Incident during a visit',
        body: `${sitter} reported an incident with ${pets}. Tap for details.`,
        data,
      };
  }
}
