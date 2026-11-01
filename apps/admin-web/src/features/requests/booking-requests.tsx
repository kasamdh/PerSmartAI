'use client';

import { describeSchedule } from '@petsitter/shared/booking-text';
import { schedulingErrorText } from '@petsitter/shared/schedule-actions';
import { describeChangeRequest, rankSitterOptions } from '@petsitter/shared/schedule-logic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Badge, Button, Card, Empty, PageHeader, QueryState, inputClass } from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import { SERVICE_LABELS, errorMessage, formatDateTime } from '@/lib/format';
import { useLiveQueries } from '@/lib/live';
import { fetchSitters, scheduleAction, sitterKeys, type Sitter } from '@/lib/schedule';

import {
  declineBooking,
  fetchBookingRequests,
  fetchChangeRequests,
  requestKeys,
  type BookingRequest,
  type ChangeRequest,
} from './api';

export function BookingRequests() {
  const bookings = useQuery({ queryKey: requestKeys.bookings, queryFn: fetchBookingRequests });
  const changes = useQuery({ queryKey: requestKeys.changes, queryFn: fetchChangeRequests });
  const sitters = useQuery({ queryKey: sitterKeys.all, queryFn: fetchSitters });
  useLiveQueries(
    ['bookings', 'schedule_change_requests'],
    [requestKeys.bookings, requestKeys.changes],
  );

  return (
    <>
      <PageHeader title="Booking requests" />
      <div className="space-y-6">
        <Card title={`New bookings${bookings.data ? ` (${bookings.data.length})` : ''}`}>
          <QueryState
            isPending={bookings.isPending}
            error={bookings.error}
            onRetry={() => bookings.refetch()}
          />
          {bookings.data?.length === 0 ? <Empty>No requests waiting.</Empty> : null}
          <ul className="space-y-4">
            {bookings.data?.map((b) => (
              <BookingRequestItem key={b.id} booking={b} sitters={sitters.data ?? []} />
            ))}
          </ul>
        </Card>

        <Card title={`Reschedule requests${changes.data ? ` (${changes.data.length})` : ''}`}>
          <QueryState
            isPending={changes.isPending}
            error={changes.error}
            onRetry={() => changes.refetch()}
          />
          {changes.data?.length === 0 ? <Empty>No reschedule requests.</Empty> : null}
          <ul className="space-y-4">
            {changes.data?.map((r) => (
              <ChangeRequestItem key={r.id} request={r} />
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

const stateTone = { free: 'green', warning: 'amber', blocked: 'red', checking: 'gray' } as const;

function BookingRequestItem({
  booking,
  sitters,
}: {
  booking: BookingRequest;
  sitters: readonly Sitter[];
}) {
  const queryClient = useQueryClient();
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // check_sitters runs the full conflict check for every visit in the booking.
  const checks = useQuery({
    queryKey: ['requests', 'check', booking.id, sitters.map((s) => s.id)],
    queryFn: async () =>
      (
        await scheduleAction('check_sitters', {
          booking_id: booking.id,
          sitter_ids: sitters.map((s) => s.id),
        })
      ).results,
    enabled: choosing && sitters.length > 0,
    retry: false,
  });
  const options = rankSitterOptions(sitters, checks.data);
  const done = () => queryClient.invalidateQueries({ queryKey: ['requests'] });

  const confirm = useMutation({
    mutationFn: (sitterId: string) =>
      scheduleAction('confirm', { booking_id: booking.id, sitter_id: sitterId }),
    onSuccess: done,
  });
  const decline = useMutation({ mutationFn: () => declineBooking(booking.id), onSuccess: done });

  const household = booking.household;
  const pets = booking.booking_pets
    .map((bp) => bp.pet?.name)
    .filter(Boolean)
    .join(', ');
  const chosen = options.find((o) => o.id === selected);

  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {SERVICE_LABELS[booking.service_type]} ·{' '}
            {household ? (
              <Link className="hover:underline" href={`/clients/${household.id}`}>
                {household.name ?? household.address_line1}
              </Link>
            ) : null}
          </div>
          <div className="text-sm text-gray-700">{describeSchedule(booking)}</div>
          <div className="text-sm text-gray-600">
            {pets || 'No pets listed'}
            {booking.duration_minutes ? ` · ${booking.duration_minutes} min` : ''}
            {household?.owner ? ` · ${household.owner.full_name}` : ''}
            {household?.owner?.phone ? ` (${household.owner.phone})` : ''}
          </div>
          {booking.notes ? (
            <p className="mt-1 text-sm italic text-gray-600">“{booking.notes}”</p>
          ) : null}
        </div>
        {!choosing ? (
          <div className="flex gap-2">
            <Button onClick={() => setChoosing(true)}>Assign a sitter</Button>
            <Button
              variant="secondary"
              disabled={decline.isPending}
              onClick={() => decline.mutate()}
            >
              Decline
            </Button>
          </div>
        ) : null}
      </div>
      {decline.error ? (
        <p className="mt-2 text-sm text-red-700">{errorMessage(decline.error)}</p>
      ) : null}

      {choosing ? (
        <div className="mt-4">
          {sitters.length === 0 ? (
            <Empty>No sitters yet. Invite one from the Sitters page.</Empty>
          ) : null}
          {checks.error ? (
            <p className="text-sm text-red-700">{schedulingErrorText(checks.error)}</p>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Choose a sitter</legend>
            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    selected === o.id ? 'border-brand bg-brand/5' : 'border-gray-200'
                  } ${o.state === 'blocked' ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <input
                    type="radio"
                    name={`sitter-${booking.id}`}
                    className="mt-1"
                    disabled={o.state === 'blocked' || o.state === 'checking'}
                    checked={selected === o.id}
                    onChange={() => setSelected(o.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {o.full_name} <Badge tone={stateTone[o.state]}>{o.state}</Badge>
                    </span>
                    <span className="block text-sm text-gray-600">{o.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {confirm.error ? (
            <p role="alert" className="mt-2 whitespace-pre-line text-sm text-red-700">
              {schedulingErrorText(confirm.error)}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!chosen || confirm.isPending}
              onClick={() => chosen && confirm.mutate(chosen.id)}
            >
              {confirm.isPending
                ? 'Confirming…'
                : chosen
                  ? `Confirm with ${chosen.full_name}`
                  : 'Confirm'}
            </Button>
            <Button variant="ghost" onClick={() => setChoosing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ChangeRequestItem({ request }: { request: ChangeRequest }) {
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      scheduleAction('decide_request', {
        request_id: request.id,
        approve,
        decline_reason: approve ? undefined : reason.trim() || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });
  const household = request.booking?.household;

  return (
    <li className="rounded-xl border border-gray-200 p-4">
      <div className="font-semibold">
        {household?.name ?? household?.address_line1}
        {household?.owner ? (
          <span className="font-normal text-gray-600"> · {household.owner.full_name}</span>
        ) : null}
      </div>
      <div className="text-sm text-gray-700">
        {request.visit
          ? `Visit on ${formatDateTime(request.visit.scheduled_start, org.timeZone)}: `
          : 'This and future visits: '}
        {describeChangeRequest({
          scope: request.scope,
          from_date: request.from_date,
          changes: (request.changes ?? {}) as Record<string, unknown>,
        })}
      </div>
      {request.note ? <p className="mt-1 text-sm italic text-gray-600">“{request.note}”</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button disabled={decide.isPending} onClick={() => decide.mutate(true)}>
          Approve
        </Button>
        <input
          aria-label="Reason for declining (optional)"
          placeholder="Reason for declining (optional)"
          className={`${inputClass} max-w-xs`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={decide.isPending}
          onClick={() => decide.mutate(false)}
        >
          Decline
        </Button>
      </div>
      {decide.error ? (
        <p role="alert" className="mt-2 whitespace-pre-line text-sm text-red-700">
          {schedulingErrorText(decide.error)}
        </p>
      ) : null}
    </li>
  );
}
