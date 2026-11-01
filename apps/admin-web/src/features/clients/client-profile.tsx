'use client';

import { describeSchedule } from '@petsitter/shared/booking-text';
import { allergyBanner, formatTimeOfDay, kgToLb, petAge } from '@petsitter/shared/pets';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Badge, Card, Empty, PageHeader, QueryState } from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import { SERVICE_LABELS, STATUS_LABELS, formatDateTime } from '@/lib/format';

import { clientKeys, fetchClient, type ClientProfile as Profile } from './api';

type Pet = Profile['pets'][number];

export function ClientProfile({ householdId }: { householdId: string }) {
  const { org } = useOrg();
  const profile = useQuery({
    queryKey: clientKeys.detail(householdId),
    queryFn: () => fetchClient(householdId, new Date()),
  });

  if (profile.isPending || profile.error) {
    return (
      <QueryState
        isPending={profile.isPending}
        error={profile.error}
        onRetry={() => profile.refetch()}
      />
    );
  }
  if (!profile.data) {
    return (
      <Card>
        <Empty>
          This household doesn’t exist or isn’t part of your business.{' '}
          <Link href="/clients">Back to clients</Link>
        </Empty>
      </Card>
    );
  }

  const { household, access, contacts, pets, bookings, visits } = profile.data;
  const address = [
    household.address_line1,
    household.address_line2,
    household.city,
    household.region,
    household.postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/clients" className="text-brand-ink hover:underline">
          ← Clients
        </Link>
      </p>
      <PageHeader title={household.name ?? household.owner?.full_name ?? household.address_line1} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {pets.length === 0 ? (
            <Card>
              <Empty>No pets added yet.</Empty>
            </Card>
          ) : null}
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>

        <div className="space-y-6">
          <Card title="Owner & home">
            <Facts
              rows={[
                ['Owner', household.owner?.full_name],
                [
                  'Phone',
                  household.owner?.phone ? (
                    <a href={`tel:${household.owner.phone}`}>{household.owner.phone}</a>
                  ) : null,
                ],
                ['Address', address],
                ['Client since', formatDateTime(household.created_at, org.timeZone)],
              ]}
            />
          </Card>

          <Card title="Emergency contacts">
            {contacts.length === 0 ? <Empty>None added.</Empty> : null}
            <ul className="space-y-2 text-sm">
              {contacts.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.name}</span>
                  {c.relationship ? ` (${c.relationship})` : ''} ·{' '}
                  <a href={`tel:${c.phone}`}>{c.phone}</a>{' '}
                  {c.is_primary ? <Badge tone="blue">Primary</Badge> : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Home access">
            {access ? (
              <Facts
                rows={[
                  ['Entry', access.entry_instructions],
                  ['Alarm', access.alarm_notes],
                  ['Wi-Fi', access.wifi_name],
                  ['Wi-Fi password', access.wifi_password],
                ]}
              />
            ) : (
              <Empty>No access details.</Empty>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Sitters see these only from 24 hours before a visit until 24 hours after.
            </p>
          </Card>

          <Card title="Visits (last 2 weeks and upcoming)">
            {visits.length === 0 ? <Empty>No visits.</Empty> : null}
            <ul className="divide-y divide-gray-100 text-sm">
              {visits.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {formatDateTime(v.scheduled_start, org.timeZone)} ·{' '}
                    {SERVICE_LABELS[v.booking.service_type]}
                    <span className="text-gray-500"> · {v.sitter?.full_name ?? 'No sitter'}</span>
                  </span>
                  <Badge
                    tone={
                      v.status === 'completed' ? 'green' : v.status === 'missed' ? 'red' : 'gray'
                    }
                  >
                    {STATUS_LABELS[v.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Bookings">
            {bookings.length === 0 ? <Empty>No bookings.</Empty> : null}
            <ul className="divide-y divide-gray-100 text-sm">
              {bookings.map((b) => (
                <li key={b.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{SERVICE_LABELS[b.service_type]}</span>
                    <Badge
                      tone={
                        b.status === 'confirmed'
                          ? 'green'
                          : b.status === 'requested'
                            ? 'amber'
                            : 'gray'
                      }
                    >
                      {b.status}
                    </Badge>
                  </div>
                  <div className="text-gray-600">{describeSchedule(b)}</div>
                  <div className="text-gray-500">{b.sitter?.full_name ?? 'No sitter yet'}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function PetCard({ pet }: { pet: Pet }) {
  const banner = allergyBanner(pet.pet_allergies);
  const age = petAge(pet.birth_date, new Date());
  return (
    <Card>
      {/* The allergy banner stays the first thing in every pet view, with no way to hide it. */}
      {banner ? (
        <div
          role="alert"
          aria-label={banner.accessibilityLabel}
          className="mb-4 rounded-xl bg-red-700 p-3 text-white"
        >
          <div className="text-sm font-semibold uppercase tracking-wide">Allergies</div>
          <ul className="mt-1 text-sm">
            {banner.items.map((i) => (
              <li key={i.allergen} className={i.emphasized ? 'font-bold' : ''}>
                {i.allergen} ({i.severity}){i.notes ? `: ${i.notes}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-4">
        {pet.photoUrl ? (
          // Signed storage URL (expires after an hour).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.photoUrl}
            alt={pet.name}
            className="h-24 w-24 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-3xl font-bold text-gray-500">
            {pet.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{pet.name}</h2>
          <p className="text-sm text-gray-600">
            {[pet.species, pet.breed, pet.sex !== 'unknown' ? pet.sex : null, age]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-sm text-gray-600">
            {[
              pet.weight_kg ? `${Math.round(kgToLb(pet.weight_kg))} lb` : null,
              pet.spayed_neutered === null
                ? null
                : pet.spayed_neutered
                  ? 'Spayed/neutered'
                  : 'Not spayed/neutered',
              pet.microchip ? `Chip ${pet.microchip}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {pet.temperament_notes ? <p className="mt-4 text-sm">{pet.temperament_notes}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section>
          <h3 className="mb-1 text-sm font-semibold">Medications</h3>
          {pet.pet_medications.length === 0 ? <Empty>None.</Empty> : null}
          <ul className="space-y-1 text-sm">
            {pet.pet_medications.map((m) => (
              <li key={m.id}>
                <span className="font-medium">{m.name}</span>
                {m.dose ? ` · ${m.dose}` : ''}
                {m.schedule_times.length
                  ? ` · ${m.schedule_times.map(formatTimeOfDay).join(', ')}`
                  : ''}
                {m.instructions ? (
                  <span className="block text-gray-600">{m.instructions}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold">Feeding</h3>
          {pet.feeding_plans.length === 0 ? <Empty>No feeding plan.</Empty> : null}
          <ul className="space-y-1 text-sm">
            {pet.feeding_plans.map((f) => (
              <li key={f.id}>
                <span className="font-medium">{f.food_brand ?? 'Food'}</span>
                {f.amount ? ` · ${f.amount} ${f.unit ?? ''}` : ''}
                {f.times.length ? ` · ${f.times.map(formatTimeOfDay).join(', ')}` : ''}
                {f.treats_allowed ? ' · treats OK' : ' · no treats'}
                {f.notes ? <span className="block text-gray-600">{f.notes}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {pet.vet_name || pet.vet_phone ? (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Vet:</span> {pet.vet_name}
          {pet.vet_phone ? (
            <>
              {' · '}
              <a href={`tel:${pet.vet_phone}`}>{pet.vet_phone}</a>
            </>
          ) : null}
          {pet.vet_address ? ` · ${pet.vet_address}` : ''}
        </p>
      ) : null}
    </Card>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, value]) => value);
  if (shown.length === 0) return <Empty>Nothing added.</Empty>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
