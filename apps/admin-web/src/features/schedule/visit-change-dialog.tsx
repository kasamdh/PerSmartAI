'use client';

import { SchedulingError } from '@petsitter/shared/schedule-actions';
import { utcToLocal } from '@petsitter/shared/scheduling';
import { canMoveVisit, editChange, type VisitChange } from '@petsitter/shared/week-board';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Button, Field, inputClass } from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import { SERVICE_LABELS, STATUS_LABELS, errorMessage, formatDateTime } from '@/lib/format';
import { scheduleAction, type Sitter } from '@/lib/schedule';

import type { WeekVisit } from './api';

/**
 * Review and save a change to one visit. The change is checked with
 * schedule-booking's preview first (the same conflict check the server runs on
 * save); blocking problems disable Save, warnings are shown.
 */
export function VisitChangeDialog({
  visit,
  initialChange,
  sitters,
  onClose,
}: {
  visit: WeekVisit;
  initialChange: VisitChange;
  sitters: readonly Sitter[];
  onClose: () => void;
}) {
  const { org } = useOrg();
  const queryClient = useQueryClient();
  const local = utcToLocal(new Date(visit.scheduled_start), org.timeZone);
  const [sitterId, setSitterId] = useState(initialChange.sitter_id ?? visit.sitter_id ?? '');
  const [date, setDate] = useState(initialChange.date ?? local.date);
  const [time, setTime] = useState(initialChange.time ?? local.time);
  const movable = canMoveVisit(visit);
  const change = editChange(visit, { sitterId: sitterId || null, date, time }, org.timeZone);

  const preview = useQuery({
    queryKey: ['visit-preview', visit.id, change],
    queryFn: () => scheduleAction('update_visit', { visit_id: visit.id, ...change, preview: true }),
    enabled: change !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const save = useMutation({
    mutationFn: () => scheduleAction('update_visit', { visit_id: visit.id, ...change! }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const blocked = preview.error instanceof SchedulingError ? preview.error : null;
  const warnings = preview.data?.problems.flatMap((p) => p.reasons) ?? [];
  const saveError = save.error;
  const household = visit.booking?.household;
  const currentSitter = sitters.find((s) => s.id === visit.sitter_id)?.full_name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-dialog-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="visit-dialog-title" className="text-lg font-semibold">
          {SERVICE_LABELS[visit.booking?.service_type ?? ''] ?? 'Visit'} at{' '}
          {household?.name ?? household?.address_line1}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Now: {formatDateTime(visit.scheduled_start, org.timeZone)} ·{' '}
          {currentSitter ?? 'no sitter'} · {STATUS_LABELS[visit.status] ?? visit.status}
        </p>

        {movable ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Field label="Sitter">
                <select
                  className={inputClass}
                  value={sitterId}
                  onChange={(e) => setSitterId(e.target.value)}
                >
                  {!visit.sitter_id ? <option value="">Choose a sitter</option> : null}
                  {sitters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Date">
                <input
                  type="date"
                  className={inputClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Start time">
              <input
                type="time"
                className={inputClass}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </Field>
          </div>
        ) : (
          <p className="mt-5 text-sm">
            This visit has already started, so it can’t be moved or reassigned.
          </p>
        )}

        <div className="mt-5 min-h-12 text-sm" aria-live="polite">
          {change === null ? (
            movable ? (
              <p className="text-gray-500">Change the sitter, date or time.</p>
            ) : null
          ) : preview.isFetching ? (
            <p className="text-gray-600">Checking the sitter’s schedule…</p>
          ) : blocked ? (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
              <p className="font-semibold">{blocked.message}</p>
              <ul className="mt-1 list-disc pl-5">
                {blocked.problems
                  .flatMap((p) => p.reasons)
                  .map((r) => (
                    <li key={r}>{r}</li>
                  ))}
              </ul>
            </div>
          ) : preview.error ? (
            <p role="alert" className="text-red-700">
              {errorMessage(preview.error)}
            </p>
          ) : warnings.length > 0 ? (
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
              <p className="font-semibold">You can save this, but note:</p>
              <ul className="mt-1 list-disc pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : preview.data ? (
            <p className="font-medium text-green-800">No conflicts. Ready to save.</p>
          ) : null}
          {saveError ? (
            <p role="alert" className="mt-2 text-red-700">
              {saveError instanceof SchedulingError && saveError.problems.length
                ? `${saveError.message}: ${saveError.problems.flatMap((p) => p.reasons).join('; ')}`
                : errorMessage(saveError)}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {movable ? (
            <Button
              disabled={!change || !preview.data || preview.isFetching || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save change'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
