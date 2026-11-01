// Keeps personal data out of error reports (Sentry) in the mobile app and the
// admin web. Pet owners' addresses, messages, notes, contact details and home
// access codes must never leave the device in a crash report.
//
// Written against plain objects so it doesn't depend on Sentry's types; both
// apps pass these as beforeSend / beforeBreadcrumb.

export const FILTERED = '[Filtered]';

/** Field names whose values are personal or private, wherever they appear. */
const SENSITIVE_KEYS = new Set(
  [
    // Homes and location
    'address',
    'address_line1',
    'address_line2',
    'city',
    'region',
    'postal_code',
    'lat',
    'lng',
    'check_in_lat',
    'check_in_lng',
    'check_out_lat',
    'check_out_lng',
    'latitude',
    'longitude',
    'coords',
    'entry_instructions',
    'alarm_notes',
    'wifi_name',
    'wifi_password',
    // People
    'full_name',
    'name',
    'email',
    'phone',
    'vet_phone',
    'vet_address',
    // Free text people write
    'body',
    'message',
    'messages',
    'text',
    'note',
    'notes',
    'summary',
    'summary_note',
    'status_line',
    'description',
    'action_taken',
    'resolution_note',
    'reason',
    'decline_reason',
    'caption',
    'instructions',
    'temperament_notes',
    'reaction_notes',
    // Credentials
    'password',
    'access_token',
    'refresh_token',
    'token',
    'authorization',
    'cookie',
    'apikey',
    'code',
    'p_code',
    'invite_code',
  ].map((k) => k.toLowerCase()),
);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phone numbers: 7+ digits with spaces, dots or dashes, optionally "(555) " or "+1".
const PHONE = /(?<![\w-])(?:\(\d{3}\)\s?|\+?\d)[\d\s.-]{5,}\d(?![\w-])/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

/** Removes emails, phone numbers and tokens from free text (error messages). */
export function redactText(text: string): string {
  return text.replace(JWT, FILTERED).replace(EMAIL, FILTERED).replace(PHONE, FILTERED);
}

/** Drops the query string and fragment, which can hold search text and filters. */
export function scrubUrl(url: string): string {
  return url.replace(/[?#].*$/, '');
}

/** Deep copy with sensitive fields filtered and strings redacted. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return FILTERED;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? FILTERED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export type Breadcrumb = {
  category?: string;
  message?: string;
  data?: Obj;
  [key: string]: unknown;
};

/**
 * Breadcrumbs: console output is dropped (it can print anything), request URLs
 * lose their query strings, and request bodies never appear.
 */
export function scrubBreadcrumb<B extends object>(breadcrumb: B): B | null {
  if ((breadcrumb as Breadcrumb).category === 'console') return null;
  const out: Breadcrumb = { ...(breadcrumb as Breadcrumb) };
  if (typeof out.message === 'string') out.message = redactText(out.message);
  if (isObj(out.data)) {
    const data: Obj = {};
    for (const [key, v] of Object.entries(out.data)) {
      if (key === 'url' || key === 'from' || key === 'to') {
        data[key] = typeof v === 'string' ? scrubUrl(v) : v;
      } else if (['method', 'status_code', 'reason', 'type'].includes(key)) {
        data[key] = key === 'reason' ? FILTERED : v;
      } else if (
        key === 'body' ||
        key === 'request_body' ||
        key === 'response_body' ||
        key === 'input'
      ) {
        continue;
      } else {
        data[key] = scrubValue(v);
      }
    }
    out.data = data;
  }
  return out as B;
}

/**
 * Error events: no request bodies, cookies or headers, user reduced to an id,
 * no IP, messages and extra data scrubbed.
 */
export function scrubEvent<E extends object>(event: E): E {
  const out: Obj = { ...(event as Obj) };

  if (isObj(out.request)) {
    const request: Obj = {};
    if (typeof out.request.url === 'string') request.url = scrubUrl(out.request.url);
    if (typeof out.request.method === 'string') request.method = out.request.method;
    out.request = request;
  }

  if (isObj(out.user)) {
    out.user = typeof out.user.id === 'string' ? { id: out.user.id } : undefined;
  }

  if (typeof out.message === 'string') out.message = redactText(out.message);
  if (isObj(out.logentry) && typeof out.logentry.message === 'string') {
    out.logentry = { ...out.logentry, message: redactText(out.logentry.message) };
  }

  if (isObj(out.exception) && Array.isArray(out.exception.values)) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((ex: unknown) =>
        isObj(ex) && typeof ex.value === 'string' ? { ...ex, value: redactText(ex.value) } : ex,
      ),
    };
  }

  for (const key of ['extra', 'contexts', 'tags'] as const) {
    if (isObj(out[key])) out[key] = scrubValue(out[key]);
  }

  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs
      .map((b) => (isObj(b) ? scrubBreadcrumb(b) : null))
      .filter((b) => b !== null);
  }

  return out as E;
}
