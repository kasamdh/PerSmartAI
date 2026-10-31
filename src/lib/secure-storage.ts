import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * SecureStore warns above ~2 KB per value and a Supabase session (access + refresh
 * token + user) is larger, so values are split across `${key}.0..n` with the
 * count in `${key}.chunks`. Chunks are ASCII-sized well under the limit.
 */
export const CHUNK_SIZE = 1800;

export type SecureKeyValueStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

export type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createChunkedStorage(store: SecureKeyValueStore): StorageAdapter {
  const countKey = (key: string) => `${key}.chunks`;
  const chunkKey = (key: string, i: number) => `${key}.${i}`;
  const chunkCount = async (key: string) => Number(await store.getItemAsync(countKey(key))) || 0;

  return {
    async getItem(key) {
      const count = await chunkCount(key);
      if (count === 0) return null;
      const parts = await Promise.all(
        Array.from({ length: count }, (_, i) => store.getItemAsync(chunkKey(key, i))),
      );
      // A missing chunk means a half-written value: treat it as absent.
      return parts.some((p) => p === null) ? null : parts.join('');
    },

    async setItem(key, value) {
      const previous = await chunkCount(key);
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      if (chunks.length === 0) chunks.push('');

      await Promise.all(chunks.map((chunk, i) => store.setItemAsync(chunkKey(key, i), chunk)));
      await store.setItemAsync(countKey(key), String(chunks.length));
      for (let i = chunks.length; i < previous; i++) {
        await store.deleteItemAsync(chunkKey(key, i));
      }
    },

    async removeItem(key) {
      const count = await chunkCount(key);
      await Promise.all(
        Array.from({ length: count }, (_, i) => store.deleteItemAsync(chunkKey(key, i))),
      );
      await store.deleteItemAsync(countKey(key));
    },
  };
}

/** Session storage for the Supabase client: Keychain/Keystore on devices, AsyncStorage on web. */
export const sessionStorage: StorageAdapter =
  Platform.OS === 'web' ? AsyncStorage : createChunkedStorage(SecureStore);
