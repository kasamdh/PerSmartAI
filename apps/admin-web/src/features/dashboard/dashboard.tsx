'use client';

import { checkInTiming, sortForBoard } from '@petsitter/shared/live-board';
import { localToday } from '@petsitter/shared/scheduling';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge, Button, Card, Empty, PageHeader, QueryState, inputClass } from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import {
  SERVICE_LABELS,
  STATUS_LABELS,
  errorMessage,
  formatDateTime,
  formatTimeRange,
} from '@/lib/format';
import { useLiveQueries, useNow } from '@/lib/live';

import {
  dashboardKeys,
  fetchOpenIncidents,
  fetchTodaysVisits,
  pageTitle,
  resolveIncident,
  type DashboardVisit,
  type OpenIncident,
} from './api';

const statusTone = (status: string) =>
  status === 'completed'
    ? 'green'
    : status === 'missed'
      ? 'red'
      : status === 'scheduled'
        ? 'gray'
        : 'blue';

const severityTone = { minor: 'gray', moderate: 'amber', severe: 'red', emergency: 'red' } as const;

export function Dashboard() {
  const { org } = useOrg();
  const now = useNow();
  // A new list at the business's midnight.
  const today = localToday(now, org.timeZone);
  const visits = useQuery({
    queryKey: [...dashboardKeys.visits, today],
    queryFn: () => fetchTodaysVisits(new Date(), org.timeZone),
  });
  const incidents = useQuery({ queryKey: dashboardKeys.incidents, queryFn: fetchOpenIncidents });
  useLiveQueries(['visits', 'incidents'], [dashboardKeys.visits, dashboardKeys.incidents]);

  const sorted = useMemo(() => sortForBoard(visits.data ?? [], now), [visits.data, now]);
  const late = sorted.filter((v) => checkInTiming(v, now).late && !v.check_in_at).length;
  const active = sorted.filter((v) => ['on_the_way', 'arrived', 'in_progress'].includes(v.status));
  const done = sorted.filter((v) => v.status === 'completed').length;

  return (
    <>
      <PageHeader title="Today" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visits today" value={sorted.length} />
        <Stat label="Under way" value={active.length} />
        <Stat label="Completed" value={done} />
        <Stat label="Late check-ins" value={late} alert={late > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card
          title="Today's visits"
          actions={<span className="text-xs text-gray-500">Live · {org.timeZone}</span>}
        >
          <QueryState
            isPending={visits.isPending}
            error={visits.error}
            onRetry={() => visits.refetch()}
          />
          {visits.data && sorted.length === 0 ? <Empty>No visits today.</Empty> : null}
          <ul className="divide-y divide-gray-100">
            {sorted.map((v) => (
              <VisitRow key={v.id} visit={v} now={now} timeZone={org.timeZone} />
            ))}
          </ul>
        </Card>

        <Card title="Open incidents">
          <QueryState
            isPending={incidents.isPending}
            error={incidents.error}
            onRetry={() => incidents.refetch()}
          />
          {incidents.data?.length === 0 ? <Empty>No open incidents.</Empty> : null}
          <ul className="space-y-3">
            {incidents.data?.map((i) => (
              <IncidentItem key={i.id} incident={i} timeZone={org.timeZone} />
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${alert ? 'bg-red-700 text-white' : 'bg-white'}`}>
      <div className={`text-sm ${alert ? 'text-red-50' : 'text-gray-600'}`}>{label}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function VisitRow({
  visit,
  now,
  timeZone,
}: {
  visit: DashboardVisit;
  now: Date;
  timeZone: string;
}) {
  const timing = checkInTiming(visit, now);
  const pets = visit.booking?.booking_pets
    .map((bp) => bp.pet?.name)
    .filter(Boolean)
    .join(', ');
  const household = visit.booking?.household ?? null;
  return (
    <li
      className={`flex flex-wrap items-start gap-x-4 gap-y-1 py-3 ${timing.late ? '-mx-2 rounded-lg bg-red-50 px-2' : ''}`}
    >
      <div className="w-36 shrink-0 text-sm font-semibold tabular-nums">
        {formatTimeRange(visit.scheduled_start, visit.scheduled_end, timeZone)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {household ? (
            <Link href={`/clients/${household.id}`} className="hover:underline">
              {pageTitle(household)}
            </Link>
          ) : (
            'Unknown home'
          )}
          <span className="font-normal text-gray-600">
            {' '}
            · {SERVICE_LABELS[visit.booking?.service_type ?? ''] ?? 'Visit'}
            {pets ? ` · ${pets}` : ''}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {visit.sitter?.full_name ?? (
            <span className="font-semibold text-amber-800">No sitter assigned</span>
          )}
          {visit.status_line ? <span className="italic"> · “{visit.status_line}”</span> : null}
        </div>
        {timing.late ? (
          <div className="text-sm font-semibold text-red-700" role="status">
            {timing.label}
          </div>
        ) : null}
      </div>
      <Badge tone={timing.late && !visit.check_in_at ? 'red' : statusTone(visit.status)}>
        {STATUS_LABELS[visit.status] ?? visit.status}
      </Badge>
    </li>
  );
}

function IncidentItem({ incident, timeZone }: { incident: OpenIncident; timeZone: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const resolve = useMutation({
    mutationFn: resolveIncident,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardKeys.incidents }),
  });
  const household = incident.visit?.booking?.household ?? null;

  return (
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={severityTone[incident.severity]}>{incident.severity}</Badge>
        <span className="text-xs text-gray-500">
          {formatDateTime(incident.created_at, timeZone)}
        </span>
      </div>
      <p className="mt-2 text-sm">{incident.description}</p>
      {incident.action_taken ? (
        <p className="mt-1 text-sm text-gray-600">Action taken: {incident.action_taken}</p>
      ) : null}
      <p className="mt-1 text-xs text-gray-500">
        {pageTitle(household)}
        {incident.pet ? ` · ${incident.pet.name}` : ''}
        {incident.visit?.sitter ? ` · ${incident.visit.sitter.full_name}` : ''}
      </p>
      {open ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            resolve.mutate({ id: incident.id, note });
          }}
        >
          <textarea
            aria-label="Resolution note"
            placeholder="What was done (optional)"
            className={inputClass}
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {resolve.error ? (
            <p className="text-sm text-red-700">{errorMessage(resolve.error)}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={resolve.isPending}>
              {resolve.isPending ? 'Saving…' : 'Mark resolved'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Resolve
        </Button>
      )}
    </li>
  );
}
