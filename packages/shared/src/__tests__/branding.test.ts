import {
  DEFAULT_ACCENT,
  DEFAULT_PRIMARY,
  MIN_TEXT_CONTRAST,
  MIN_UI_CONTRAST,
  brandPalette,
  contrastRatio,
  isHexColor,
  logoPath,
  readableOnWhite,
  textColorOn,
} from '../branding.ts';

describe('isHexColor', () => {
  it('accepts #RRGGBB only', () => {
    expect(isHexColor('#0e7c66')).toBe(true);
    expect(isHexColor('#0E7C6')).toBe(false);
    expect(isHexColor('teal')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

describe('contrast', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('puts white text on dark colors and dark text on light ones', () => {
    expect(textColorOn('#0B5CAD')).toBe('#FFFFFF');
    expect(textColorOn('#F2E205')).toBe('#111111');
  });

  it('darkens pale colors until they read on white', () => {
    const pale = '#FFD84D';
    expect(contrastRatio(pale, '#FFFFFF')).toBeLessThan(MIN_TEXT_CONTRAST);
    expect(contrastRatio(readableOnWhite(pale), '#FFFFFF')).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    expect(readableOnWhite('#0B5CAD')).toBe('#0B5CAD');
  });
});

describe('brandPalette', () => {
  it('falls back to the default colors', () => {
    const p = brandPalette({ primaryColor: null, accentColor: 'nope' });
    expect(p.primary).toBe(DEFAULT_PRIMARY);
    expect(p.accent).toBe(DEFAULT_ACCENT);
  });

  it('always yields readable pairs', () => {
    for (const color of ['#FFFFFF', '#FFD84D', '#0E7C66', '#000000', '#FF4F9A']) {
      const p = brandPalette({ primaryColor: color, accentColor: color });
      expect(contrastRatio(p.primary, p.onPrimary)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      expect(contrastRatio(p.primaryOnWhite, '#FFFFFF')).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
      expect(contrastRatio(p.accentOnWhite, '#FFFFFF')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

it('puts logos in the business branding folder', () => {
  expect(logoPath('org-1', 'png', 42)).toBe('org-1/branding/logo-42.png');
});
