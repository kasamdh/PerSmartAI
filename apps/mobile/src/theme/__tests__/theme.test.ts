import { contrastRatio } from '@petsitter/shared/branding';

import { CONTRAST_PAIRS, darkColors, lightColors, type Colors } from '../colors';
import { STATUS_LOOK } from '../status';
import { buildTheme } from '../theme';
import { space, radius, size, type } from '../tokens';

const failures = (colors: Colors) =>
  CONTRAST_PAIRS.filter(([fg, bg, min]) => contrastRatio(colors[fg], colors[bg]) < min).map(
    ([fg, bg, min]) =>
      `${fg} on ${bg}: ${contrastRatio(colors[fg], colors[bg]).toFixed(2)} < ${min}`,
  );

describe('color contrast (WCAG AA)', () => {
  it('passes every pair in light mode', () => {
    expect(failures(lightColors)).toEqual([]);
  });

  it('passes every pair in dark mode', () => {
    expect(failures(darkColors)).toEqual([]);
  });

  it('keeps every status chip readable in both modes', () => {
    for (const colors of [lightColors, darkColors]) {
      for (const look of Object.values(STATUS_LOOK)) {
        expect(
          contrastRatio(colors[look.foreground], colors[look.background]),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(['#FFD84D', '#0E7C66', '#FF4F9A', '#000000', '#FFFFFF', '#6D28D9'])(
    'adapts a business color (%s) so it stays readable in both modes',
    (brand) => {
      for (const scheme of ['light', 'dark'] as const) {
        const { colors } = buildTheme(scheme, brand);
        expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.primaryInk, colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.primaryInk, colors.primarySoft)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});

describe('scales', () => {
  it('keeps spacing and radius on the 4 pt grid', () => {
    for (const value of Object.values(space)) expect(value % 4).toBe(0);
    for (const [name, value] of Object.entries(radius)) {
      if (name !== 'pill') expect(value % 4).toBe(0);
    }
  });

  it('keeps every tap target at least 48 pt, and care buttons bigger', () => {
    expect(size.tap).toBeGreaterThanOrEqual(48);
    expect(size.control).toBeGreaterThanOrEqual(48);
    expect(size.bigAction).toBeGreaterThan(size.control);
  });

  it('lets every text style grow with the phone setting', () => {
    for (const style of Object.values(type)) expect(style.maxScale).toBeGreaterThanOrEqual(1.4);
    expect(type.body.fontSize).toBeGreaterThanOrEqual(17);
  });
});
