import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/**
 * Best-effort current position for check-in/out. Never throws and never blocks a
 * sitter for long: returns null if permission is denied or no fix arrives in time,
 * falling back to the last known position.
 */
export async function getCurrentCoords(timeoutMs = 8000): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return null;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    const position =
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeout,
      ]).finally(() => clearTimeout(timer))) ?? (await Location.getLastKnownPositionAsync());

    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
}
