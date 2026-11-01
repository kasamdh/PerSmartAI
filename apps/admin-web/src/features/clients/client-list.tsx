'use client';

import { clientTitle, searchClients } from '@petsitter/shared/clients';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';

import { Card, Empty, PageHeader, QueryState, inputClass } from '@/components/ui';

import { clientKeys, fetchClients } from './api';

export function ClientList() {
  const clients = useQuery({ queryKey: clientKeys.all, queryFn: fetchClients });
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(
    () => searchClients(clients.data ?? [], deferred),
    [clients.data, deferred],
  );

  return (
    <>
      <PageHeader title="Clients & pets" />
      <Card>
        <input
          type="search"
          aria-label="Search clients"
          placeholder="Search by owner, pet, breed, street or phone"
          className={`${inputClass} mb-4 max-w-md`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <QueryState
          isPending={clients.isPending}
          error={clients.error}
          onRetry={() => clients.refetch()}
        />
        {clients.data && results.length === 0 ? (
          <Empty>{query ? 'No clients match that search.' : 'No clients yet.'}</Empty>
        ) : null}
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-600">
                <tr>
                  <th className="p-2 font-medium">Household</th>
                  <th className="p-2 font-medium">Owner</th>
                  <th className="p-2 font-medium">Phone</th>
                  <th className="p-2 font-medium">Pets</th>
                  <th className="p-2 font-medium">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-2 font-medium">
                      <Link href={`/clients/${c.id}`} className="text-brand-ink hover:underline">
                        {clientTitle(c)}
                      </Link>
                    </td>
                    <td className="p-2">{c.owner?.full_name ?? '—'}</td>
                    <td className="p-2 tabular-nums">{c.owner?.phone ?? '—'}</td>
                    <td className="p-2">
                      {c.pets.length
                        ? c.pets.map((p) => `${p.name} (${p.species})`).join(', ')
                        : '—'}
                    </td>
                    <td className="p-2 text-gray-600">
                      {c.address_line1}
                      {c.city ? `, ${c.city}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">
              {results.length} of {clients.data?.length ?? 0} households
            </p>
          </div>
        ) : null}
      </Card>
    </>
  );
}
