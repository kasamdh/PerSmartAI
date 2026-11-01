import type { Coords } from './location';

const EARTH_RADIUS_M = 6_371_000;
export const CHECK_IN_RADIUS_M = 200;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in meters. */
export function distanceMeters(a: Coords, b: Coords): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A warning (never a block) when check-in happens more than 200 m from the
 * household. Null when close enough, or when either location is unknown.
 */
export function checkInDistanceWarning(
  here: Coords | null,
  home: { lat: number | null; lng: number | null; address: string },
  maxMeters = CHECK_IN_RADIUS_M,
): { meters: number; message: string } | null {
  if (!here || home.lat === null || home.lng === null) return null;
  const meters = Math.round(distanceMeters(here, { lat: home.lat, lng: home.lng }));
  if (meters <= maxMeters) return null;
  const distance =
    meters < 1000 ? `${Math.round(meters / 50) * 50} m` : `${(meters / 1000).toFixed(1)} km`;
  return { meters, message: `You seem to be about ${distance} from ${home.address}.` };
}
