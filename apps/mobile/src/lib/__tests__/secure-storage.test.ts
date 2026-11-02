import { CHUNK_SIZE, createChunkedStorage, type SecureKeyValueStore } from '../secure-storage';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

function memoryStore(): SecureKeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => {
      data.set(k, v);
    },
    deleteItemAsync: async (k) => {
      data.delete(k);
    },
  };
}

describe('createChunkedStorage', () => {
  it('round-trips a session larger than one SecureStore value', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    const session = JSON.stringify({ access_token: 'a'.repeat(5000), refresh_token: 'r' });

    await storage.setItem('petsitter-auth', session);

    expect(await storage.getItem('petsitter-auth')).toBe(session);
    for (const value of store.data.values()) {
      expect(value.length).toBeLessThanOrEqual(CHUNK_SIZE);
    }
    expect(store.data.get('petsitter-auth.chunks')).toBe(
      String(Math.ceil(session.length / CHUNK_SIZE)),
    );
  });

  it('cleans up leftover chunks when the value shrinks', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem('k', 'x'.repeat(CHUNK_SIZE * 3));
    await storage.setItem('k', 'short');

    expect(await storage.getItem('k')).toBe('short');
    expect([...store.data.keys()].sort()).toEqual(['k.0', 'k.chunks']);
  });

  it('removes every chunk', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem('k', 'x'.repeat(CHUNK_SIZE * 2 + 1));
    await storage.removeItem('k');

    expect(store.data.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });

  it('treats a half-written value as missing', async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem('k', 'x'.repeat(CHUNK_SIZE + 10));
    store.data.delete('k.1');

    expect(await storage.getItem('k')).toBeNull();
  });

  it('returns null for keys never written', async () => {
    expect(await createChunkedStorage(memoryStore()).getItem('nope')).toBeNull();
  });
});
