import { describe, expect, it } from 'vitest';
import { moderateText } from './contentModeration';

describe('content safety pre-screen', () => {
  it('allows ordinary marketplace content', () => {
    expect(moderateText(['Dining table', 'Solid wood, lightly used']).allowed).toBe(true);
  });
  it('blocks prohibited text in English and Arabic', () => {
    expect(moderateText(['Suspicious product', 'Drug for sale']).allowed).toBe(false);
    expect(moderateText(['إعلان', 'مخدرات للبيع']).allowed).toBe(false);
  });
});
