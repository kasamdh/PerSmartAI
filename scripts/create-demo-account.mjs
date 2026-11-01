// Creates (or refreshes) the App Review demo: its own business with an admin, a
// pet owner and a sitter, a home with two pets, a confirmed daily drop-in (so
// there is always a visit today for the sitter), and yesterday's completed visit
// with a report card for the owner. Only touches the demo business.
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<from Dashboard > Settings > API; never commit it> \
//   DEMO_EMAIL_DOMAIN=yourdomain.com \
//   DEMO_PASSWORD='<12+ characters>' \
//   node scripts/create-demo-account.mjs
//
// Run it again before each submission: it resets the demo data and passwords.
// The nightly generate-visits job keeps adding a visit for every day after that.

import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  DEMO_TIMEZONE = 'America/Los_Angeles',
} = process.env;

function fail(message) {
  console.error(message);
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
if (!DEMO_EMAIL_DOMAIN) fail('Set DEMO_EMAIL_DOMAIN (a domain whose mail you receive).');
if (
  !DEMO_PASSWORD ||
  DEMO_PASSWORD.length < 12 ||
  !/\d/.test(DEMO_PASSWORD) ||
  !/[a-z]/i.test(DEMO_PASSWORD)
) {
  fail('Set DEMO_PASSWORD: at least 12 characters with letters and digits.');
}

const BUSINESS = 'App Review Demo Pet Care';
const USERS = {
  admin: { email: `appreview-admin@${DEMO_EMAIL_DOMAIN}`, full_name: 'Demo Admin' },
  owner: {
    email: `appreview-owner@${DEMO_EMAIL_DOMAIN}`,
    full_name: 'Demo Owner',
    phone: '+1 555 0100',
  },
  sitter: {
    email: `appreview-sitter@${DEMO_EMAIL_DOMAIN}`,
    full_name: 'Demo Sitter',
    phone: '+1 555 0101',
  },
};

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const must = async (label, promise) => {
  const { data, error } = await promise;
  if (error) fail(`${label}: ${error.message}`);
  return data;
};

/** The local date (YYYY-MM-DD) in the demo business's time zone, `days` from today. */
function localDate(days = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEMO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + days * 86_400_000));
  return parts;
}

async function findUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`list users: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found || data.users.length < 1000) return found ?? null;
  }
}

async function ensureUser(key, metadata) {
  const { email } = USERS[key];
  const existing = await findUser(email);
  if (existing) {
    await must(
      `reset ${key} password`,
      db.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD }),
    );
    return existing.id;
  }
  const created = await must(
    `create ${key}`,
    db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    }),
  );
  return created.user.id;
}

// 1. Admin (sign-up as a business creates the organization and admin profile).
const adminId = await ensureUser('admin', {
  signup_type: 'business',
  business_name: BUSINESS,
  timezone: DEMO_TIMEZONE,
  full_name: USERS.admin.full_name,
});
const adminProfile = await must(
  'admin profile',
  db.from('profiles').select('organization_id, role').eq('id', adminId).single(),
);
if (adminProfile.role !== 'admin')
  fail(`${USERS.admin.email} exists but is not an admin; pick another domain.`);
const org = adminProfile.organization_id;
const orgRow = await must(
  'organization',
  db.from('organizations').select('name').eq('id', org).single(),
);
if (orgRow.name !== BUSINESS)
  fail(`${USERS.admin.email} belongs to "${orgRow.name}", not the demo business.`);

// 2. Owner and sitter join through invites, like real people do.
async function ensureMember(key, role) {
  const existing = await findUser(USERS[key].email);
  if (existing) return ensureUser(key);
  const invite = await must(
    `${key} invite`,
    db
      .from('invites')
      .insert({
        organization_id: org,
        role,
        email: USERS[key].email.toLowerCase(),
        created_by: adminId,
      })
      .select('code')
      .single(),
  );
  return ensureUser(key, {
    invite_code: invite.code,
    full_name: USERS[key].full_name,
    phone: USERS[key].phone,
  });
}
const ownerId = await ensureMember('owner', 'owner');
const sitterId = await ensureMember('sitter', 'sitter');

// 3. Reset the demo data (households cascade to pets, bookings, visits, messages).
await must('clear demo homes', db.from('households').delete().eq('organization_id', org));
await must(
  'clear demo availability',
  db.from('sitter_availability').delete().eq('organization_id', org),
);

const household = await must(
  'home',
  db
    .from('households')
    .insert({
      organization_id: org,
      owner_id: ownerId,
      name: 'Demo home',
      address_line1: '1 Demo Street',
      city: 'Cupertino',
      region: 'CA',
      postal_code: '95014',
      country_code: 'US',
    })
    .select('id')
    .single(),
);
await must(
  'home access',
  db.from('household_access').insert({
    organization_id: org,
    household_id: household.id,
    entry_instructions: 'Demo only: key is in the lockbox by the front door (code 0000).',
    wifi_name: 'Demo-WiFi',
    wifi_password: 'demo-password',
  }),
);
await must(
  'emergency contact',
  db.from('emergency_contacts').insert({
    organization_id: org,
    household_id: household.id,
    name: 'Demo Neighbor',
    phone: '+1 555 0102',
    relationship: 'Neighbor',
    is_primary: true,
  }),
);

const pets = await must(
  'pets',
  db
    .from('pets')
    .insert([
      {
        organization_id: org,
        household_id: household.id,
        name: 'Biscuit',
        species: 'dog',
        breed: 'Beagle',
        sex: 'male',
        weight_kg: 11,
        temperament_notes: 'Friendly, pulls on the leash. Loves the park on Elm Street.',
        vet_name: 'Demo Animal Clinic',
        vet_phone: '+1 555 0103',
      },
      {
        organization_id: org,
        household_id: household.id,
        name: 'Mochi',
        species: 'cat',
        breed: 'Domestic shorthair',
        sex: 'female',
        temperament_notes: 'Shy at first. Hides under the bed; give her time.',
      },
    ])
    .select('id, name'),
);
const biscuit = pets.find((p) => p.name === 'Biscuit').id;
const mochi = pets.find((p) => p.name === 'Mochi').id;

await must(
  'feeding plans',
  db.from('feeding_plans').insert([
    {
      organization_id: org,
      pet_id: biscuit,
      food_brand: 'Demo Dry Food',
      amount: 1,
      unit: 'cup',
      times: ['08:00', '12:00', '18:00'],
      treats_allowed: true,
    },
    {
      organization_id: org,
      pet_id: mochi,
      food_brand: 'Demo Wet Food',
      amount: 0.5,
      unit: 'can',
      times: ['08:00', '12:00', '18:00'],
      treats_allowed: false,
    },
  ]),
);
await must(
  'allergy',
  db.from('pet_allergies').insert({
    organization_id: org,
    pet_id: mochi,
    allergen: 'Chicken',
    severity: 'severe',
    reaction_notes: 'Vomiting. Check food labels.',
  }),
);

// 4. A confirmed daily midday drop-in with the demo sitter, for 90 days.
const booking = await must(
  'daily booking',
  db
    .from('bookings')
    .insert({
      organization_id: org,
      household_id: household.id,
      sitter_id: sitterId,
      service_type: 'drop_in',
      recurrence_rule: 'FREQ=DAILY',
      start_date: localDate(0),
      end_date: localDate(90),
      window_start: '12:00',
      window_end: '14:00',
      duration_minutes: 30,
      status: 'confirmed',
      notes: 'Demo booking for App Review.',
    })
    .select('id')
    .single(),
);
await must(
  'booking pets',
  db.from('booking_pets').insert([
    { organization_id: org, booking_id: booking.id, pet_id: biscuit },
    { organization_id: org, booking_id: booking.id, pet_id: mochi },
  ]),
);

// Generate its visits now instead of waiting for tonight's job.
const generated = await fetch(`${SUPABASE_URL}/functions/v1/generate-visits`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
});
if (!generated.ok) fail(`generate-visits: ${generated.status} ${await generated.text()}`);

// 5. Yesterday's completed visit, so the owner has a report card to open.
const yesterday = await must(
  'past booking',
  db
    .from('bookings')
    .insert({
      organization_id: org,
      household_id: household.id,
      sitter_id: sitterId,
      service_type: 'drop_in',
      start_date: localDate(-1),
      end_date: localDate(-1),
      window_start: '12:00',
      duration_minutes: 30,
      status: 'completed',
    })
    .select('id')
    .single(),
);
await must(
  'past booking pets',
  db.from('booking_pets').insert([
    { organization_id: org, booking_id: yesterday.id, pet_id: biscuit },
    { organization_id: org, booking_id: yesterday.id, pet_id: mochi },
  ]),
);
const start = new Date(Date.now() - 24 * 3_600_000);
start.setUTCMinutes(0, 0, 0);
const at = (minutes) => new Date(start.getTime() + minutes * 60_000).toISOString();
const pastVisit = await must(
  'past visit',
  db
    .from('visits')
    .insert({
      organization_id: org,
      booking_id: yesterday.id,
      sitter_id: sitterId,
      scheduled_start: at(0),
      scheduled_end: at(30),
      slot_start: at(0),
      status: 'completed',
      on_the_way_at: at(-10),
      check_in_at: at(1),
      started_at: at(3),
      check_out_at: at(32),
      summary_note: 'Biscuit ate everything and we had a great walk. Mochi came out to say hi.',
    })
    .select('id')
    .single(),
);
await must(
  'past care log',
  db.from('care_events').insert([
    {
      organization_id: org,
      visit_id: pastVisit.id,
      pet_id: biscuit,
      type: 'fed',
      value: { amount_eaten: 'all' },
      occurred_at: at(5),
      created_by: sitterId,
    },
    {
      organization_id: org,
      visit_id: pastVisit.id,
      pet_id: mochi,
      type: 'fed',
      value: { amount_eaten: 'half' },
      occurred_at: at(6),
      created_by: sitterId,
    },
    {
      organization_id: org,
      visit_id: pastVisit.id,
      pet_id: biscuit,
      type: 'walk',
      value: { minutes: 20 },
      occurred_at: at(8),
      created_by: sitterId,
    },
    {
      organization_id: org,
      visit_id: pastVisit.id,
      pet_id: biscuit,
      type: 'pee',
      value: {},
      occurred_at: at(10),
      created_by: sitterId,
    },
  ]),
);
await must(
  'welcome message',
  db.from('messages').insert({
    organization_id: org,
    household_id: household.id,
    sender_id: ownerId,
    body: 'Hi! Thanks for looking after Biscuit and Mochi this week.',
  }),
);

const today = await must(
  'today',
  db
    .from('visits')
    .select('scheduled_start')
    .eq('booking_id', booking.id)
    .order('scheduled_start')
    .limit(1),
);

console.log(`
Demo ready in "${BUSINESS}" (${DEMO_TIMEZONE}).

  Pet owner:     ${USERS.owner.email}
  Sitter:        ${USERS.sitter.email}
  Business admin (web): ${USERS.admin.email}
  Password (all): the DEMO_PASSWORD you set

First visit for the sitter: ${today[0]?.scheduled_start ?? '(none generated; check generate-visits)'}
Paste docs/store/app-review-notes.md into App Store Connect and Play Console.
`);
