import { checkInDistanceWarning, distanceMeters } from '../geo';

describe('distanceMeters', () => {
  it('measures great-circle distance', () => {
    expect(distanceMeters({ lat: 40.6943, lng: -73.9903 }, { lat: 40.6943, lng: -73.9903 })).toBe(
      0,
    );
    // ~111 m per 0.001° of latitude.
    expect(
      Math.round(distanceMeters({ lat: 40.6943, lng: -73.9903 }, { lat: 40.6953, lng: -73.9903 })),
    ).toBe(111);
    // New York → Los Angeles, about 3,936 km.
    expect(
      Math.round(
        distanceMeters({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 }) / 1000,
      ),
    ).toBe(3936);
  });
});

describe('checkInDistanceWarning', () => {
  const home = { lat: 40.6943, lng: -73.9903, address: '12 Maple St' };

  it('says nothing within 200 m', () => {
    expect(checkInDistanceWarning({ lat: 40.6955, lng: -73.9903 }, home)).toBeNull(); // ~133 m
  });

  it('warns beyond 200 m, rounding the distance', () => {
    expect(checkInDistanceWarning({ lat: 40.6983, lng: -73.9903 }, home)).toEqual({
      meters: 445,
      message: 'You seem to be about 450 m from 12 Maple St.',
    });
    expect(checkInDistanceWarning({ lat: 40.7128, lng: -73.9903 }, home)?.message).toBe(
      'You seem to be about 2.1 km from 12 Maple St.',
    );
  });

  it('cannot warn without a location or household coordinates', () => {
    expect(checkInDistanceWarning(null, home)).toBeNull();
    expect(
      checkInDistanceWarning({ lat: 1, lng: 1 }, { lat: null, lng: null, address: 'x' }),
    ).toBeNull();
  });
});
