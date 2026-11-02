'use client';

import { addDays, localToday } from '@petsitter/shared/scheduling';
import {
  boardTimeLabel,
  canMoveVisit,
  dropChange,
  weekBoard,
  type VisitChange,
} from '@petsitter/shared/week-board';
import { weekStart } from '@petsitter/shared/calendar';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type DragEvent } from 'react';

import { Badge, Button, Card, PageHeader, QueryState } from '@/components/ui';
import { useOrg } from '@/features/org/org-context';
import { SERVICE_LABELS, STATUS_LABELS, formatDay } from '@/lib/format';
import { useLiveQueries } from '@/lib/live';
import { fetchSitters, sitterKeys } from '@/lib/schedule';

import { fetchWeekVisits, scheduleKeys, type WeekVisit } from './api';
import { VisitChangeDialog } from './visit-change-dialog';

const DRAG_TYPE = 'application/x-petsitter-visit';

export function WeekSchedule() {
  const { org } = useOrg();
  const today = localToday(new Date(), org.timeZone);
  const [monday, setMonday] = useState(() => weekStart(today));
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ visit: WeekVisit; change: VisitChange } | null>(null);

  const visits = useQuery({
    queryKey: scheduleKeys.week(monday),
    queryFn: () => fetchWeekVisits(monday, org.timeZone),
  });
  const sitters = useQuery({ queryKey: sitterKeys.all, queryFn: fetchSitters });
  useLiveQueries(['visits', 'bookings'], [scheduleKeys.week(monday)]);

  const board = useMemo(
    () => weekBoard(visits.data ?? [], sitters.data ?? [], monday, org.timeZone),
    [visits.data, sitters.data, monday, org.timeZone],
  );
  const byId = useMemo(() => new Map((visits.data ?? []).map((v) => [v.id, v])), [visits.data]);

  const onDrop = (event: DragEvent, sitterId: string | null, date: string) => {
    event.preventDefault();
    setOverCell(null);
    setDragging(null);
    const visit = byId.get(event.dataTransfer.getData(DRAG_TYPE));
    if (!visit) return;
    const change = dropChange(visit, { sitterId, date }, org.timeZone);
    if (change) setEditing({ visit, change });
  };

  return (
    <>
      <PageHeader title="Schedule">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label="Previous week"
            onClick={() => setMonday(addDays(monday, -7))}
          >
            ←
          </Button>
          <Button variant="secondary" onClick={() => setMonday(weekStart(today))}>
            This week
          </Button>
          <Button
            variant="secondary"
            aria-label="Next week"
            onClick={() => setMonday(addDays(monday, 7))}
          >
            →
          </Button>
        </div>
      </PageHeader>

      <Card>
        <p className="mb-4 text-sm text-gray-600">
          Drag a visit to another sitter or day to reassign or move it, or click it to change the
          time. Every change is checked for overlaps, travel time, availability and time off first.
          Times are in {org.timeZone}.
        </p>
        <QueryState
          isPending={visits.isPending || sitters.isPending}
          error={visits.error ?? sitters.error}
          onRetry={() => void Promise.all([visits.refetch(), sitters.refetch()])}
        />
        {visits.data && sitters.data ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="w-40 p-2 text-left">
                    Sitter
                  </th>
                  {board.days.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      className={`p-2 text-left font-semibold ${day === today ? 'text-brand-ink' : ''}`}
                    >
                      {formatDay(day)}
                      {day === today ? ' · Today' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-500">
                      No sitters yet. Invite one from the Sitters page.
                    </td>
                  </tr>
                ) : null}
                {board.rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100 align-top">
                    <th
                      scope="row"
                      className={`p-2 text-left font-medium ${row.sitterId ? '' : 'text-amber-800'}`}
                    >
                      {row.title}
                    </th>
                    {row.cells.map((cell, i) => {
                      const day = board.days[i];
                      const cellKey = `${row.key}:${day}`;
                      // Visits can't be unassigned by dragging, so that row isn't a drop target.
                      const droppable = row.sitterId !== null;
                      return (
                        <td
                          key={day}
                          className={`h-20 p-1 ${overCell === cellKey ? 'bg-brand/10 outline-2 outline-dashed outline-brand' : ''}`}
                          onDragOver={
                            droppable && dragging
                              ? (e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (overCell !== cellKey) setOverCell(cellKey);
                                }
                              : undefined
                          }
                          onDragLeave={() => setOverCell((c) => (c === cellKey ? null : c))}
                          onDrop={droppable ? (e) => onDrop(e, row.sitterId, day) : undefined}
                        >
                          <div className="space-y-1">
                            {cell.map((visit) => (
                              <VisitChip
                                key={visit.id}
                                visit={visit}
                                timeZone={org.timeZone}
                                unassigned={row.sitterId === null}
                                isDragging={dragging === visit.id}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(DRAG_TYPE, visit.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDragging(visit.id);
                                }}
                                onDragEnd={() => {
                                  setDragging(null);
                                  setOverCell(null);
                                }}
                                onOpen={() => setEditing({ visit, change: {} })}
                              />
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {editing ? (
        <VisitChangeDialog
          visit={editing.visit}
          initialChange={editing.change}
          sitters={sitters.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function VisitChip({
  visit,
  timeZone,
  unassigned,
  isDragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  visit: WeekVisit;
  timeZone: string;
  unassigned: boolean;
  isDragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const movable = canMoveVisit(visit);
  const household = visit.booking?.household;
  const pets = visit.booking?.booking_pets
    .map((bp) => bp.pet?.name)
    .filter(Boolean)
    .join(', ');
  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      title={movable ? 'Drag to move or reassign; click for details' : 'Already started'}
      className={`block w-full rounded-lg border px-2 py-1 text-left text-xs leading-snug ${
        unassigned
          ? 'border-amber-300 bg-amber-50'
          : movable
            ? 'border-gray-200 bg-white hover:border-brand'
            : 'border-gray-200 bg-gray-100 text-gray-600'
      } ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-40' : ''}`}
    >
      <span className="block font-semibold tabular-nums">{boardTimeLabel(visit, timeZone)}</span>
      <span className="block truncate">{household?.name ?? household?.address_line1}</span>
      <span className="block truncate text-gray-500">
        {SERVICE_LABELS[visit.booking?.service_type ?? ''] ?? 'Visit'}
        {pets ? ` · ${pets}` : ''}
      </span>
      {!movable ? (
        <span className="mt-0.5 block">
          <Badge tone={visit.status === 'completed' ? 'green' : 'blue'}>
            {STATUS_LABELS[visit.status] ?? visit.status}
          </Badge>
        </span>
      ) : null}
    </button>
  );
}
