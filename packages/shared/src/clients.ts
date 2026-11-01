// Admin client list: households with their owner and pets, searchable by any of them.

export type ClientSummary = {
  id: string;
  name: string | null;
  address_line1: string;
  city: string | null;
  owner: { full_name: string; phone: string | null } | null;
  pets: { id: string; name: string; species: string; breed?: string | null }[];
};

const normalize = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** "Lee home", or the owner's name, or the street. */
export function clientTitle(
  client: Pick<ClientSummary, 'name' | 'owner' | 'address_line1'>,
): string {
  return client.name ?? client.owner?.full_name ?? client.address_line1;
}

/**
 * Households matching every word of `query` (household, owner, phone, address,
 * pet name, species or breed), sorted by title. Phone numbers match on digits only.
 */
export function searchClients<C extends ClientSummary>(clients: readonly C[], query: string): C[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const sorted = [...clients].sort((a, b) => clientTitle(a).localeCompare(clientTitle(b)));
  if (words.length === 0) return sorted;
  return sorted.filter((c) => {
    const text = normalize(
      [
        c.name,
        c.address_line1,
        c.city,
        c.owner?.full_name,
        ...c.pets.flatMap((p) => [p.name, p.species, p.breed]),
      ]
        .filter(Boolean)
        .join(' '),
    );
    const phone = (c.owner?.phone ?? '').replace(/\D/g, '');
    return words.every((w) => {
      const digits = w.replace(/\D/g, '');
      return (
        text.includes(w) || (digits.length >= 3 && /^[\d+()-]+$/.test(w) && phone.includes(digits))
      );
    });
  });
}
