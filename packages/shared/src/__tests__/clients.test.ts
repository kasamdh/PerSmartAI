import { clientTitle, searchClients } from '../clients.ts';

const clients = [
  {
    id: 'h1',
    name: 'Lee home',
    address_line1: '12 Oak St',
    city: 'Springfield',
    owner: { full_name: 'Ana Lee', phone: '(555) 123-4567' },
    pets: [{ id: 'p1', name: 'Max', species: 'dog', breed: 'Beagle' }],
  },
  {
    id: 'h2',
    name: null,
    address_line1: '9 Elm Ave',
    city: null,
    owner: { full_name: 'José Núñez', phone: null },
    pets: [{ id: 'p2', name: 'Luna', species: 'cat' }],
  },
];

describe('searchClients', () => {
  it('lists everyone by title when the search is empty', () => {
    expect(searchClients(clients, '  ').map((c) => c.id)).toEqual(['h2', 'h1']);
  });

  it('matches owners, pets, breeds and streets, ignoring case and accents', () => {
    expect(searchClients(clients, 'jose').map((c) => c.id)).toEqual(['h2']);
    expect(searchClients(clients, 'BEAGLE').map((c) => c.id)).toEqual(['h1']);
    expect(searchClients(clients, 'luna cat').map((c) => c.id)).toEqual(['h2']);
    expect(searchClients(clients, 'oak max').map((c) => c.id)).toEqual(['h1']);
    expect(searchClients(clients, 'oak luna')).toEqual([]);
  });

  it('matches phone numbers on digits', () => {
    expect(searchClients(clients, '555-1234').map((c) => c.id)).toEqual(['h1']);
    expect(searchClients(clients, '4567').map((c) => c.id)).toEqual(['h1']);
  });
});

it('titles a household by its name, then the owner', () => {
  expect(clientTitle(clients[0])).toBe('Lee home');
  expect(clientTitle(clients[1])).toBe('José Núñez');
});
