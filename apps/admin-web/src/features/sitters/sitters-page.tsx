'use client';

import { weekStart } from '@petsitter/shared/calendar';
import { formatInviteCode } from '@petsitter/shared/invite-code';
import { decimalHours, payrollCsv, weeklyPayroll } from '@petsitter/shared/payroll';
import { formatClock } from '@petsitter/shared/booking-text';
import { addDays, localToday } from '@petsitter/shared/scheduling';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';

import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  PageHeader,
  QueryState,
  inputClass,
} from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import { errorMessage, formatDateTime, formatDay } from '@/lib/format';
import { useLiveQueries } from '@/lib/live';
import { fetchSitters, sitterKeys, type Sitter } from '@/lib/schedule';

import {
  createInvite,
  decideTimeOff,
  fetchAvailability,
  fetchPayrollVisits,
  fetchPendingInvites,
  fetchTimeOff,
  revokeInvite,
  sittersPageKeys,
  type TimeOff,
} from './api';

export function SittersPage() {
  const sitters = useQuery({ queryKey: sitterKeys.all, queryFn: fetchSitters });
  useLiveQueries(
    ['sitter_time_off', 'sitter_availability'],
    [sittersPageKeys.timeOff, sittersPageKeys.availability],
  );

  return (
    <>
      <PageHeader title="Sitters" />
      <div className="space-y-6">
        <TimeOffSection />
        <PayrollSection sitters={sitters.data ?? []} />
        <AvailabilitySection sitters={sitters.data ?? []} />
        <InviteSection />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Time off
// ---------------------------------------------------------------------------

function TimeOffSection() {
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const timeOff = useQuery({
    queryKey: sittersPageKeys.timeOff,
    queryFn: () => fetchTimeOff(new Date()),
  });
  const decide = useMutation({
    mutationFn: decideTimeOff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sittersPageKeys.timeOff }),
  });
  const requested = timeOff.data?.filter((t) => t.status === 'requested') ?? [];
  const approved = timeOff.data?.filter((t) => t.status === 'approved') ?? [];
  const range = (t: TimeOff) =>
    `${formatDateTime(t.start_at, org.timeZone)} – ${formatDateTime(t.end_at, org.timeZone)}`;

  return (
    <Card title={`Time off requests${requested.length ? ` (${requested.length})` : ''}`}>
      <QueryState
        isPending={timeOff.isPending}
        error={timeOff.error}
        onRetry={() => timeOff.refetch()}
      />
      {timeOff.data && requested.length === 0 ? <Empty>No requests waiting.</Empty> : null}
      <ul className="space-y-3">
        {requested.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"
          >
            <div>
              <div className="font-medium">{t.sitter?.full_name}</div>
              <div className="text-sm text-gray-600">{range(t)}</div>
              {t.reason ? <div className="text-sm italic text-gray-600">“{t.reason}”</div> : null}
            </div>
            <div className="flex gap-2">
              <Button
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: t.id, approve: true })}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: t.id, approve: false })}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {decide.error ? (
        <p className="mt-2 text-sm text-red-700">{errorMessage(decide.error)}</p>
      ) : null}
      {approved.length > 0 ? (
        <>
          <h3 className="mt-5 mb-2 text-sm font-semibold">Approved, coming up</h3>
          <ul className="space-y-1 text-sm text-gray-700">
            {approved.map((t) => (
              <li key={t.id}>
                {t.sitter?.full_name}: {range(t)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Hours and visit counts per week (payroll)
// ---------------------------------------------------------------------------

function PayrollSection({ sitters }: { sitters: readonly Sitter[] }) {
  const { org } = useOrg();
  const [monday, setMonday] = useState(() => weekStart(localToday(new Date(), org.timeZone)));
  const visits = useQuery({
    queryKey: sittersPageKeys.payroll(monday),
    queryFn: () => fetchPayrollVisits(monday, org.timeZone),
  });
  const payroll = useMemo(
    () => weeklyPayroll(visits.data ?? [], sitters, monday, org.timeZone),
    [visits.data, sitters, monday, org.timeZone],
  );
  const totals = payroll.rows.reduce(
    (t, r) => ({
      scheduled: t.scheduled + r.scheduledVisits,
      completed: t.completed + r.completedVisits,
      missed: t.missed + r.missedVisits,
      scheduledMinutes: t.scheduledMinutes + r.scheduledMinutes,
      workedMinutes: t.workedMinutes + r.workedMinutes,
    }),
    { scheduled: 0, completed: 0, missed: 0, scheduledMinutes: 0, workedMinutes: 0 },
  );

  const download = () => {
    const blob = new Blob([payrollCsv(payroll.rows, monday)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-${monday}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title="Hours & visits"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            aria-label="Previous week"
            onClick={() => setMonday(addDays(monday, -7))}
          >
            ←
          </Button>
          <span className="text-sm font-medium">
            {formatDay(monday)} – {formatDay(addDays(monday, 6))}
          </span>
          <Button
            variant="secondary"
            aria-label="Next week"
            onClick={() => setMonday(addDays(monday, 7))}
          >
            →
          </Button>
          <Button onClick={download} disabled={!visits.data || payroll.rows.length === 0}>
            Export CSV
          </Button>
        </div>
      }
    >
      <QueryState
        isPending={visits.isPending}
        error={visits.error}
        onRetry={() => visits.refetch()}
      />
      {visits.data ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-gray-600">
              <tr>
                <th className="p-2 font-medium">Sitter</th>
                <th className="p-2 text-right font-medium">Scheduled</th>
                <th className="p-2 text-right font-medium">Completed</th>
                <th className="p-2 text-right font-medium">Missed</th>
                <th className="p-2 text-right font-medium">Scheduled hours</th>
                <th className="p-2 text-right font-medium">Worked hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payroll.rows.map((r) => (
                <tr key={r.sitterId}>
                  <td className="p-2 font-medium">{r.name}</td>
                  <td className="p-2 text-right">{r.scheduledVisits}</td>
                  <td className="p-2 text-right">{r.completedVisits}</td>
                  <td
                    className={`p-2 text-right ${r.missedVisits ? 'font-semibold text-red-700' : ''}`}
                  >
                    {r.missedVisits}
                  </td>
                  <td className="p-2 text-right">{decimalHours(r.scheduledMinutes)}</td>
                  <td className="p-2 text-right">{decimalHours(r.workedMinutes)}</td>
                </tr>
              ))}
            </tbody>
            {payroll.rows.length > 1 ? (
              <tfoot className="border-t-2 border-gray-200 font-semibold">
                <tr>
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right">{totals.scheduled}</td>
                  <td className="p-2 text-right">{totals.completed}</td>
                  <td className="p-2 text-right">{totals.missed}</td>
                  <td className="p-2 text-right">{decimalHours(totals.scheduledMinutes)}</td>
                  <td className="p-2 text-right">{decimalHours(totals.workedMinutes)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
          <p className="mt-3 text-xs text-gray-500">
            Weeks run Monday to Sunday in {org.timeZone}. Worked hours are check-in to check-out of
            completed visits.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

function AvailabilitySection({ sitters }: { sitters: readonly Sitter[] }) {
  const availability = useQuery({
    queryKey: sittersPageKeys.availability,
    queryFn: fetchAvailability,
  });
  const { org } = useOrg();
  return (
    <Card title="Weekly availability">
      <QueryState
        isPending={availability.isPending}
        error={availability.error}
        onRetry={() => availability.refetch()}
      />
      {availability.data ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-gray-600">
              <tr>
                <th className="p-2 font-medium">Sitter</th>
                {MONDAY_FIRST.map((d) => (
                  <th key={d} className="p-2 font-medium">
                    {WEEKDAY_NAMES[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sitters.map((s) => {
                const mine = availability.data.filter((a) => a.sitter_id === s.id);
                return (
                  <tr key={s.id} className="align-top">
                    <td className="p-2 font-medium">
                      {s.full_name}
                      {mine.length === 0 ? (
                        <span className="block">
                          <Badge tone="amber">Not set</Badge>
                        </span>
                      ) : null}
                    </td>
                    {MONDAY_FIRST.map((d) => (
                      <td key={d} className="p-2 text-xs tabular-nums text-gray-700">
                        {mine
                          .filter((a) => a.weekday === d)
                          .map((a) => (
                            <span key={a.id} className="block">
                              {formatClock(a.start_time.slice(0, 5))}–
                              {formatClock(a.end_time.slice(0, 5))}
                            </span>
                          ))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            Sitters set their hours in the app ({org.timeZone}). Visits outside them are blocked;
            sitters with no hours set get a warning instead.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

function InviteSection() {
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const invites = useQuery({ queryKey: sittersPageKeys.invites, queryFn: fetchPendingInvites });
  const [role, setRole] = useState<'sitter' | 'owner'>('sitter');
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: sittersPageKeys.invites });
  const create = useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      setEmail('');
      void refresh();
    },
  });
  const revoke = useMutation({ mutationFn: revokeInvite, onSuccess: refresh });

  const message = (code: string, inviteRole: string) =>
    [
      `You're invited to join ${org.name} on Petsitters ${inviteRole === 'sitter' ? 'as a sitter' : 'to manage your pets’ visits'}.`,
      `Open the Petsitters app, tap "I have an invite code" and enter: ${formatInviteCode(code)}`,
    ].join('\n\n');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ role, email });
  };

  return (
    <Card title="Invite people">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <Field label="Invite a">
          <select
            className={inputClass}
            value={role}
            onChange={(e) => setRole(e.target.value as 'sitter' | 'owner')}
          >
            <option value="sitter">Sitter</option>
            <option value="owner">Client (pet owner)</option>
          </select>
        </Field>
        <div className="min-w-60 flex-1">
          <Field label="Email (optional)" hint="Only this email can use the code, if given.">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create invite code'}
        </Button>
      </form>
      {create.error ? (
        <p className="mt-2 text-sm text-red-700">{errorMessage(create.error)}</p>
      ) : null}

      <h3 className="mt-6 mb-2 text-sm font-semibold">Pending invites</h3>
      <QueryState
        isPending={invites.isPending}
        error={invites.error}
        onRetry={() => invites.refetch()}
      />
      {invites.data?.length === 0 ? <Empty>No pending invites.</Empty> : null}
      <ul className="divide-y divide-gray-100">
        {invites.data?.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <span className="font-mono text-lg font-bold tracking-wider">
                {formatInviteCode(i.code)}
              </span>{' '}
              <Badge tone={i.role === 'sitter' ? 'blue' : 'gray'}>{i.role}</Badge>
              <div className="text-xs text-gray-500">
                {i.email ? `${i.email} · ` : ''}expires {formatDateTime(i.expires_at, org.timeZone)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(message(i.code, i.role))
                    .then(() => setCopied(i.id))
                }
              >
                {copied === i.id ? 'Copied' : 'Copy message'}
              </Button>
              <Button
                variant="ghost"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(i.id)}
              >
                Revoke
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
